"""Convert week_of_month from Integer to ARRAY(Integer)

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-28 10:00:00.000000

This migration converts the week_of_month column from Integer to ARRAY(Integer)
to support multiple week selections (e.g., 1st and 3rd week of month).
Existing data is preserved by converting single values to arrays.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    """
    Convert week_of_month from Integer to ARRAY(Integer).
    Preserves existing data by converting single integers to single-element arrays.
    """
    # Step 1: Add a temporary column with the new type
    op.add_column('recurring_rules',
        sa.Column('week_of_month_new', postgresql.ARRAY(sa.Integer()), nullable=True)
    )

    # Step 2: Migrate existing data - convert single integer to array
    op.execute("""
        UPDATE recurring_rules
        SET week_of_month_new = ARRAY[week_of_month]
        WHERE week_of_month IS NOT NULL
    """)

    # Step 3: Drop the old column
    op.drop_column('recurring_rules', 'week_of_month')

    # Step 4: Rename the new column to the original name
    op.alter_column('recurring_rules', 'week_of_month_new',
                    new_column_name='week_of_month')


def downgrade():
    """
    Revert week_of_month from ARRAY(Integer) back to Integer.
    Takes the first element of the array for existing data.
    """
    # Step 1: Add a temporary column with the old type
    op.add_column('recurring_rules',
        sa.Column('week_of_month_old', sa.Integer(), nullable=True)
    )

    # Step 2: Migrate existing data - take first element of array
    op.execute("""
        UPDATE recurring_rules
        SET week_of_month_old = week_of_month[1]
        WHERE week_of_month IS NOT NULL AND array_length(week_of_month, 1) > 0
    """)

    # Step 3: Drop the array column
    op.drop_column('recurring_rules', 'week_of_month')

    # Step 4: Rename the old column to the original name
    op.alter_column('recurring_rules', 'week_of_month_old',
                    new_column_name='week_of_month')
