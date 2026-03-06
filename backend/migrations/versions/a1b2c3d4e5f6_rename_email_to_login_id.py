"""rename email to login_id

Revision ID: a1b2c3d4e5f6
Revises: 61234c2671c3
Create Date: 2026-03-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '61234c2671c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'email', new_column_name='login_id')
    op.alter_column('user_invitations', 'email', new_column_name='login_id')

    op.drop_index('ix_user_invitations_email', table_name='user_invitations')
    op.create_index('ix_user_invitations_login_id', 'user_invitations', ['login_id'])


def downgrade() -> None:
    op.alter_column('users', 'login_id', new_column_name='email')
    op.alter_column('user_invitations', 'login_id', new_column_name='email')

    op.drop_index('ix_user_invitations_login_id', table_name='user_invitations')
    op.create_index('ix_user_invitations_email', 'user_invitations', ['email'])
