"""add_user_fields

Revision ID: 92c8e7d6a9b1
Revises: 8cdcc2e6230d
Create Date: 2025-12-28 18:48:32.307862

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92c8e7d6a9b1'
down_revision: Union[str, Sequence[str], None] = '8cdcc2e6230d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing columns to users table
    op.add_column('users', sa.Column('join_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('left_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('default_holiday_weekdays', sa.ARRAY(sa.Integer()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the added columns
    op.drop_column('users', 'default_holiday_weekdays')
    op.drop_column('users', 'left_date')
    op.drop_column('users', 'join_date')
