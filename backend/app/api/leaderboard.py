from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_optional
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("")
def get_leaderboard(
    period: str = Query("weekly", pattern=r"^(weekly|monthly|all)$"),
    cursor: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    # MVP: 전체 PQ 기반 랭킹 (period별 score_events 합산은 추후)
    users = (
        db.execute(
            select(User)
            .order_by(User.pq_score.desc(), User.created_at.asc())
            .offset(cursor)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    items = [
        {
            "rank": cursor + i + 1,
            "user_id": str(u.id),
            "nickname": u.nickname,
            "pq_score": u.pq_score,
            "level_code": u.level_code,
            "win_rate": round(u.total_wins / u.total_votes, 3) if u.total_votes > 0 else 0.0,
        }
        for i, u in enumerate(users)
    ]

    total_users = db.execute(select(func.count()).select_from(User)).scalar()

    my_rank = None
    if user:
        above = db.execute(
            select(func.count())
            .select_from(User)
            .where(User.pq_score > user.pq_score)
        ).scalar()
        my_rank = {
            "rank": above + 1,
            "pq_score": user.pq_score,
            "level_code": user.level_code,
            "nickname": user.nickname,
            "win_rate": round(user.total_wins / user.total_votes, 3) if user.total_votes > 0 else 0.0,
            "total_votes": user.total_votes,
        }

    return {"period": period, "items": items, "my_rank": my_rank, "total_users": total_users}
