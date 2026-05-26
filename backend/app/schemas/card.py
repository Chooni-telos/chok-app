from datetime import datetime

from pydantic import BaseModel, Field


class CardListItem(BaseModel):
    id: str
    title: str
    category: str
    status: str
    closes_at: datetime
    result_announce_at: datetime | None = None
    card_type: str = "yesno"
    choices: list[str] = ["YES", "NO"]
    yes_count: int
    no_count: int
    yes_ratio: float
    choice_counts: dict[str, int] = {}
    my_vote: str | None = None
    duration_tier: str
    image_url: str | None = None
    comment_count: int = 0
    final_result: str | None = None


class CardListResponse(BaseModel):
    items: list[CardListItem]
    next_cursor: str | None = None


class CardDetail(CardListItem):
    description: str | None = None
    event_start_at: datetime | None = None
    settled_at: datetime | None = None
    final_result: str | None = None
    created_at: datetime


class CardCreateRequest(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    category: str
    event_start_at: datetime | None = None
    closes_at: datetime | None = None
    origin_language: str = "ko"


class CardCreateResponse(BaseModel):
    id: str
    status: str
    closes_at: datetime
