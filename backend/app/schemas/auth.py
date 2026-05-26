from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    provider: str = Field(..., pattern=r"^(kakao|google|dev|local)$")
    code: str
    redirect_uri: str | None = None
    password: str | None = None


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=4, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=6, max_length=100)
    nickname: str = Field(..., min_length=2, max_length=20)
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    age_group: str = Field(..., pattern=r"^(10대|20대|30대|40대|50대|60대 이상)$")
    gender: str = Field(..., pattern=r"^(남성|여성)$")
    interests: list[str] = Field(default=[])


class CheckUsernameRequest(BaseModel):
    username: str = Field(..., min_length=4, max_length=30)


class UserBrief(BaseModel):
    id: str
    nickname: str | None
    preferred_language: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    needs_nickname: bool
    user: UserBrief


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str


class NicknameRequest(BaseModel):
    nickname: str = Field(..., min_length=2, max_length=20)
