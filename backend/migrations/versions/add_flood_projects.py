"""add_flood_projects

Revision ID: add_flood_projects
Revises: add_share_password
Create Date: 2025-01-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_flood_projects'
down_revision: Union[str, Sequence[str], None] = 'add_share_password'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Создаем таблицу flood_projects
    op.create_table(
        'flood_projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('share_hash', sa.String(), nullable=True),
        sa.Column('simulation_data', sa.JSON(), nullable=True),
        sa.Column('files_data', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_flood_projects_id'), 'flood_projects', ['id'], unique=False)
    op.create_index(op.f('ix_flood_projects_share_hash'), 'flood_projects', ['share_hash'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Удаляем индексы
    op.drop_index(op.f('ix_flood_projects_share_hash'), table_name='flood_projects')
    op.drop_index(op.f('ix_flood_projects_id'), table_name='flood_projects')
    # Удаляем таблицу
    op.drop_table('flood_projects')










