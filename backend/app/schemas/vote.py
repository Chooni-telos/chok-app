from pydantic import BaseModel, Field


class VoteRequest(BaseModel):
    choice: str = Field(..., min_length=1, max_length=50)


class CardVoteSummary(BaseModel):
    id: str
    yes_count: int
    no_count: int
    yes_ratio: float
    choice_counts: dict[str, int] = {}


class VoteResponse(BaseModel):
    choice: str
    odds_at_vote: float
    card: CardVoteSummary
