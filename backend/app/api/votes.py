import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.errors import AppError
from app.models.card import PredictionCard
from app.models.user import User
from app.models.vote import Vote
from app.schemas.vote import CardVoteSummary, VoteRequest, VoteResponse

router = APIRouter(prefix="/api/v1/cards", tags=["votes"])


def _update_counts(card: PredictionCard, choice: str, delta: int):
    """카드의 yes_count/no_count 및 choice_counts를 갱신한다."""
    if choice == "YES":
        card.yes_count = max(0, card.yes_count + delta)
    elif choice == "NO":
        card.no_count = max(0, card.no_count + delta)

    counts = json.loads(card.choice_counts) if card.choice_counts else {}
    counts[choice] = max(0, counts.get(choice, 0) + delta)
    card.choice_counts = json.dumps(counts, ensure_ascii=False)


def _calc_odds(card: PredictionCard, choice: str) -> float:
    """현재 카드 카운트 기준으로 choice의 비율을 계산한다."""
    counts = json.loads(card.choice_counts) if card.choice_counts else {}
    total = sum(counts.values())
    if total <= 0:
        return 0.5
    return round(counts.get(choice, 0) / total, 4)


@router.post("/{card_id}/vote", response_model=VoteResponse)
def cast_vote(
    card_id: uuid.UUID,
    body: VoteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.execute(
        select(PredictionCard).where(PredictionCard.id == card_id).with_for_update()
    ).scalar_one_or_none()

    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)

    closes_at = card.closes_at
    if closes_at.tzinfo is None:
        closes_at = closes_at.replace(tzinfo=timezone.utc)
    if card.status != "open" or datetime.now(timezone.utc) >= closes_at:
        raise AppError("VOTE_CLOSED", "이미 마감된 카드입니다.", 409)

    valid_choices = json.loads(card.choices) if card.choices else ["YES", "NO"]
    if body.choice not in valid_choices:
        raise AppError("VALIDATION_ERROR", f"선택지는 {valid_choices} 중 하나여야 합니다.", 422)

    existing_vote = db.execute(
        select(Vote).where(Vote.user_id == user.id, Vote.card_id == card_id)
    ).scalar_one_or_none()

    if existing_vote:
        if existing_vote.is_settled:
            raise AppError("ALREADY_SETTLED", "이미 정산된 투표는 변경할 수 없습니다.", 409)
        if existing_vote.choice == body.choice:
            raise AppError("SAME_CHOICE", "이미 같은 선택을 했습니다.", 409)

        _update_counts(card, existing_vote.choice, -1)
        _update_counts(card, body.choice, +1)

        existing_vote.choice = body.choice
        existing_vote.odds_at_vote = _calc_odds(card, body.choice)
        existing_vote.created_at = datetime.now(timezone.utc)
        vote = existing_vote
    else:
        _update_counts(card, body.choice, +1)
        odds = _calc_odds(card, body.choice)

        vote = Vote(
            id=uuid.uuid4(),
            user_id=user.id,
            card_id=card_id,
            choice=body.choice,
            odds_at_vote=odds,
        )
        db.add(vote)

    db.commit()
    db.refresh(card)

    total = card.yes_count + card.no_count
    counts = json.loads(card.choice_counts) if card.choice_counts else {}
    return VoteResponse(
        choice=body.choice,
        odds_at_vote=float(vote.odds_at_vote),
        card=CardVoteSummary(
            id=str(card.id),
            yes_count=card.yes_count,
            no_count=card.no_count,
            yes_ratio=round(card.yes_count / total, 4) if total > 0 else 0.5,
            choice_counts=counts,
        ),
    )
