"""정산 서비스 테스트 — CLAUDE.md 필수 케이스

- 두 번 정산해도 점수 중복 안 됨 (멱등성)
- 역배 보너스 계산
- VOID 처리
- 음수 점수 클램프
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.card import PredictionCard
from app.models.score_event import ScoreEvent
from app.models.user import User
from app.models.vote import Vote
from app.services.settlement import settle_card


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _user(db, *, pq_score=1000, level_code="rookie", **kw):
    u = User(
        id=uuid.uuid4(),
        provider="test",
        provider_id=str(uuid.uuid4()),
        pq_score=pq_score,
        level_code=level_code,
        **kw,
    )
    db.add(u)
    db.flush()
    return u


def _card(db, **kw):
    defaults = dict(
        id=uuid.uuid4(),
        title="테스트 예측",
        category="시사",
        creator_type="official",
        status="closed",
        duration_tier="short",
        closes_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    defaults.update(kw)
    c = PredictionCard(**defaults)
    db.add(c)
    db.flush()
    return c


def _vote(db, user, card, *, choice="YES", odds=Decimal("0.5000")):
    v = Vote(
        id=uuid.uuid4(),
        user_id=user.id,
        card_id=card.id,
        choice=choice,
        odds_at_vote=odds,
    )
    db.add(v)
    db.flush()
    return v


# ---------------------------------------------------------------------------
# 기본 적중/실패
# ---------------------------------------------------------------------------

class TestBasicSettlement:

    def test_hit(self, db):
        """적중 → +50, total_wins++, total_votes++, streak++"""
        u = _user(db)
        c = _card(db)
        v = _vote(db, u, c, choice="YES")

        count = settle_card(db, c.id, "YES")

        assert count == 1
        assert u.pq_score == 1050
        assert u.total_wins == 1
        assert u.total_votes == 1
        assert u.current_streak == 1

        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 50
        assert ev.reason == "hit"
        assert ev.pq_after == 1050

    def test_miss(self, db):
        """실패 → -30, streak 리셋"""
        u = _user(db, current_streak=5)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        assert u.pq_score == 970
        assert u.total_wins == 0
        assert u.total_votes == 1
        assert u.current_streak == 0

    def test_no_votes(self, db):
        """투표 없는 카드도 정상 정산 (상태만 변경)"""
        c = _card(db)
        count = settle_card(db, c.id, "YES")

        assert count == 0
        assert c.status == "settled"
        assert c.final_result == "YES"


# ---------------------------------------------------------------------------
# 멱등성 (★ 핵심)
# ---------------------------------------------------------------------------

class TestIdempotency:

    def test_second_settle_returns_zero(self, db):
        """같은 카드 두 번 정산 → 두 번째는 0 반환, 점수 변동 없음"""
        u = _user(db)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        assert settle_card(db, c.id, "YES") == 1
        assert u.pq_score == 1050

        assert settle_card(db, c.id, "YES") == 0
        assert u.pq_score == 1050

        events = db.execute(select(ScoreEvent)).scalars().all()
        assert len(events) == 1


# ---------------------------------------------------------------------------
# 역배 보너스
# ---------------------------------------------------------------------------

class TestUnderdogBonus:

    def test_minority_hit_gets_bonus(self, db):
        """소수파(20%) 적중 → 50 × 1.6 = +80"""
        u = _user(db)
        c = _card(db)
        v = _vote(db, u, c, choice="YES", odds=Decimal("0.2000"))

        settle_card(db, c.id, "YES")

        assert u.pq_score == 1080
        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 80
        assert ev.reason == "underdog_bonus"

    def test_extreme_minority(self, db):
        """극소수(5%) 적중 → 50 × 1.9 = +95"""
        u = _user(db)
        c = _card(db)
        v = _vote(db, u, c, choice="YES", odds=Decimal("0.0500"))

        settle_card(db, c.id, "YES")

        assert u.pq_score == 1095
        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 95

    def test_majority_no_bonus(self, db):
        """다수파(60%) 적중 → 보너스 없이 +50"""
        u = _user(db)
        c = _card(db)
        v = _vote(db, u, c, choice="YES", odds=Decimal("0.6000"))

        settle_card(db, c.id, "YES")

        assert u.pq_score == 1050
        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 50
        assert ev.reason == "hit"

    def test_minority_miss_no_penalty_bonus(self, db):
        """소수파였는데 틀린 경우 → 그냥 -30 (추가 패널티 없음)"""
        u = _user(db)
        c = _card(db)
        _vote(db, u, c, choice="YES", odds=Decimal("0.1000"))

        settle_card(db, c.id, "NO")

        assert u.pq_score == 970


# ---------------------------------------------------------------------------
# VOID 처리
# ---------------------------------------------------------------------------

class TestVoid:

    def test_void_no_score_change(self, db):
        """VOID → delta=0, 점수·승패·스트릭 변동 없음, 이벤트는 남김"""
        u = _user(db, current_streak=3)
        c = _card(db)
        v = _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "VOID")

        assert u.pq_score == 1000
        assert u.total_votes == 0
        assert u.total_wins == 0
        assert u.current_streak == 3

        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 0
        assert ev.reason == "void_refund"
        assert ev.pq_after == 1000


# ---------------------------------------------------------------------------
# 음수 점수 클램프
# ---------------------------------------------------------------------------

class TestScoreClamping:

    def test_clamp_to_zero(self, db):
        """PQ 10에서 miss → delta=-10(적용값), pq_after=0"""
        u = _user(db, pq_score=10, level_code="dull")
        c = _card(db)
        v = _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        assert u.pq_score == 0
        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == -10
        assert ev.pq_after == 0

    def test_already_zero(self, db):
        """PQ 0에서 miss → delta=0, pq_after=0"""
        u = _user(db, pq_score=0, level_code="dull")
        c = _card(db)
        v = _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        assert u.pq_score == 0
        ev = db.execute(select(ScoreEvent).where(ScoreEvent.vote_id == v.id)).scalar_one()
        assert ev.delta == 0
        assert ev.pq_after == 0


# ---------------------------------------------------------------------------
# 등급 갱신
# ---------------------------------------------------------------------------

class TestLevelDetermination:

    def test_upgrade(self, db):
        """1470 + 80(역배) = 1550 → sharp"""
        u = _user(db, pq_score=1470)
        c = _card(db)
        _vote(db, u, c, choice="YES", odds=Decimal("0.2000"))

        settle_card(db, c.id, "YES")

        assert u.pq_score == 1550
        assert u.level_code == "sharp"

    def test_downgrade(self, db):
        """1010 - 30 = 980 → dull"""
        u = _user(db, pq_score=1010)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        assert u.pq_score == 980
        assert u.level_code == "dull"

    def test_cursed_override(self, db):
        """total_votes≥20 & win_rate<0.30 → PQ 무관 cursed 우선"""
        u = _user(db, pq_score=1200, total_votes=20, total_wins=5)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        # 21표, 5승, 승률 ≈ 0.238 < 0.30
        assert u.level_code == "cursed"

    def test_not_cursed_below_threshold(self, db):
        """total_votes < 20이면 cursed 미적용"""
        u = _user(db, pq_score=1200, total_votes=18, total_wins=4)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        # 19표, 4승, 승률 ≈ 0.21 이지만 20표 미만이므로 cursed 아님
        assert u.level_code == "rookie"


# ---------------------------------------------------------------------------
# 스트릭
# ---------------------------------------------------------------------------

class TestStreak:

    def test_increments_on_hit(self, db):
        u = _user(db, current_streak=3)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "YES")

        assert u.current_streak == 4

    def test_resets_on_miss(self, db):
        u = _user(db, current_streak=5)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "NO")

        assert u.current_streak == 0

    def test_unchanged_on_void(self, db):
        u = _user(db, current_streak=3)
        c = _card(db)
        _vote(db, u, c, choice="YES")

        settle_card(db, c.id, "VOID")

        assert u.current_streak == 3


# ---------------------------------------------------------------------------
# 복합 시나리오
# ---------------------------------------------------------------------------

class TestMultipleUsers:

    def test_multiple_voters_one_card(self, db):
        """한 카드에 여러 유저 → 각각 독립 정산"""
        u1 = _user(db)
        u2 = _user(db)
        u3 = _user(db)
        c = _card(db)

        _vote(db, u1, c, choice="YES", odds=Decimal("0.3000"))  # 소수파
        _vote(db, u2, c, choice="YES", odds=Decimal("0.4000"))  # 소수파
        _vote(db, u3, c, choice="NO", odds=Decimal("0.7000"))   # 다수파

        count = settle_card(db, c.id, "YES")

        assert count == 3
        # u1: 50 × (1 + 0.4) = 70
        assert u1.pq_score == 1070
        # u2: 50 × (1 + 0.2) = 60
        assert u2.pq_score == 1060
        # u3: miss -30
        assert u3.pq_score == 970


class TestValidation:

    def test_invalid_result_raises(self, db):
        c = _card(db)
        with pytest.raises(ValueError, match="잘못된 결과값"):
            settle_card(db, c.id, "MAYBE")
