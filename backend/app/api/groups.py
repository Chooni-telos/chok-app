import json
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.errors import AppError
from app.models.card import PredictionCard
from app.models.group import Group, GroupMember
from app.models.user import User
from app.models.vote import Vote
from app.services.settlement import settle_card

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])

VALID_CATEGORIES = ["시사", "스포츠", "엔터테인먼트", "경제테크", "도파민", "기타"]


def _generate_invite_code() -> str:
    return secrets.token_urlsafe(6)[:8].upper()


class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str | None = None


class GroupJoinRequest(BaseModel):
    invite_code: str = Field(..., min_length=1)


class GroupCardCreateRequest(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    category: str = "기타"
    card_type: str = Field("yesno", pattern=r"^(yesno|multichoice)$")
    choices: list[str] | None = None
    closes_at: datetime
    result_announce_at: datetime | None = None


class GroupVoteRequest(BaseModel):
    choice: str = Field(..., min_length=1)


class GroupSettleRequest(BaseModel):
    result: str


# ── 방 CRUD ──


@router.post("")
def create_group(
    body: GroupCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite_code = _generate_invite_code()
    while db.execute(select(Group).where(Group.invite_code == invite_code)).scalar_one_or_none():
        invite_code = _generate_invite_code()

    group = Group(
        id=uuid.uuid4(),
        name=body.name,
        description=body.description,
        invite_code=invite_code,
        creator_id=user.id,
    )
    db.add(group)
    db.add(GroupMember(
        id=uuid.uuid4(),
        group_id=group.id,
        user_id=user.id,
        role="owner",
    ))
    db.commit()
    db.refresh(group)
    return _group_response(group, "owner")


@router.get("")
def list_my_groups(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Group, GroupMember.role)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user.id)
        .order_by(Group.created_at.desc())
    ).all()
    return [_group_response(g, role) for g, role in rows]


@router.get("/{group_id}")
def get_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)
    if not group:
        raise AppError("NOT_FOUND", "방을 찾을 수 없습니다.", 404)
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)

    members = db.execute(
        select(GroupMember, User.nickname)
        .join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.joined_at)
    ).all()

    return {
        **_group_response(group, member.role),
        "members": [
            {"user_id": str(m.user_id), "nickname": nick, "role": m.role}
            for m, nick in members
        ],
    }


@router.post("/join")
def join_group(
    body: GroupJoinRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.execute(
        select(Group).where(Group.invite_code == body.invite_code.upper())
    ).scalar_one_or_none()
    if not group:
        raise AppError("NOT_FOUND", "유효하지 않은 초대 코드입니다.", 404)

    existing = _get_member(db, group.id, user.id)
    if existing:
        return _group_response(group, existing.role)

    db.add(GroupMember(
        id=uuid.uuid4(),
        group_id=group.id,
        user_id=user.id,
        role="member",
    ))
    group.member_count += 1
    db.commit()
    db.refresh(group)
    return _group_response(group, "member")


class GroupUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


@router.patch("/{group_id}")
def update_group(
    group_id: uuid.UUID,
    body: GroupUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member or member.role != "owner":
        raise AppError("FORBIDDEN", "방장만 방 이름을 변경할 수 있습니다.", 403)
    group = db.get(Group, group_id)
    if not group:
        raise AppError("NOT_FOUND", "방을 찾을 수 없습니다.", 404)
    group.name = body.name
    db.commit()
    db.refresh(group)
    return _group_response(group, "owner")


@router.delete("/{group_id}/leave")
def leave_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("NOT_FOUND", "이 방의 멤버가 아닙니다.", 404)
    if member.role == "owner":
        raise AppError("CONFLICT", "방장은 방을 나갈 수 없습니다. 방을 삭제해주세요.", 409)
    db.delete(member)
    group = db.get(Group, group_id)
    if group:
        group.member_count = max(0, group.member_count - 1)
    db.commit()
    return {"ok": True}


# ── 방 내 카드 ──


@router.post("/{group_id}/cards")
def create_group_card(
    group_id: uuid.UUID,
    body: GroupCardCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)

    card_type = body.card_type
    if card_type == "multichoice" and body.choices and len(body.choices) >= 2:
        choices = body.choices
    else:
        choices = ["YES", "NO"]
        card_type = "yesno"

    card = PredictionCard(
        id=uuid.uuid4(),
        title=body.title,
        description=body.description,
        category=body.category if body.category in VALID_CATEGORIES else "기타",
        creator_type="user",
        creator_id=user.id,
        group_id=group_id,
        status="open",
        duration_tier="short",
        closes_at=body.closes_at,
        result_announce_at=body.result_announce_at,
        card_type=card_type,
        choices=json.dumps(choices, ensure_ascii=False),
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _card_response(card, user_id=user.id, db=db)


@router.get("/{group_id}/cards")
def list_group_cards(
    group_id: uuid.UUID,
    status: str = Query("", pattern=r"^(open|closed|settled|)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)

    cards = db.execute(
        select(PredictionCard)
        .where(PredictionCard.group_id == group_id, *([PredictionCard.status == status] if status else []))
        .order_by(PredictionCard.created_at.desc())
    ).scalars().all()

    card_ids = [c.id for c in cards]
    my_votes: dict[uuid.UUID, str] = {}
    if card_ids:
        rows = db.execute(
            select(Vote.card_id, Vote.choice)
            .where(Vote.user_id == user.id, Vote.card_id.in_(card_ids))
        ).all()
        my_votes = {r.card_id: r.choice for r in rows}

    creator_names: dict[uuid.UUID, str] = {}
    creator_ids = {c.creator_id for c in cards if c.creator_id}
    if creator_ids:
        name_rows = db.execute(
            select(User.id, User.nickname).where(User.id.in_(creator_ids))
        ).all()
        creator_names = {r.id: r.nickname for r in name_rows}

    member_results: dict[uuid.UUID, list[dict]] = {}
    settled_ids = [c.id for c in cards if c.status == "settled"]
    if settled_ids:
        vote_rows = db.execute(
            select(Vote, User.nickname)
            .join(User, User.id == Vote.user_id)
            .where(Vote.card_id.in_(settled_ids))
            .order_by(Vote.created_at)
        ).all()
        for v, nick in vote_rows:
            card = next((c for c in cards if c.id == v.card_id), None)
            hit = card.final_result is not None and v.choice == card.final_result if card else False
            member_results.setdefault(v.card_id, []).append({
                "user_id": str(v.user_id),
                "nickname": nick or "익명",
                "choice": v.choice,
                "hit": hit,
            })

    return {
        "items": [
            {
                **_card_dict(c),
                "my_vote": my_votes.get(c.id),
                "creator_nickname": creator_names.get(c.creator_id),
                "is_mine": c.creator_id == user.id,
                "member_results": member_results.get(c.id, []) if c.status == "settled" else [],
            }
            for c in cards
        ]
    }


@router.post("/{group_id}/cards/{card_id}/vote")
def vote_group_card(
    group_id: uuid.UUID,
    card_id: uuid.UUID,
    body: GroupVoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.api.votes import cast_vote
    from app.schemas.vote import VoteRequest

    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)
    card = db.get(PredictionCard, card_id)
    if not card or card.group_id != group_id:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)

    return cast_vote(card_id, VoteRequest(choice=body.choice), user, db)


@router.post("/{group_id}/cards/{card_id}/close")
def close_group_card(
    group_id: uuid.UUID,
    card_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)
    card = db.get(PredictionCard, card_id)
    if not card or card.group_id != group_id:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)
    if card.creator_id != user.id:
        raise AppError("FORBIDDEN", "출제자만 조기 마감할 수 있습니다.", 403)
    if card.status != "open":
        raise AppError("CONFLICT", f"카드 상태가 '{card.status}'이므로 마감할 수 없습니다.", 409)

    card.status = "closed"
    card.closes_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": str(card.id), "status": "closed"}


@router.post("/{group_id}/cards/{card_id}/settle")
def settle_group_card(
    group_id: uuid.UUID,
    card_id: uuid.UUID,
    body: GroupSettleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)
    card = db.get(PredictionCard, card_id)
    if not card or card.group_id != group_id:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)
    if card.creator_id != user.id and member.role != "owner":
        raise AppError("FORBIDDEN", "출제자 또는 방장만 정답을 입력할 수 있습니다.", 403)

    settled_count = settle_card(db, card_id, body.result)
    db.commit()
    db.refresh(card)
    return {"settled_votes": settled_count, "final_result": card.final_result}


# ── 방 내 랭킹 ──


@router.get("/{group_id}/leaderboard")
def group_leaderboard(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = _get_member(db, group_id, user.id)
    if not member:
        raise AppError("FORBIDDEN", "이 방의 멤버가 아닙니다.", 403)

    from app.models.score_event import ScoreEvent

    group_card_ids = db.execute(
        select(PredictionCard.id).where(PredictionCard.group_id == group_id)
    ).scalars().all()

    if not group_card_ids:
        members = db.execute(
            select(GroupMember, User.nickname)
            .join(User, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == group_id)
        ).all()
        return {
            "items": [
                {"rank": i + 1, "user_id": str(m.user_id), "nickname": nick, "score": 0, "wins": 0, "votes": 0}
                for i, (m, nick) in enumerate(members)
            ]
        }

    rows = db.execute(
        select(
            ScoreEvent.user_id,
            func.sum(ScoreEvent.delta).label("score"),
            func.count().label("votes"),
        )
        .where(ScoreEvent.card_id.in_(group_card_ids))
        .group_by(ScoreEvent.user_id)
    ).all()

    score_map = {r.user_id: {"score": r.score or 0, "votes": r.votes} for r in rows}

    win_rows = db.execute(
        select(ScoreEvent.user_id, func.count().label("wins"))
        .where(ScoreEvent.card_id.in_(group_card_ids), ScoreEvent.reason.in_(["hit", "underdog_bonus"]))
        .group_by(ScoreEvent.user_id)
    ).all()
    win_map = {r.user_id: r.wins for r in win_rows}

    members = db.execute(
        select(GroupMember, User.nickname)
        .join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
    ).all()

    items = []
    for m, nick in members:
        s = score_map.get(m.user_id, {"score": 0, "votes": 0})
        wins = win_map.get(m.user_id, 0)
        votes = s["votes"]
        items.append({
            "user_id": str(m.user_id),
            "nickname": nick,
            "score": s["score"],
            "wins": wins,
            "votes": votes,
            "win_rate": round(wins / votes, 3) if votes > 0 else 0.0,
        })
    items.sort(key=lambda x: (-x["win_rate"], -x["wins"], -x["score"]))
    for i, item in enumerate(items):
        item["rank"] = i + 1

    return {"items": items}


# ── 헬퍼 ──


def _get_member(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember | None:
    return db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    ).scalar_one_or_none()


def _group_response(group: Group, role: str) -> dict:
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "invite_code": group.invite_code,
        "member_count": group.member_count,
        "role": role,
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def _utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _card_dict(c: PredictionCard) -> dict:
    return {
        "id": str(c.id),
        "title": c.title,
        "description": c.description,
        "category": c.category,
        "status": c.status,
        "card_type": c.card_type,
        "choices": json.loads(c.choices) if c.choices else ["YES", "NO"],
        "yes_count": c.yes_count,
        "no_count": c.no_count,
        "choice_counts": json.loads(c.choice_counts) if c.choice_counts else {},
        "closes_at": _utc_iso(c.closes_at),
        "result_announce_at": _utc_iso(c.result_announce_at),
        "final_result": c.final_result,
        "image_url": c.image_url,
        "created_at": _utc_iso(c.created_at),
    }


def _card_response(card: PredictionCard, user_id: uuid.UUID, db: Session) -> dict:
    my_vote = db.execute(
        select(Vote.choice).where(Vote.user_id == user_id, Vote.card_id == card.id)
    ).scalar_one_or_none()
    return {**_card_dict(card), "my_vote": my_vote}
