"""add map settings

Revision ID: add_map_settings
Revises: add_user_language
Create Date: 2025-01-27 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_map_settings'
down_revision: Union[str, Sequence[str], None] = 'add_user_language'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем поля для настроек карты
    op.add_column('users', sa.Column('default_map_style', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('default_map_projection', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем поля настроек карты
    op.drop_column('users', 'default_map_projection')
    op.drop_column('users', 'default_map_style')

