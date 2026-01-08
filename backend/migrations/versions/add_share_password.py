"""add_share_password

Revision ID: add_share_password
Revises: add_share_hash
Create Date: 2025-01-27 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_share_password'
down_revision: Union[str, Sequence[str], None] = 'add_share_hash'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем поле share_password в таблицу hecras_projects
    op.add_column('hecras_projects', sa.Column('share_password', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем столбец share_password
    op.drop_column('hecras_projects', 'share_password')










