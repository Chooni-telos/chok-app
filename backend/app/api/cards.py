import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.errors import AppError
from app.models.card import PredictionCard
from app.models.comment import Comment
from app.models.user import User
from app.models.vote import Vote
from app.schemas.card import (
    CardCreateRequest,
    CardCreateResponse,
    CardDetail,
    CardListItem,
    CardListResponse,
)

# DESIGN.md 6.3 — 카테고리별 마감 버퍼 (분)
CATEGORY_CLOSE_BUFFER_MINUTES: dict[str, int] = {
    "스포츠": 10,
    "엔터테인먼트": 30,
    "경제테크": 0,
    "시사": 0,
    "도파민": 0,
}

router = APIRouter(prefix="/api/v1/cards", tags=["cards"])


def _yes_ratio(card: PredictionCard) -> float:
    total = card.yes_count + card.no_count
    return round(card.yes_count / total, 4) if total > 0 else 0.5


@router.get("", response_model=CardListResponse)
def list_cards(
    status: str = Query("open", pattern=r"^(open|closed|settled)$"),
    category: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    q = (
        select(PredictionCard)
        .where(PredictionCard.status == status, PredictionCard.duration_tier == "short", PredictionCard.group_id == None)  # noqa: E711
        .order_by(PredictionCard.created_at.desc())
    )
    if category:
        q = q.where(PredictionCard.category == category)
    if cursor:
        try:
            q = q.where(PredictionCard.created_at < datetime.fromisoformat(cursor))
        except ValueError:
            pass

    fetch_limit = limit + 1 if cursor else 200
    all_cards = db.execute(q.limit(fetch_limit)).scalars().all()

    if user and not category and not cursor:
        user_interests: list[str] = []
        if user.interests:
            try:
                user_interests = json.loads(user.interests)
            except (json.JSONDecodeError, TypeError):
                pass
        user_age = user.age_group

        def relevance(c: PredictionCard) -> int:
            score = 0
            if user_interests and c.category in user_interests:
                score += 2
            if user_age and c.target_age_groups:
                try:
                    ages = json.loads(c.target_age_groups)
                    if user_age in ages:
                        score += 1
                except (json.JSONDecodeError, TypeError):
                    pass
            return score

        all_cards.sort(key=lambda c: (-relevance(c), -c.created_at.timestamp()))

    cards = all_cards[:limit + 1]
    card_ids = [c.id for c in cards[:limit]]

    my_votes: dict[uuid.UUID, str] = {}
    if user and card_ids:
        rows = db.execute(
            select(Vote.card_id, Vote.choice)
            .where(Vote.user_id == user.id, Vote.card_id.in_(card_ids))
        ).all()
        my_votes = {r.card_id: r.choice for r in rows}

    comment_counts: dict[uuid.UUID, int] = {}
    if card_ids:
        cc_rows = db.execute(
            select(Comment.card_id, func.count())
            .where(Comment.card_id.in_(card_ids))
            .group_by(Comment.card_id)
        ).all()
        comment_counts = {r[0]: r[1] for r in cc_rows}

    has_more = len(cards) > limit
    items = [
        CardListItem(
            id=str(c.id),
            title=c.title,
            category=c.category,
            status=c.status,
            closes_at=c.closes_at,
            result_announce_at=c.result_announce_at,
            card_type=c.card_type,
            choices=json.loads(c.choices) if c.choices else ["YES", "NO"],
            yes_count=c.yes_count,
            no_count=c.no_count,
            yes_ratio=_yes_ratio(c),
            choice_counts=json.loads(c.choice_counts) if c.choice_counts else {},
            my_vote=my_votes.get(c.id),
            duration_tier=c.duration_tier,
            image_url=c.image_url,
            comment_count=comment_counts.get(c.id, 0),
        )
        for c in cards[:limit]
    ]
    return CardListResponse(
        items=items,
        next_cursor=cards[limit - 1].created_at.isoformat() if has_more else None,
    )


@router.get("/{card_id}", response_model=CardDetail)
def get_card(
    card_id: uuid.UUID,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    card = db.get(PredictionCard, card_id)
    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)

    my_vote = None
    if user:
        my_vote = db.execute(
            select(Vote.choice).where(Vote.user_id == user.id, Vote.card_id == card_id)
        ).scalar_one_or_none()

    return CardDetail(
        id=str(card.id),
        title=card.title,
        description=card.description,
        category=card.category,
        status=card.status,
        closes_at=card.closes_at,
        card_type=card.card_type,
        choices=json.loads(card.choices) if card.choices else ["YES", "NO"],
        yes_count=card.yes_count,
        no_count=card.no_count,
        yes_ratio=_yes_ratio(card),
        choice_counts=json.loads(card.choice_counts) if card.choice_counts else {},
        my_vote=my_vote,
        duration_tier=card.duration_tier,
        image_url=card.image_url,
        event_start_at=card.event_start_at,
        settled_at=card.settled_at,
        final_result=card.final_result,
        created_at=card.created_at,
    )


@router.post("", response_model=CardCreateResponse)
def create_card(
    body: CardCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    closes_at = body.closes_at
    if body.event_start_at and closes_at is None:
        buffer = CATEGORY_CLOSE_BUFFER_MINUTES.get(body.category, 0)
        closes_at = body.event_start_at - timedelta(minutes=buffer)
    if closes_at is None:
        raise AppError("VALIDATION_ERROR", "closes_at이 필요합니다.", 422)

    card = PredictionCard(
        id=uuid.uuid4(),
        title=body.title,
        description=body.description,
        origin_language=body.origin_language,
        category=body.category,
        creator_type="user",
        creator_id=user.id,
        duration_tier="short",
        event_start_at=body.event_start_at,
        closes_at=closes_at,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return CardCreateResponse(id=str(card.id), status=card.status, closes_at=card.closes_at)
