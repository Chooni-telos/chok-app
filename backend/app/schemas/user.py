from pydantic import BaseModel, Field


class MyStats(BaseModel):
    id: str
    nickname: str | None
    email: str | None
    age_group: str | None
    gender: str | None
    interests: list[str]
    pq_score: int
    level_code: str
    total_predictions: int
    total_votes: int
    total_wins: int
    win_rate: float
    current_streak: int
    is_cursed: bool
    preferred_language: str


class UserProfile(BaseModel):
    id: str
    nickname: str | None
    pq_score: int
    level_code: str
    total_votes: int
    total_wins: int
    win_rate: float


class UpdateMeRequest(BaseModel):
    nickname: str | None = Field(None, min_length=2, max_length=20)
    email: str | None = None
    age_group: str | None = None
    gender: str | None = None
    interests: list[str] | None = None
    preferred_language: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class VoteHistoryItem(BaseModel):
    card_id: str
    card_title: str
    choice: str
    final_result: str | None
    delta: int | None
    pq_after: int | None
    voted_at: str
    settled: bool
