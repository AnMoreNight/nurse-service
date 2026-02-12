from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
import re

# Custom email validation that allows .local domains
def validate_email(email: str) -> str:
    """Validate email format, allowing .local and other internal domains"""
    if not email or '@' not in email:
        raise ValueError('メールアドレスの形式が正しくありません')
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    local_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.local$'
    
    if not (re.match(pattern, email) or re.match(local_pattern, email)):
        raise ValueError('メールアドレスの形式が正しくありません。正しい形式で入力してください（例: user@example.com）')
    
    return email.lower()

# Auth Models
class LoginRequest(BaseModel):
    email: str
    password: str
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class PasswordResetRequest(BaseModel):
    email: str
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class InvitationAccept(BaseModel):
    token: str
    password: str
    name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        if v:
            return validate_email(v)
        return v

# Company Models
class CompanyCreate(BaseModel):
    name: str

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class CompanyResponse(BaseModel):
    company_id: UUID
    name: str
    created_at: datetime

# User Models
class UserCreate(BaseModel):
    email: str
    password: str
    role: str
    name: str
    profession: Optional[str] = None
    job_title: Optional[str] = None
    display_color: Optional[str] = None
    join_date: Optional[str] = None  # YYYY-MM-DD
    left_date: Optional[str] = None  # YYYY-MM-DD    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)
class UserInvite(BaseModel):
    email: str
    role: str
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    profession: Optional[str] = None
    job_title: Optional[str] = None
    display_color: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    join_date: Optional[str] = None  # YYYY-MM-DD
    left_date: Optional[str] = None  # YYYY-MM-DD
    default_holiday_weekdays: Optional[list[int]] = None  # Array of weekday indices (0=Sun, 1=Mon, etc.)

# Admin-specific user creation (includes company_id)
class UserCreateByAdmin(BaseModel):
    company_id: UUID  # Required for admin to specify which company
    email: str
    password: str
    role: str
    name: str
    profession: Optional[str] = None
    job_title: Optional[str] = None
    display_color: Optional[str] = None
    join_date: Optional[str] = None  # YYYY-MM-DD
    left_date: Optional[str] = None  # YYYY-MM-DD
    
    @field_validator('email')
    @classmethod
    def validate_email_field(cls, v):
        return validate_email(v)

class AssignCompanyAdmin(BaseModel):
    company_id: UUID
    user_id: UUID

class RemoveCompanyAdmin(BaseModel):
    user_id: UUID

class UserSortOrder(BaseModel):
    user_id: UUID
    sort_order: int

class UserResponse(BaseModel):
    user_id: UUID
    company_id: Optional[UUID]
    email: str
    role: str
    name: str
    profession: Optional[str]
    job_title: Optional[str]
    display_color: Optional[str]
    avatar_url: Optional[str]
    sort_order: Optional[int]
    is_active: bool
    join_date: Optional[str]
    left_date: Optional[str]
    created_at: datetime

# Patient Models
class PatientCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class PatientResponse(BaseModel):
    patient_id: UUID
    company_id: UUID
    name: str
    address: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

# Schedule Status Models
class ScheduleStatusCreate(BaseModel):
    name: str
    color: str

class ScheduleStatusUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class ScheduleStatusResponse(BaseModel):
    status_id: UUID
    company_id: UUID
    name: str
    color: str
    is_active: bool
    is_default: bool
    sort_order: Optional[int]

class StatusItem(BaseModel):
    """Individual status item for bulk operations"""
    status_id: Optional[UUID] = None  # None for new statuses
    name: str
    color: str
    sort_order: Optional[int] = None

class StatusBulkUpdate(BaseModel):
    """Bulk update request containing all statuses"""
    statuses: list[StatusItem]

# Schedule Models
class RecurringRuleCreate(BaseModel):
    frequency: str  # Weekly, Monthly, Yearly
    day_of_week: Optional[list[int]] = None
    week_of_month: Optional[list[int]] = None
    day_of_week_monthly: Optional[int] = None
    month_of_year: Optional[int] = None
    day_of_month: Optional[int] = None
    interval: int = 1
    start_date: str
    end_date: Optional[str] = None

class ScheduleCreate(BaseModel):
    company_id: Optional[UUID] = None  # Only used by SUPER_ADMIN for impersonation
    patient_id: Optional[UUID] = None
    patient_name: str
    visit_address: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status_id: UUID
    memo: Optional[str] = None
    assigned_user_ids: list[UUID]
    recurring_rule: Optional[RecurringRuleCreate] = None

class ScheduleUpdate(BaseModel):
    company_id: Optional[UUID] = None  # Only used by SUPER_ADMIN for impersonation
    patient_name: Optional[str] = None
    visit_address: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status_id: Optional[UUID] = None
    memo: Optional[str] = None
    assigned_user_ids: Optional[list[UUID]] = None
    recurring_rule: Optional[RecurringRuleCreate] = None
    update_scope: Optional[str] = "this"  # this, future, all

class ScheduleCopy(BaseModel):
    patient_name: str
    visit_address: Optional[str] = None

class ScheduleResponse(BaseModel):
    schedule_id: UUID
    company_id: UUID
    patient_id: Optional[UUID]
    patient_name: str
    visit_address: Optional[str]
    start_time: datetime
    end_time: datetime
    status_id: UUID
    memo: Optional[str]
    recurring_series_id: Optional[UUID]
    is_exception: bool
    assigned_users: list[UserResponse]
    created_at: datetime

# Shift Models
class ShiftCreate(BaseModel):
    user_id: UUID
    shift_date: str
    shift_type: str

class ShiftUpdate(BaseModel):
    shift_type: str

class ShiftBulkCreate(BaseModel):
    user_id: UUID
    shifts: list[dict]  # [{shift_date, shift_type}]

class WeeklyOffRuleCreate(BaseModel):
    user_id: UUID
    day_of_week: str
    shift_type: str

class ShiftResponse(BaseModel):
    shift_id: UUID
    company_id: UUID
    user_id: UUID
    shift_date: str
    shift_type: str
    is_auto_reflected: bool
    memo: Optional[str]
    created_at: datetime
