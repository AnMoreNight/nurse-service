"""
Database Migration: Add Performance Indexes

Run this migration to add indexes for better query performance.

Usage:
    alembic revision --autogenerate -m "add_performance_indexes"
    Then replace the content with this migration.
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    """Add performance indexes for multi-tenant queries"""
    
    # Composite index on schedules for common queries
    op.create_index(
        'idx_schedules_company_date',
        'schedules',
        ['company_id', 'start_time'],
        unique=False
    )
    
    # Index on schedule_assignments for user filtering
    op.create_index(
        'idx_schedule_assignments_user',
        'schedule_assignments',
        ['user_id', 'schedule_id'],
        unique=False
    )
    
    # Composite index on shifts for date range queries
    op.create_index(
        'idx_shifts_company_date',
        'shifts',
        ['company_id', 'shift_date'],
        unique=False
    )
    
    # Index on shifts for user filtering
    op.create_index(
        'idx_shifts_user_date',
        'shifts',
        ['user_id', 'shift_date'],
        unique=False
    )
    
    # Index on users for company queries
    op.create_index(
        'idx_users_company_active',
        'users',
        ['company_id', 'is_active'],
        unique=False
    )
    
    # Index on statuses for company queries
    op.create_index(
        'idx_statuses_company',
        'schedule_statuses',
        ['company_id', 'is_active'],
        unique=False
    )
    
    # Index on recurring_series_id for schedule grouping
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
