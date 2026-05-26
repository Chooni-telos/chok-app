import json
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.errors import AppError
from app.models.card import PredictionCard
from app.models.score_event import ScoreEvent
from app.models.user import User
from app.models.vote import Vote
from app.schemas.user import ChangePasswordRequest, MyStats, UpdateMeRequest, UserProfile, VoteHistoryItem

router = APIRouter(prefix="/api/v1", tags=["users"])


def _win_rate(u: User) -> float:
    return round(u.total_wins / u.total_votes, 3) if u.total_votes > 0 else 0.0


@router.get("/me", response_model=MyStats)
def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total_predictions = db.execute(
        select(func.count()).select_from(Vote).where(Vote.user_id == user.id)
    ).scalar() or 0
    wr = _win_rate(user)
    return MyStats(
        id=str(user.id),
        nickname=user.nickname,
        email=user.email,
        age_group=user.age_group,
        gender=user.gender,
        interests=json.loads(user.interests) if user.interests else [],
        pq_score=user.pq_score,
        level_code=user.level_code,
        total_predictions=total_predictions,
        total_votes=user.total_votes,
        total_wins=user.total_wins,
        win_rate=wr,
        current_streak=user.current_streak,
        is_cursed=user.total_votes >= 20 and wr < 0.30,
        preferred_language=user.preferred_language,
    )


@router.patch("/me")
def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.nickname is not None:
        existing = db.execute(
            select(User).where(User.nickname == body.nickname, User.id != user.id)
        ).scalar_one_or_none()
        if existing:
            raise AppError("CONFLICT", "이미 사용 중인 닉네임입니다.", 409)
        user.nickname = body.nickname
    if body.email is not None:
        user.email = body.email
    if body.age_group is not None:
        user.age_group = body.age_group
    if body.gender is not None:
        user.gender = body.gender
    if body.interests is not None:
        user.interests = json.dumps(body.interests, ensure_ascii=False)
    if body.preferred_language is not None:
        user.preferred_language = body.preferred_language
    db.commit()
    db.refresh(user)
    return {
        "nickname": user.nickname,
        "email": user.email,
        "age_group": user.age_group,
        "gender": user.gender,
        "preferred_language": user.preferred_language,
    }


@router.post("/me/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import hashlib

    if not user.password_hash:
        raise AppError("VALIDATION_ERROR", "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.", 422)
    current_hash = hashlib.sha256(body.current_password.encode()).hexdigest()
    if current_hash != user.password_hash:
        raise AppError("UNAUTHORIZED", "현재 비밀번호가 올바르지 않습니다.", 401)
    user.password_hash = hashlib.sha256(body.new_password.encode()).hexdigest()
    db.commit()
    return {"ok": True}


@router.get("/me/history")
def get_my_history(
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        select(Vote, PredictionCard.title, PredictionCard.final_result, ScoreEvent.delta, ScoreEvent.pq_after)
        .join(PredictionCard, Vote.card_id == PredictionCard.id)
        .outerjoin(ScoreEvent, ScoreEvent.vote_id == Vote.id)
        .where(Vote.user_id == user.id)
        .order_by(Vote.created_at.desc())
    )
    if cursor:
        from datetime import datetime

        try:
            q = q.where(Vote.created_at < datetime.fromisoformat(cursor))
        except ValueError:
            pass

    rows = db.execute(q.limit(limit + 1)).all()
    has_more = len(rows) > limit

    items = [
        VoteHistoryItem(
            card_id=str(vote.card_id),
            card_title=card_title,
            choice=vote.choice,
            final_result=final_result,
            delta=delta,
            pq_after=pq_after,
            voted_at=vote.created_at.isoformat(),
            settled=vote.is_settled,
        )
        for vote, card_title, final_result, delta, pq_after in rows[:limit]
    ]
    return {
        "items": items,
        "next_cursor": rows[limit - 1][0].created_at.isoformat() if has_more else None,
    }


@router.get("/users/{user_id}", response_model=UserProfile)
def get_user_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if u is None:
        raise AppError("NOT_FOUND", "유저를 찾을 수 없습니다.", 404)
    return UserProfile(
        id=str(u.id),
        nickname=u.nickname,
        pq_score=u.pq_score,
        level_code=u.level_code,
        total_votes=u.total_votes,
        total_wins=u.total_wins,
        win_rate=_win_rate(u),
    )
