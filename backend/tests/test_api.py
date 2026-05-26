"""API 통합 테스트 — 로그인 → 투표 → 정산 → 점수 확인 플로우"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models import *  # noqa: F401,F403
from app.models.card import PredictionCard
from app.models.level import Level


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _pragma(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    session.add_all(
        [
            Level(level_code="dull", min_pq=0, sort_order=0),
            Level(level_code="rookie", min_pq=1000, sort_order=1),
            Level(level_code="sharp", min_pq=1500, sort_order=2),
            Level(level_code="genius", min_pq=2200, sort_order=3),
            Level(level_code="god", min_pq=3000, sort_order=4),
            Level(level_code="cursed", min_pq=None, sort_order=5),
        ]
    )
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _login(client: TestClient, code: str = "test-user-1") -> dict:
    r = client.post("/api/v1/auth/login", json={"provider": "dev", "code": code})
    assert r.status_code == 200
    return r.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _make_admin(db_session, user_id: str):
    from app.models.user import User
    user = db_session.get(User, uuid.UUID(user_id))
    user.is_admin = True
    db_session.commit()


def _create_card(db_session, **kw) -> str:
    card = PredictionCard(
        id=uuid.uuid4(),
        title=kw.get("title", "테스트 카드"),
        category=kw.get("category", "시사"),
        creator_type="official",
        status=kw.get("status", "open"),
        duration_tier="short",
        closes_at=kw.get("closes_at", datetime.now(timezone.utc) + timedelta(hours=1)),
    )
    db_session.add(card)
    db_session.commit()
    return str(card.id)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class TestAuth:
    def test_dev_login(self, client):
        data = _login(client)
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["needs_nickname"] is True

    def test_duplicate_login_same_user(self, client):
        d1 = _login(client, "same")
        d2 = _login(client, "same")
        assert d1["user"]["id"] == d2["user"]["id"]

    def test_set_nickname(self, client):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        r = client.post("/api/v1/auth/nickname", json={"nickname": "예언자"}, headers=h)
        assert r.status_code == 200
        assert r.json()["nickname"] == "예언자"

    def test_duplicate_nickname(self, client):
        t1 = _login(client, "u1")
        t2 = _login(client, "u2")
        client.post("/api/v1/auth/nickname", json={"nickname": "유일한이름"}, headers=_auth_header(t1["access_token"]))
        r = client.post("/api/v1/auth/nickname", json={"nickname": "유일한이름"}, headers=_auth_header(t2["access_token"]))
        assert r.status_code == 409

    def test_refresh_token(self, client):
        tokens = _login(client)
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 200
        assert r.json()["access_token"]


# ---------------------------------------------------------------------------
# Cards
# ---------------------------------------------------------------------------


class TestCards:
    def test_list_cards(self, client, db_session):
        _create_card(db_session)
        r = client.get("/api/v1/cards")
        assert r.status_code == 200
        assert len(r.json()["items"]) == 1

    def test_card_detail(self, client, db_session):
        card_id = _create_card(db_session)
        r = client.get(f"/api/v1/cards/{card_id}")
        assert r.status_code == 200
        assert r.json()["id"] == card_id

    def test_create_card(self, client):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        r = client.post(
            "/api/v1/cards",
            json={
                "title": "유저 생성 카드",
                "category": "스포츠",
                "closes_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            },
            headers=h,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "open"


# ---------------------------------------------------------------------------
# Vote
# ---------------------------------------------------------------------------


class TestVote:
    def test_cast_vote(self, client, db_session):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        card_id = _create_card(db_session)

        r = client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)
        assert r.status_code == 200
        assert r.json()["choice"] == "YES"
        assert r.json()["card"]["yes_count"] == 1

    def test_change_vote(self, client, db_session):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        card_id = _create_card(db_session)

        client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)
        r = client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "NO"}, headers=h)
        assert r.status_code == 200
        assert r.json()["choice"] == "NO"

    def test_same_choice_rejected(self, client, db_session):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        card_id = _create_card(db_session)

        client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)
        r = client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)
        assert r.status_code == 409

    def test_vote_closed_card(self, client, db_session):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        card_id = _create_card(db_session, closes_at=datetime.now(timezone.utc) - timedelta(hours=1))

        r = client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)
        assert r.status_code == 409


# ---------------------------------------------------------------------------
# User / Me
# ---------------------------------------------------------------------------


class TestMe:
    def test_get_me(self, client):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        r = client.get("/api/v1/me", headers=h)
        assert r.status_code == 200
        assert r.json()["pq_score"] == 1000

    def test_update_language(self, client):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        r = client.patch("/api/v1/me", json={"preferred_language": "en"}, headers=h)
        assert r.status_code == 200
        assert r.json()["preferred_language"] == "en"


# ---------------------------------------------------------------------------
# Admin settle
# ---------------------------------------------------------------------------


class TestAdminSettle:
    def test_close_and_settle(self, client, db_session):
        tokens = _login(client)
        h = _auth_header(tokens["access_token"])
        _make_admin(db_session, tokens["user"]["id"])
        card_id = _create_card(db_session)

        # 투표
        client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h)

        # 강제 마감
        r = client.post(f"/api/v1/admin/cards/{card_id}/close", headers=h)
        assert r.status_code == 200
        assert r.json()["status"] == "closed"

        # 정산
        r = client.post(f"/api/v1/admin/cards/{card_id}/settle", json={"result": "YES"}, headers=h)
        assert r.status_code == 200
        assert r.json()["settled_votes"] == 1

        # 점수 확인
        r = client.get("/api/v1/me", headers=h)
        assert r.json()["pq_score"] == 1050
        assert r.json()["total_wins"] == 1


# ---------------------------------------------------------------------------
# Full flow: 로그인 → 투표 → 정산 → 점수 확인
# ---------------------------------------------------------------------------


class TestFullFlow:
    def test_end_to_end(self, client, db_session):
        # 두 유저 로그인
        t1 = _login(client, "player-1")
        t2 = _login(client, "player-2")
        h1, h2 = _auth_header(t1["access_token"]), _auth_header(t2["access_token"])
        _make_admin(db_session, t1["user"]["id"])

        # 닉네임 설정
        client.post("/api/v1/auth/nickname", json={"nickname": "플레이어1"}, headers=h1)
        client.post("/api/v1/auth/nickname", json={"nickname": "플레이어2"}, headers=h2)

        # 카드 생성
        card_id = _create_card(db_session, title="BTS 컴백 1위?")

        # 투표
        client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "YES"}, headers=h1)
        client.post(f"/api/v1/cards/{card_id}/vote", json={"choice": "NO"}, headers=h2)

        # 카드 목록에서 내 투표 확인
        r = client.get("/api/v1/cards", headers=h1)
        item = r.json()["items"][0]
        assert item["my_vote"] == "YES"
        assert item["yes_count"] == 1
        assert item["no_count"] == 1

        # 마감 + 정산 (YES 승)
        client.post(f"/api/v1/admin/cards/{card_id}/close", headers=h1)
        r = client.post(f"/api/v1/admin/cards/{card_id}/settle", json={"result": "YES"}, headers=h1)
        assert r.json()["settled_votes"] == 2

        # 결과 확인
        me1 = client.get("/api/v1/me", headers=h1).json()
        me2 = client.get("/api/v1/me", headers=h2).json()

        assert me1["pq_score"] == 1050  # 적중 +50 (50:50이라 역배 없음)
        assert me1["total_wins"] == 1
        assert me2["pq_score"] == 970   # 실패 -30
        assert me2["total_wins"] == 0

        # 랭킹
        r = client.get("/api/v1/leaderboard", headers=h1)
        lb = r.json()
        assert len(lb["items"]) == 2
        assert lb["items"][0]["pq_score"] == 1050
