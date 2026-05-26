"""초기 스키마 — 테이블 7개 생성 + levels 시드 데이터

Revision ID: 0001
Revises:
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nickname", sa.String(20), unique=True, nullable=True),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_id", sa.String(255), nullable=False),
        sa.Column("pq_score", sa.Integer(), server_default="1000", nullable=False),
        sa.Column("level_code", sa.String(30), server_default="rookie", nullable=False),
        sa.Column("total_votes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_wins", sa.Integer(), server_default="0", nullable=False),
        sa.Column("current_streak", sa.Integer(), server_default="0", nullable=False),
        sa.Column("preferred_language", sa.String(5), server_default="ko", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("provider", "provider_id", name="uq_users_provider"),
    )

    op.create_table(
        "prediction_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("origin_language", sa.String(5), server_default="ko", nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("creator_type", sa.String(10), nullable=False),
        sa.Column(
            "creator_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(15), server_default="open", nullable=False),
        sa.Column("duration_tier", sa.String(10), server_default="short", nullable=False),
        sa.Column("event_start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("yes_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("no_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("final_result", sa.String(5), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "card_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("prediction_cards.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("choice", sa.String(5), nullable=False),
        sa.Column("odds_at_vote", sa.Numeric(5, 4), nullable=False),
        sa.Column("is_settled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "card_id", name="uq_votes_user_card"),
    )

    op.create_table(
        "score_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "card_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("prediction_cards.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "vote_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("votes.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("pq_after", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "levels",
        sa.Column("level_code", sa.String(30), primary_key=True),
        sa.Column("min_pq", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
    )

    op.create_table(
        "card_translations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "card_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("prediction_cards.id"),
            nullable=False,
        ),
        sa.Column("language", sa.String(5), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("card_id", "language", name="uq_card_translations_card_lang"),
    )

    op.create_table(
        "device_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(10), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.bulk_insert(
        sa.table(
            "levels",
            sa.column("level_code", sa.String),
            sa.column("min_pq", sa.Integer),
            sa.column("sort_order", sa.Integer),
        ),
        [
            {"level_code": "dull", "min_pq": 0, "sort_order": 0},
            {"level_code": "rookie", "min_pq": 1000, "sort_order": 1},
            {"level_code": "sharp", "min_pq": 1500, "sort_order": 2},
            {"level_code": "genius", "min_pq": 2200, "sort_order": 3},
            {"level_code": "god", "min_pq": 3000, "sort_order": 4},
            {"level_code": "cursed", "min_pq": None, "sort_order": 5},
        ],
    )


def downgrade() -> None:
    op.drop_table("device_tokens")
    op.drop_table("card_translations")
    op.drop_table("levels")
    op.drop_table("score_events")
    op.drop_table("votes")
    op.drop_table("prediction_cards")
    op.drop_table("users")
