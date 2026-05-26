import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.core.database import get_db
from app.core.errors import AppError
from app.models.comment import Comment
from app.models.user import User

router = APIRouter(prefix="/api/v1/cards", tags=["comments"])


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=200)


class CommentItem(BaseModel):
    id: str
    user_id: str
    nickname: str | None
    content: str
    created_at: str
    is_mine: bool


class CommentListResponse(BaseModel):
    items: list[CommentItem]
    total: int


@router.post("/{card_id}/comments", summary="댓글 등록")
def create_comment(
    card_id: uuid.UUID,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Comment).where(Comment.user_id == user.id, Comment.card_id == card_id)
    ).scalar_one_or_none()
    if existing:
        raise AppError("ALREADY_COMMENTED", "이미 이 카드에 댓글을 작성했습니다.", 409)

    comment = Comment(
        id=uuid.uuid4(),
        user_id=user.id,
        card_id=card_id,
        content=body.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": str(comment.id),
        "content": comment.content,
        "created_at": str(comment.created_at),
    }


@router.get("/{card_id}/comments", response_model=CommentListResponse, summary="댓글 조회")
def list_comments(
    card_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    total = db.execute(
        select(func.count()).select_from(Comment).where(Comment.card_id == card_id)
    ).scalar() or 0

    rows = db.execute(
        select(Comment, User.nickname)
        .join(User, Comment.user_id == User.id)
        .where(Comment.card_id == card_id)
        .order_by(Comment.created_at.desc())
        .limit(limit)
    ).all()

    current_user_id = user.id if user else None
    items = [
        CommentItem(
            id=str(c.id),
            user_id=str(c.user_id),
            nickname=nickname,
            content=c.content,
            created_at=str(c.created_at),
            is_mine=c.user_id == current_user_id,
        )
        for c, nickname in rows
    ]

    return CommentListResponse(items=items, total=total)


@router.delete("/{card_id}/comments/{comment_id}", summary="댓글 삭제")
def delete_comment(
    card_id: uuid.UUID,
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.get(Comment, comment_id)
    if comment is None or comment.card_id != card_id:
        raise AppError("NOT_FOUND", "댓글을 찾을 수 없습니다.", 404)
    if comment.user_id != user.id:
        raise AppError("FORBIDDEN", "본인의 댓글만 삭제할 수 있습니다.", 403)

    db.delete(comment)
    db.commit()
    return {"deleted": str(comment_id)}
