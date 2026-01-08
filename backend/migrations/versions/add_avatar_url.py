"""add_avatar_url

Revision ID: add_avatar_url
Revises: add_email_verification
Create Date: 2025-01-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_avatar_url'
down_revision: Union[str, Sequence[str], None] = 'add_email_verification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем поле avatar_url в таблицу users
    op.add_column('users', sa.Column('avatar_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем столбец avatar_url
    op.drop_column('users', 'avatar_url')
















