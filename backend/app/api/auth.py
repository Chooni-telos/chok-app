import hashlib
import uuid

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError
from app.models.user import User
from app.schemas.auth import (
    CheckUsernameRequest,
    LoginRequest,
    NicknameRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
    UserBrief,
)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _verify_password(password: str, hashed: str) -> bool:
    return _hash_password(password) == hashed

KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_URL = "https://kapi.kakao.com/v2/user/me"

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, summary="일반 회원가입")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.execute(select(User).where(User.username == body.username)).scalar_one_or_none():
        raise AppError("CONFLICT", "이미 사용 중인 아이디입니다.", 409)
    if db.execute(select(User).where(User.nickname == body.nickname)).scalar_one_or_none():
        raise AppError("CONFLICT", "이미 사용 중인 닉네임입니다.", 409)

    import json as _json

    user = User(
        id=uuid.uuid4(),
        username=body.username,
        password_hash=_hash_password(body.password),
        nickname=body.nickname,
        email=body.email,
        age_group=body.age_group,
        gender=body.gender,
        interests=_json.dumps(body.interests, ensure_ascii=False) if body.interests else None,
        provider="local",
        provider_id=body.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        needs_nickname=False,
        user=UserBrief(
            id=str(user.id),
            nickname=user.nickname,
            preferred_language=user.preferred_language,
        ),
    )


@router.post("/check-username", summary="아이디 중복 확인")
def check_username(body: CheckUsernameRequest, db: Session = Depends(get_db)):
    exists = db.execute(
        select(User).where(User.username == body.username)
    ).scalar_one_or_none() is not None
    return {"username": body.username, "available": not exists}


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.provider == "local":
        user = db.execute(
            select(User).where(User.username == body.code)
        ).scalar_one_or_none()
        if user is None or not user.password_hash or not _verify_password(body.password or "", user.password_hash):
            raise AppError("UNAUTHORIZED", "아이디 또는 비밀번호가 올바르지 않습니다.", 401)
    elif body.provider == "dev":
        if not settings.ALLOW_DEV_LOGIN:
            raise AppError("FORBIDDEN", "개발 로그인은 비활성화되어 있습니다.", 403)
        user = db.execute(
            select(User).where(User.provider == "dev", User.provider_id == body.code)
        ).scalar_one_or_none()
        if user is None:
            user = User(id=uuid.uuid4(), provider="dev", provider_id=body.code)
            db.add(user)
            db.commit()
            db.refresh(user)
    else:
        provider_id = _exchange_oauth_code(body.provider, body.code, body.redirect_uri)
        user = db.execute(
            select(User).where(User.provider == body.provider, User.provider_id == provider_id)
        ).scalar_one_or_none()
        if user is None:
            user = User(id=uuid.uuid4(), provider=body.provider, provider_id=provider_id)
            db.add(user)
            db.commit()
            db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        needs_nickname=user.nickname is None,
        user=UserBrief(
            id=str(user.id),
            nickname=user.nickname,
            preferred_language=user.preferred_language,
        ),
    )


def _exchange_oauth_code(provider: str, code: str, redirect_uri: str | None) -> str:
    if provider == "kakao":
        return _kakao_exchange(code, redirect_uri)
    raise AppError("NOT_IMPLEMENTED", f"{provider} OAuth는 아직 구현되지 않았습니다.", 501)


def _kakao_exchange(code: str, redirect_uri: str | None) -> str:
    if not settings.KAKAO_CLIENT_ID:
        raise AppError("CONFIG_ERROR", "카카오 클라이언트 ID가 설정되지 않았습니다.", 500)

    token_data = {
        "grant_type": "authorization_code",
        "client_id": settings.KAKAO_CLIENT_ID,
        "code": code,
    }
    if redirect_uri:
        token_data["redirect_uri"] = redirect_uri
    if settings.KAKAO_CLIENT_SECRET:
        token_data["client_secret"] = settings.KAKAO_CLIENT_SECRET

    token_resp = httpx.post(KAKAO_TOKEN_URL, data=token_data, timeout=10)
    if token_resp.status_code != 200:
        raise AppError("OAUTH_FAILED", "카카오 인증 코드 교환에 실패했습니다.", 401)

    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise AppError("OAUTH_FAILED", "카카오 액세스 토큰을 받지 못했습니다.", 401)

    user_resp = httpx.get(
        KAKAO_USER_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if user_resp.status_code != 200:
        raise AppError("OAUTH_FAILED", "카카오 사용자 정보를 가져올 수 없습니다.", 401)

    kakao_id = user_resp.json().get("id")
    if not kakao_id:
        raise AppError("OAUTH_FAILED", "카카오 사용자 ID를 확인할 수 없습니다.", 401)

    return str(kakao_id)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    user_id = decode_token(body.refresh_token, "refresh")
    user = db.get(User, user_id)
    if user is None:
        raise AppError("UNAUTHORIZED", "유효하지 않은 토큰입니다.", 401)

    return RefreshResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/nickname")
def set_nickname(
    body: NicknameRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(User).where(User.nickname == body.nickname, User.id != user.id)
    ).scalar_one_or_none()
    if existing:
        raise AppError("CONFLICT", "이미 사용 중인 닉네임입니다.", 409)

    user.nickname = body.nickname
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "nickname": user.nickname, "preferred_language": user.preferred_language}


@router.post("/logout")
def logout():
    return {"ok": True}
