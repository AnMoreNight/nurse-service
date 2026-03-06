from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text, Date, Enum as SQLEnum, DECIMAL, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSON
from sqlalchemy.orm import relationship
from db.database import Base
from datetime import datetime
import uuid
import enum

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    NORMAL_USER = "NORMAL_USER"

class Company(Base):
    __tablename__ = "companies"
    
    company_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="company")
    patients = relationship("Patient", back_populates="company")
    schedules = relationship("Schedule", back_populates="company")
    schedule_statuses = relationship("ScheduleStatus", back_populates="company")
    shifts = relationship("Shift", back_populates="company")
    settings = relationship("CompanySetting", back_populates="company")
    weekly_off_rules = relationship("WeeklyOffRule", back_populates="company")
    invitations = relationship("UserInvitation", back_populates="company")

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=True)
    login_id = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="NORMAL_USER")
    name = Column(String(255), nullable=False)
    profession = Column(String(100), nullable=True)
    job_title = Column(String(100), nullable=True)
    display_color = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    join_date = Column(Date, nullable=True)
    left_date = Column(Date, nullable=True)
    default_holiday_weekdays = Column(ARRAY(Integer), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="users")
    schedule_assignments = relationship("ScheduleAssignment", back_populates="user")
    shifts = relationship("Shift", back_populates="user")
    weekly_off_rules = relationship("WeeklyOffRule", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

    __table_args__ = (
        Index('ix_users_company_id', 'company_id'),
        Index('ix_users_company_id_role', 'company_id', 'role'),
    )

class Patient(Base):
    __tablename__ = "patients"
    
    patient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="patients")
    schedules = relationship("Schedule", back_populates="patient")

    __table_args__ = (
        Index('ix_patients_company_id', 'company_id'),
        Index('ix_patients_company_id_is_active', 'company_id', 'is_active'),
    )

class ScheduleStatus(Base):
    __tablename__ = "schedule_statuses"
    
    status_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="schedule_statuses")
    schedules = relationship("Schedule", back_populates="status")

    __table_args__ = (
        Index('ix_schedule_statuses_company_id', 'company_id'),
    )

class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    frequency = Column(String(50), nullable=True)  # Weekly, Monthly, Yearly
    day_of_week = Column(ARRAY(Integer), nullable=True)
    week_of_month = Column(ARRAY(Integer), nullable=True)  # Support multiple weeks: [1,3] for 1st and 3rd week
    day_of_week_monthly = Column(Integer, nullable=True)
    month_of_year = Column(Integer, nullable=True)
    day_of_month = Column(Integer, nullable=True)
    interval = Column(Integer, default=1)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Schedule(Base):
    __tablename__ = "schedules"
    
    schedule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id"), nullable=True)
    patient_name = Column(String(255), nullable=False)
    visit_address = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status_id = Column(UUID(as_uuid=True), ForeignKey("schedule_statuses.status_id"), nullable=True)
    memo = Column(Text, nullable=True)
    recurring_rule_id = Column(UUID(as_uuid=True), ForeignKey("recurring_rules.rule_id"), nullable=True)
    recurring_series_id = Column(UUID(as_uuid=True), nullable=True)
    recurrence_index = Column(Integer, default=0)
    is_exception = Column(Boolean, default=False)
    lat = Column(DECIMAL, nullable=True)
    lng = Column(DECIMAL, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="schedules")
    patient = relationship("Patient", back_populates="schedules")
    status = relationship("ScheduleStatus", back_populates="schedules")
    recurring_rule = relationship("RecurringRule")
    assignments = relationship("ScheduleAssignment", back_populates="schedule", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_schedules_company_id', 'company_id'),
        Index('ix_schedules_company_id_start_time', 'company_id', 'start_time'),
        Index('ix_schedules_recurring_rule_id', 'recurring_rule_id'),
        Index('ix_schedules_recurring_series_id', 'recurring_series_id'),
        Index('ix_schedules_recurring_rule_id_is_exception', 'recurring_rule_id', 'is_exception'),
    )

class ScheduleAssignment(Base):
    __tablename__ = "schedule_assignments"
    
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.schedule_id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), primary_key=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    schedule = relationship("Schedule", back_populates="assignments")
    user = relationship("User", back_populates="schedule_assignments")

    __table_args__ = (
        Index('ix_schedule_assignments_user_id', 'user_id'),
    )

class Shift(Base):
    __tablename__ = "shifts"
    
    shift_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    shift_date = Column(Date, nullable=False)
    shift_type = Column(String(50), nullable=True)
    is_auto_reflected = Column(Boolean, default=False)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="shifts")
    user = relationship("User", back_populates="shifts")

    __table_args__ = (
        Index('ix_shifts_company_id', 'company_id'),
        Index('ix_shifts_user_id_shift_date', 'user_id', 'shift_date'),
        Index('ix_shifts_company_id_shift_date', 'company_id', 'shift_date'),
    )

class WeeklyOffRule(Base):
    __tablename__ = "weekly_off_rules"
    
    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    shift_type = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="weekly_off_rules")
    user = relationship("User", back_populates="weekly_off_rules")

    __table_args__ = (
        Index('ix_weekly_off_rules_company_id', 'company_id'),
        Index('ix_weekly_off_rules_company_id_user_id', 'company_id', 'user_id'),
    )

class UserInvitation(Base):
    __tablename__ = "user_invitations"
    
    invitation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    login_id = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="invitations")

    __table_args__ = (
        Index('ix_user_invitations_company_id', 'company_id'),
        Index('ix_user_invitations_login_id', 'login_id'),
    )

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    token_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

    __table_args__ = (
        Index('ix_password_reset_tokens_user_id', 'user_id'),
    )

class CompanySetting(Base):
    __tablename__ = "company_settings"
    
    setting_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=False)
    setting_key = Column(String(255), nullable=False)
    setting_value = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="settings")
    
    __table_args__ = (UniqueConstraint('company_id', 'setting_key', name='uq_company_setting'),)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.company_id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    action = Column(String(255), nullable=False)
    target_type = Column(String(255), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    log_metadata = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index('ix_audit_logs_company_id', 'company_id'),
        Index('ix_audit_logs_user_id', 'user_id'),
        Index('ix_audit_logs_created_at', 'created_at'),
    )
