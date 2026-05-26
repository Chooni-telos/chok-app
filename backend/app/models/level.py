from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Level(Base):
    __tablename__ = "levels"

    level_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    min_pq: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
