import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_admin_user
from app.core.database import get_db
from app.core.errors import AppError
from app.models.card import PredictionCard
from app.models.user import User
from app.schemas.admin import SettleRequest, SettleResponse
from app.schemas.card import CardListItem
from app.services.settlement import settle_card

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024

VALID_CATEGORIES = ["시사", "스포츠", "엔터테인먼트", "경제테크", "도파민"]


def _upload_to_s3(data: bytes, filename: str, content_type: str) -> str:
    import boto3
    from app.core.config import settings
    s3 = boto3.client("s3", region_name=settings.S3_REGION)
    key = f"cards/{filename}"
    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/{key}"


def _upload_local(data: bytes, filename: str) -> str:
    upload_dir = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "cards"
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / filename).write_bytes(data)
    return f"/cards/{filename}"


@router.post("/upload", summary="이미지 업로드 (어드민 전용)")
async def admin_upload_image(
    file: UploadFile,
    _admin: User = Depends(get_admin_user),
):
    from app.core.config import settings

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppError("VALIDATION_ERROR", f"허용 확장자: {', '.join(ALLOWED_EXTENSIONS)}", 422)

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise AppError("VALIDATION_ERROR", "파일 크기는 5MB 이하여야 합니다.", 422)

    filename = f"{uuid.uuid4()}{ext}"
    content_type = file.content_type or "image/png"

    if settings.S3_BUCKET:
        image_url = _upload_to_s3(data, filename, content_type)
    else:
        image_url = _upload_local(data, filename)

    return {"image_url": image_url}


class AdminCardCreate(BaseModel):
    title: str = Field(..., max_length=200, description="예측 질문")
    description: str | None = Field(None, description="상세 설명 (선택)")
    category: str = Field(..., description="시사 / 스포츠 / 엔터테인먼트 / 경제테크 / 도파민")
    event_start_at: datetime = Field(..., description="시작 일시")
    closes_at: datetime = Field(..., description="투표 마감 일시")
    result_announce_at: datetime | None = Field(None, description="결과 발표 일시")
    image_url: str | None = Field(None, description="이미지 URL (선택)")
    card_type: str = Field("yesno", description="yesno 또는 multichoice")
    choices: list[str] | None = Field(None, description="객관식 선택지 목록")
    target_age_groups: list[str] | None = Field(None, description="대상 연령대 (복수)")


class AdminCardResponse(BaseModel):
    id: str
    title: str
    category: str
    status: str
    event_start_at: datetime | None = None
    closes_at: datetime
    result_announce_at: datetime | None = None
    image_url: str | None = None
    card_type: str = "yesno"
    choices: list[str] = ["YES", "NO"]
    target_age_groups: list[str] = []


@router.post("/cards", response_model=AdminCardResponse, summary="카드 등록 (어드민 전용)")
def admin_create_card(
    body: AdminCardCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if body.category not in VALID_CATEGORIES:
        raise AppError("VALIDATION_ERROR", f"카테고리는 {VALID_CATEGORIES} 중 하나여야 합니다.", 422)
    if body.closes_at <= body.event_start_at:
        raise AppError("VALIDATION_ERROR", "마감 일시는 시작 일시 이후여야 합니다.", 422)

    card_type = body.card_type if body.card_type in ("yesno", "multichoice") else "yesno"
    if card_type == "multichoice" and body.choices and len(body.choices) >= 2:
        choices = body.choices
    else:
        choices = ["YES", "NO"]

    card = PredictionCard(
        id=uuid.uuid4(),
        title=body.title,
        description=body.description,
        category=body.category,
        creator_type="admin",
        creator_id=admin.id,
        status="open",
        duration_tier="short",
        event_start_at=body.event_start_at,
        closes_at=body.closes_at,
        result_announce_at=body.result_announce_at,
        image_url=body.image_url,
        card_type=card_type,
        choices=json.dumps(choices, ensure_ascii=False),
        target_age_groups=json.dumps(body.target_age_groups, ensure_ascii=False) if body.target_age_groups else None,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return AdminCardResponse(
        id=str(card.id),
        title=card.title,
        category=card.category,
        status=card.status,
        event_start_at=card.event_start_at,
        closes_at=card.closes_at,
        result_announce_at=card.result_announce_at,
        image_url=card.image_url,
        card_type=card.card_type,
        choices=json.loads(card.choices) if card.choices else ["YES", "NO"],
        target_age_groups=json.loads(card.target_age_groups) if card.target_age_groups else [],
    )


@router.get("/cards", summary="전체 카드 목록 조회 (어드민 전용)")
def admin_list_cards(
    status: str = Query("open", pattern=r"^(open|closed|settled)$"),
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    cards = db.execute(
        select(PredictionCard)
        .where(PredictionCard.status == status)
        .order_by(PredictionCard.created_at.desc())
    ).scalars().all()

    def ratio(c: PredictionCard) -> float:
        t = c.yes_count + c.no_count
        return round(c.yes_count / t, 4) if t > 0 else 0.5

    return [
        {
            **CardListItem(
                id=str(c.id),
                title=c.title,
                category=c.category,
                status=c.status,
                closes_at=c.closes_at,
                card_type=c.card_type,
                choices=json.loads(c.choices) if c.choices else ["YES", "NO"],
                yes_count=c.yes_count,
                no_count=c.no_count,
                yes_ratio=ratio(c),
                choice_counts=json.loads(c.choice_counts) if c.choice_counts else {},
                duration_tier=c.duration_tier,
                image_url=c.image_url,
                final_result=c.final_result,
            ).model_dump(),
            "target_age_groups": json.loads(c.target_age_groups) if c.target_age_groups else [],
            "result_announce_at": c.result_announce_at.isoformat() if c.result_announce_at else None,
        }
        for c in cards
    ]


class AdminCardUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    category: str | None = None
    event_start_at: datetime | None = None
    closes_at: datetime | None = None
    result_announce_at: datetime | None = None
    image_url: str | None = None
    clear_image: bool = False
    card_type: str | None = None
    choices: list[str] | None = None
    target_age_groups: list[str] | None = None


@router.patch("/cards/{card_id}", response_model=AdminCardResponse, summary="카드 수정 (어드민 전용)")
def admin_update_card(
    card_id: UUID,
    body: AdminCardUpdate,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    card = db.get(PredictionCard, card_id)
    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)

    if body.title is not None:
        card.title = body.title
    if body.description is not None:
        card.description = body.description
    if body.category is not None:
        if body.category not in VALID_CATEGORIES:
            raise AppError("VALIDATION_ERROR", f"카테고리는 {VALID_CATEGORIES} 중 하나여야 합니다.", 422)
        card.category = body.category
    if body.event_start_at is not None:
        card.event_start_at = body.event_start_at
    if body.closes_at is not None:
        card.closes_at = body.closes_at
    if body.result_announce_at is not None:
        card.result_announce_at = body.result_announce_at
    if body.clear_image:
        card.image_url = None
    elif body.image_url is not None:
        card.image_url = body.image_url
    if body.card_type is not None and body.card_type in ("yesno", "multichoice"):
        card.card_type = body.card_type
        if body.card_type == "multichoice" and body.choices and len(body.choices) >= 2:
            card.choices = json.dumps(body.choices, ensure_ascii=False)
        elif body.card_type == "yesno":
            card.choices = json.dumps(["YES", "NO"])
    elif body.choices is not None and card.card_type == "multichoice" and len(body.choices) >= 2:
        card.choices = json.dumps(body.choices, ensure_ascii=False)
    if body.target_age_groups is not None:
        card.target_age_groups = json.dumps(body.target_age_groups, ensure_ascii=False) if body.target_age_groups else None

    db.commit()
    db.refresh(card)
    return AdminCardResponse(
        id=str(card.id),
        title=card.title,
        category=card.category,
        status=card.status,
        event_start_at=card.event_start_at,
        closes_at=card.closes_at,
        result_announce_at=card.result_announce_at,
        image_url=card.image_url,
        card_type=card.card_type,
        choices=json.loads(card.choices) if card.choices else ["YES", "NO"],
        target_age_groups=json.loads(card.target_age_groups) if card.target_age_groups else [],
    )


@router.delete("/cards/{card_id}", summary="카드 삭제 (어드민 전용)")
def admin_delete_card(
    card_id: UUID,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    card = db.get(PredictionCard, card_id)
    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)
    db.delete(card)
    db.commit()
    return {"deleted": str(card_id)}


@router.post("/cards/{card_id}/close", summary="카드 마감 (어드민 전용)")
def close_card(
    card_id: UUID,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    card = db.get(PredictionCard, card_id)
    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)
    if card.status != "open":
        raise AppError("CONFLICT", f"카드 상태가 '{card.status}'이므로 마감할 수 없습니다.", 409)

    card.status = "closed"
    db.commit()
    return {"id": str(card.id), "status": "closed"}


@router.post("/cards/{card_id}/settle", response_model=SettleResponse, summary="카드 정산 (어드민 전용)")
def settle(
    card_id: UUID,
    body: SettleRequest,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    card = db.get(PredictionCard, card_id)
    if card is None:
        raise AppError("NOT_FOUND", "카드를 찾을 수 없습니다.", 404)

    settled_count = settle_card(db, card_id, body.result)
    db.commit()
    db.refresh(card)

    return SettleResponse(
        settled_votes=settled_count,
        card_id=str(card.id),
        final_result=card.final_result or body.result,
        status=card.status,
    )
