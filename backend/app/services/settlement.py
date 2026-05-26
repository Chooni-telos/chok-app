"""정산 서비스 — DESIGN.md 3장 멱등 정산 함수

이 모듈이 프로젝트의 심장이다. settle_card()는 카드 상태 변경 + 점수 이벤트 기록
+ 유저 점수/등급 갱신을 한 트랜잭션에 묶는다.
"""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.card import PredictionCard
from app.models.level import Level
from app.models.score_event import ScoreEvent
from app.models.user import User
from app.models.vote import Vote

import json

BASE_HIT = 50
BASE_MISS = -30


def _underdog_multiplier(odds: Decimal) -> float:
    """DESIGN.md 2.2 — odds < 0.5이면 소수파 보너스 배율"""
    if odds < Decimal("0.5"):
        return 1.0 + float(Decimal("0.5") - odds) * 2
    return 1.0


def _calculate_delta(choice: str, result: str, odds: Decimal) -> tuple[int, str]:
    """투표 하나의 명목 점수 변동량과 사유를 반환한다."""
    if result == "VOID":
        return 0, "void_refund"

    if choice == result:
        multiplier = _underdog_multiplier(odds)
        if multiplier > 1.0:
            return round(BASE_HIT * multiplier), "underdog_bonus"
        return BASE_HIT, "hit"

    return BASE_MISS, "miss"


def _determine_level(
    pq_score: int,
    total_votes: int,
    total_wins: int,
    levels: list[Level],
) -> str:
    """DESIGN.md 2.5 — cursed 조건 우선 판정 후 PQ 구간 등급 결정"""
    if total_votes >= 20:
        win_rate = total_wins / total_votes
        if win_rate < 0.30:
            return "cursed"

    for level in sorted(
        [lv for lv in levels if lv.min_pq is not None],
        key=lambda lv: lv.min_pq,
        reverse=True,
    ):
        if pq_score >= level.min_pq:
            return level.level_code

    return "novice"


def settle_card(db: Session, card_id: UUID, result: str) -> int:
    """멱등 정산 함수. 정산된 투표 수를 반환한다 (이미 정산된 카드면 0)."""
    # 1. 카드 잠금 조회 (SELECT ... FOR UPDATE)
    card = db.execute(
        select(PredictionCard)
        .where(PredictionCard.id == card_id)
        .with_for_update()
    ).scalar_one()

    if card.status == "settled":
        return 0

    valid_choices = json.loads(card.choices) if card.choices else ["YES", "NO"]
    valid_results = set(valid_choices) | {"VOID"}
    if result not in valid_results:
        raise ValueError(f"잘못된 결과값: {result}. {valid_results} 중 하나여야 합니다")

    card.status = "settled"
    card.final_result = result
    card.settled_at = datetime.now(timezone.utc)

    # 2. 미정산 투표 조회
    votes = (
        db.execute(
            select(Vote).where(Vote.card_id == card_id, Vote.is_settled == False)  # noqa: E712
        )
        .scalars()
        .all()
    )

    if not votes:
        db.flush()
        return 0

    # 등급 테이블 조회
    levels = db.execute(select(Level)).scalars().all()

    # 유저 일괄 조회 (FOR UPDATE)
    user_ids = {v.user_id for v in votes}
    users = {
        u.id: u
        for u in db.execute(
            select(User).where(User.id.in_(user_ids)).with_for_update()
        )
        .scalars()
        .all()
    }

    # 3. 각 투표 정산
    settled_count = 0
    for vote in votes:
        user = users[vote.user_id]
        nominal_delta, reason = _calculate_delta(vote.choice, result, vote.odds_at_vote)

        # 음수 점수 클램프 (DESIGN.md 2.5) — 적용된 실제 변동량을 기록
        applied_delta = max(0, user.pq_score + nominal_delta) - user.pq_score
        new_pq = user.pq_score + applied_delta

        db.add(
            ScoreEvent(
                user_id=user.id,
                card_id=card_id,
                vote_id=vote.id,
                delta=applied_delta,
                reason=reason,
                pq_after=new_pq,
            )
        )

        user.pq_score = new_pq

        if result != "VOID":
            user.total_votes += 1
            if vote.choice == result:
                user.total_wins += 1
                user.current_streak += 1
            else:
                user.current_streak = 0

        vote.is_settled = True
        settled_count += 1

    # 4. 등급 재계산
    for user in users.values():
        user.level_code = _determine_level(
            user.pq_score, user.total_votes, user.total_wins, levels
        )

    db.flush()
    return settled_count
