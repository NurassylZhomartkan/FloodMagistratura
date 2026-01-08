"""add_share_hash

Revision ID: add_share_hash
Revises: add_user_language
Create Date: 2025-01-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_share_hash'
down_revision: Union[str, Sequence[str], None] = 'add_user_language'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем поле share_hash в таблицу hecras_projects
    op.add_column('hecras_projects', sa.Column('share_hash', sa.String(), nullable=True))
    # Создаем индекс для быстрого поиска по share_hash
    op.create_index(op.f('ix_hecras_projects_share_hash'), 'hecras_projects', ['share_hash'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем индекс
    op.drop_index(op.f('ix_hecras_projects_share_hash'), table_name='hecras_projects')
    # Удаляем столбец share_hash
    op.drop_column('hecras_projects', 'share_hash')











