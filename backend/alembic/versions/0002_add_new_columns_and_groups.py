"""추가 컬럼 + 그룹 테이블 + 댓글 테이블

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users 추가 컬럼
    op.add_column("users", sa.Column("username", sa.String(30), unique=True, nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("age_group", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("interests", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False))

    # groups (prediction_cards FK보다 먼저 생성)
    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("invite_code", sa.String(20), unique=True, nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("member_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # group_members
    op.create_table(
        "group_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(10), server_default="member", nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # prediction_cards 추가 컬럼
    op.add_column("prediction_cards", sa.Column("card_type", sa.String(10), server_default="yesno", nullable=False))
    op.add_column("prediction_cards", sa.Column("choices", sa.Text(), server_default='["YES","NO"]', nullable=False))
    op.add_column("prediction_cards", sa.Column("choice_counts", sa.Text(), server_default='{}', nullable=False))
    op.add_column("prediction_cards", sa.Column("image_url", sa.String(500), nullable=True))
    op.add_column("prediction_cards", sa.Column("target_age_groups", sa.Text(), nullable=True))
    op.add_column("prediction_cards", sa.Column("result_announce_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("prediction_cards", sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=True))
    op.alter_column("prediction_cards", "final_result", type_=sa.String(50))

    # votes: choice 컬럼 사이즈 확장
    op.alter_column("votes", "choice", type_=sa.String(50))

    # comments
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prediction_cards.id"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("group_members")
    op.drop_table("groups")
    op.drop_table("comments")

    op.drop_column("prediction_cards", "group_id")
    op.drop_column("prediction_cards", "result_announce_at")
    op.drop_column("prediction_cards", "target_age_groups")
    op.drop_column("prediction_cards", "image_url")
    op.drop_column("prediction_cards", "choice_counts")
    op.drop_column("prediction_cards", "choices")
    op.drop_column("prediction_cards", "card_type")

    op.drop_column("users", "is_admin")
    op.drop_column("users", "interests")
    op.drop_column("users", "gender")
    op.drop_column("users", "age_group")
    op.drop_column("users", "email")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")
