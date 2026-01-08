"""add_user_language

Revision ID: add_user_language
Revises: add_avatar_url
Create Date: 2025-01-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_user_language'
down_revision: Union[str, Sequence[str], None] = 'add_avatar_url'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем поле language в таблицу users
    op.add_column('users', sa.Column('language', sa.String(length=10), nullable=False, server_default='ru'))
    
    # Устанавливаем значение по умолчанию для существующих пользователей
    op.execute("UPDATE users SET language = 'ru' WHERE language IS NULL OR language = ''")


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем столбец language
    op.drop_column('users', 'language')
















