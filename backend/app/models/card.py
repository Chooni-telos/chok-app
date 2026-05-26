import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class PredictionCard(Base):
    __tablename__ = "prediction_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin_language: Mapped[str] = mapped_column(String(5), default="ko")
    category: Mapped[str] = mapped_column(String(20))
    creator_type: Mapped[str] = mapped_column(String(10))
    creator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(15), default="open")
    duration_tier: Mapped[str] = mapped_column(String(10), default="short")
    event_start_at: Mapped[datetime | None] = mapped_column(nullable=True)
    closes_at: Mapped[datetime] = mapped_column()
    result_announce_at: Mapped[datetime | None] = mapped_column(nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    card_type: Mapped[str] = mapped_column(String(10), default="yesno")
    choices: Mapped[str] = mapped_column(Text, default='["YES","NO"]')
    yes_count: Mapped[int] = mapped_column(Integer, default=0)
    no_count: Mapped[int] = mapped_column(Integer, default=0)
    choice_counts: Mapped[str] = mapped_column(Text, default="{}")
    target_age_groups: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    final_result: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
