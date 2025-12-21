from sqlalchemy import Column, String, Boolean, Integer, DateTime, Date, Enum, Text, DECIMAL, ARRAY, ForeignKey, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid
import enum

Base = declarative_base()

# Enums
class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SuperAdmin"
    COMPANY_ADMIN = "CompanyAdmin"
    NORMAL_USER = "NormalUser"

class RecurrenceFrequency(str, enum.Enum):
    WEEKLY = "Weekly"
    MONTHLY = "Monthly"
    YEARLY = "Yearly"

class DayOfWeek(str, enum.Enum):
    SUN = "Sun"
    MON = "Mon"
    TUE = "Tue"
    WED = "Wed"
    THU = "Thu"
    FRI = "Fri"
    SAT = "Sat"

class ShiftType(str, enum.Enum):
    WORKDAY = "Workday"
    SCHEDULED_DAY_OFF = "ScheduledDayOff"
    NIGHT_DUTY_1 = "NightDuty1"
    NIGHT_DUTY_2 = "NightDuty2"
    NIGHT_DUTY_1_OFF = "NightDuty1_Off"
    NIGHT_DUTY_2_OFF = "NightDuty2_Off"

# Association table for schedule assignments
schedule_assignments = Table(
    'schedule_assignments',
    Base.metadata,
    Column('schedule_id', UUID(as_uuid=True), ForeignKey('schedules.schedule_id'), primary_key=True),
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.user_id'), primary_key=True),
    Column('assigned_at', DateTime, default=datetime.utcnow)
)

# Models
class Company(Base):
    __tablename__ = 'companies'
    
    company_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    users = relationship("User", back_populates="company")
    patients = relationship("Patient", back_populates="company")
    schedules = relationship("Schedule", back_populates="company")
    shifts = relationship("Shift", back_populates="company")
    settings = relationship("CompanySetting", back_populates="company")
    statuses = relationship("ScheduleStatus", back_populates="company")
    weekly_off_rules = relationship("WeeklyOffRule", back_populates="company")
    invitations = relationship("UserInvitation", back_populates="company")

class User(Base):
    __tablename__ = 'users'
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    name = Column(String, nullable=False)
    profession = Column(String)
    job_title = Column(String)
    display_color = Column(String)
    avatar_url = Column(String)
    sort_order = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("Company", back_populates="users")
    schedules = relationship("Schedule", secondary=schedule_assignments, back_populates="assigned_users")
    shifts = relationship("Shift", back_populates="user")
    weekly_off_rules = relationship("WeeklyOffRule", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Patient(Base):
    __tablename__ = 'patients'
    
    patient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("Company", back_populates="patients")
    schedules = relationship("Schedule", back_populates="patient")

class ScheduleStatus(Base):
    __tablename__ = 'schedule_statuses'
    
    status_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="statuses")
    schedules = relationship("Schedule", back_populates="status")

class RecurringRule(Base):
    __tablename__ = 'recurring_rules'
    
    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    frequency = Column(Enum(RecurrenceFrequency), nullable=False)
    day_of_week = Column(ARRAY(Integer))
    week_of_month = Column(Integer)
    day_of_week_monthly = Column(Integer)
    month_of_year = Column(Integer)
    day_of_month = Column(Integer)
    interval = Column(Integer, default=1)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    schedules = relationship("Schedule", back_populates="recurring_rule")

class Schedule(Base):
    __tablename__ = 'schedules'
    
    schedule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.patient_id'), nullable=True)
    patient_name = Column(String, nullable=False)
    visit_address = Column(String)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status_id = Column(UUID(as_uuid=True), ForeignKey('schedule_statuses.status_id'), nullable=False)
    memo = Column(Text)
    recurring_rule_id = Column(UUID(as_uuid=True), ForeignKey('recurring_rules.rule_id'), nullable=True)
    recurring_series_id = Column(UUID(as_uuid=True), nullable=True)
    recurrence_index = Column(Integer)
    is_exception = Column(Boolean, default=False)
    lat = Column(DECIMAL, nullable=True)
    lng = Column(DECIMAL, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("Company", back_populates="schedules")
    patient = relationship("Patient", back_populates="schedules")
    status = relationship("ScheduleStatus", back_populates="schedules")
    recurring_rule = relationship("RecurringRule", back_populates="schedules")
    assigned_users = relationship("User", secondary=schedule_assignments, back_populates="schedules")

class WeeklyOffRule(Base):
    __tablename__ = 'weekly_off_rules'
    
    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    day_of_week = Column(Enum(DayOfWeek), nullable=False)
    shift_type = Column(Enum(ShiftType), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="weekly_off_rules")
    user = relationship("User", back_populates="weekly_off_rules")

class Shift(Base):
    __tablename__ = 'shifts'
    
    shift_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    shift_date = Column(Date, nullable=False)
    shift_type = Column(Enum(ShiftType), nullable=False)
    is_auto_reflected = Column(Boolean, default=False)
    memo = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("Company", back_populates="shifts")
    user = relationship("User", back_populates="shifts")

class CompanySetting(Base):
    __tablename__ = 'company_settings'
    
    setting_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    setting_key = Column(String, nullable=False)
    setting_value = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    company = relationship("Company", back_populates="settings")
    
    __table_args__ = (UniqueConstraint('company_id', 'setting_key', name='uq_company_setting'),)

class UserInvitation(Base):
    __tablename__ = 'user_invitations'
    
    invitation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=False)
    email = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="invitations")

class PasswordResetToken(Base):
    __tablename__ = 'password_reset_tokens'
    
    token_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="password_reset_tokens")

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.company_id'), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    metadata = Column(JSON, nullable=True)
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="audit_logs")
