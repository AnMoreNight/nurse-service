"""Add performance indexes

Revision ID: a1b2c3d4e5f6
Revises: 4d8961528eb0
Create Date: 2026-01-14 18:36:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4d8961528eb0'
branch_labels = None
depends_on = None


def upgrade():
    """Add performance indexes for multi-tenant queries"""
    
    op.create_index(
        'idx_schedules_company_date',
        'schedules',
        ['company_id', 'start_time'],
        unique=False
    )
    
    op.create_index(
        'idx_schedule_assignments_user',
        'schedule_assignments',
        ['user_id', 'schedule_id'],
        unique=False
    )
    
    op.create_index(
        'idx_shifts_company_date',
        'shifts',
        ['company_id', 'shift_date'],
        unique=False
    )
    
    op.create_index(
        'idx_shifts_user_date',
        'shifts',
        ['user_id', 'shift_date'],
        unique=False
    )
    
    op.create_index(
        'idx_users_company_active',
        'users',
        ['company_id', 'is_active'],
        unique=False
    )
    
    op.create_index(
        'idx_statuses_company',
        'schedule_statuses',
        ['company_id', 'is_active'],
        unique=False
    )
    
    op.create_index(
        'idx_schedules_recurring_series',
        'schedules',
        ['recurring_series_id'],
        unique=False,
        postgresql_where=sa.text('recurring_series_id IS NOT NULL')
    )


def downgrade():
    """Remove performance indexes"""
    
    op.drop_index('idx_schedules_company_date', table_name='schedules')
    op.drop_index('idx_schedule_assignments_user', table_name='schedule_assignments')
    op.drop_index('idx_shifts_company_date', table_name='shifts')
    op.drop_index('idx_shifts_user_date', table_name='shifts')
    op.drop_index('idx_users_company_active', table_name='users')
    op.drop_index('idx_statuses_company', table_name='schedule_statuses')
    op.drop_index('idx_schedules_recurring_series', table_name='schedules')
