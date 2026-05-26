from pydantic import BaseModel, Field


class SettleRequest(BaseModel):
    result: str = Field(..., min_length=1, max_length=50)


class SettleResponse(BaseModel):
    settled_votes: int
    card_id: str
    final_result: str
    status: str
