import uuid
from datetime import datetime

from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("provider", "provider_id", name="uq_users_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nickname: Mapped[str | None] = mapped_column(
        String(20), unique=True, nullable=True
    )
    username: Mapped[str | None] = mapped_column(
        String(30), unique=True, nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    email: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    age_group: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )
    gender: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )
    interests: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    provider: Mapped[str] = mapped_column(String(20))
    provider_id: Mapped[str] = mapped_column(String(255))
    pq_score: Mapped[int] = mapped_column(Integer, default=1000)
    level_code: Mapped[str] = mapped_column(String(30), default="rookie")
    total_votes: Mapped[int] = mapped_column(Integer, default=0)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    preferred_language: Mapped[str] = mapped_column(String(5), default="ko")
    is_admin: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
