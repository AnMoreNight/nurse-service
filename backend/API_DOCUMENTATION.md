# API Documentation

Base URL: `http://localhost:8000`

## Authentication

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "role": "CompanyAdmin",
    "name": "John Doe"
  }
}
```

### POST /auth/password-reset/request
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If email exists, reset link sent",
  "token": "reset-token-here"
}
```

### POST /auth/password-reset/confirm
Reset password with token.

**Request:**
```json
{
  "token": "reset-token",
  "new_password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successful"
}
```

### POST /auth/invitation/accept
Accept user invitation.

**Request:**
```json
{
  "token": "invitation-token",
  "password": "password123",
  "name": "Jane Doe"
}
```

**Response:**
```json
{
  "message": "Account created successfully",
  "user_id": "uuid"
}
```

---

## Bootstrap

### POST /bootstrap/create-admin
Create first SystemAdmin (requires `X-Bootstrap-Secret` header).

**Headers:**
```
X-Bootstrap-Secret: super-secret-bootstrap-key-change-this
```

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "Admin User",
  "company_name": "Main Company"
}
```

**Response:**
```json
{
  "message": "SystemAdmin created successfully",
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "admin@example.com",
  "role": "SystemAdmin"
}
```

---

## Companies
*Requires: SystemAdmin role*

### POST /companies
Create new company.

**Request:**
```json
{
  "name": "New Company"
}
```

**Response:**
```json
{
  "company_id": "uuid",
  "name": "New Company"
}
```

### GET /companies
Get all companies.

**Response:**
```json
[
  {
    "company_id": "uuid",
    "name": "Company Name",
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### GET /companies/{company_id}
Get company by ID.

**Response:**
```json
{
  "company_id": "uuid",
  "name": "Company Name",
  "created_at": "2025-12-27T00:00:00"
}
```

### DELETE /companies/{company_id}
Delete company.

**Response:**
```json
{
  "message": "Company deleted"
}
```

---

## Users
*Requires: CompanyAdmin or SystemAdmin*

### POST /users
Create new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "User",
  "name": "John Doe",
  "profession": "Nurse",
  "job_title": "Senior Nurse",
  "display_color": "#FF5733"
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com"
}
```

### POST /users/invite
Invite user via email.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "User"
}
```

**Response:**
```json
{
  "message": "Invitation sent",
  "token": "invitation-token"
}
```

### GET /users
Get all users in company.

**Response:**
```json
[
  {
    "user_id": "uuid",
    "company_id": "uuid",
    "email": "user@example.com",
    "role": "User",
    "name": "John Doe",
    "profession": "Nurse",
    "job_title": "Senior Nurse",
    "display_color": "#FF5733",
    "avatar_url": null,
    "sort_order": 1,
    "is_active": true,
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### GET /users/{user_id}
Get user by ID.

**Response:**
```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "user@example.com",
  "role": "User",
  "name": "John Doe",
  "profession": "Nurse",
  "job_title": "Senior Nurse",
  "display_color": "#FF5733",
  "avatar_url": null,
  "sort_order": 1,
  "is_active": true,
  "created_at": "2025-12-27T00:00:00"
}
```

### PATCH /users/{user_id}
Update user.

**Request:**
```json
{
  "name": "John Updated",
  "profession": "Head Nurse",
  "display_color": "#00FF00",
  "is_active": true
}
```

**Response:**
```json
{
  "message": "User updated"
}
```

### POST /users/sort-order
Update user sort orders.

**Request:**
```json
[
  {
    "user_id": "uuid1",
    "sort_order": 1
  },
  {
    "user_id": "uuid2",
    "sort_order": 2
  }
]
```

**Response:**
```json
{
  "message": "Sort orders updated"
}
```

### DELETE /users/{user_id}
Deactivate user.

**Response:**
```json
{
  "message": "User deactivated"
}
```

---

## Patients
*Requires: CompanyAdmin (create/update/delete), User (read)*

### POST /patients
Create patient.

**Request:**
```json
{
  "name": "Patient Name",
  "address": "123 Main St",
  "phone": "555-1234",
  "notes": "Special care needed"
}
```

**Response:**
```json
{
  "patient_id": "uuid",
  "name": "Patient Name"
}
```

### GET /patients
Get all patients (with optional search).

**Query Params:**
- `search` (optional): Search by name

**Response:**
```json
[
  {
    "patient_id": "uuid",
    "company_id": "uuid",
    "name": "Patient Name",
    "address": "123 Main St",
    "phone": "555-1234",
    "notes": "Special care needed",
    "is_active": true,
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### GET /patients/{patient_id}
Get patient by ID.

**Response:**
```json
{
  "patient_id": "uuid",
  "company_id": "uuid",
  "name": "Patient Name",
  "address": "123 Main St",
  "phone": "555-1234",
  "notes": "Special care needed",
  "is_active": true,
  "created_at": "2025-12-27T00:00:00"
}
```

### PATCH /patients/{patient_id}
Update patient.

**Request:**
```json
{
  "name": "Updated Name",
  "address": "456 New St",
  "phone": "555-5678",
  "notes": "Updated notes",
  "is_active": true
}
```

**Response:**
```json
{
  "message": "Patient updated"
}
```

### DELETE /patients/{patient_id}
Deactivate patient.

**Response:**
```json
{
  "message": "Patient deactivated"
}
```

---

## Schedule Statuses
*Requires: CompanyAdmin (create/update/delete), User (read)*

### POST /statuses
Create schedule status.

**Request:**
```json
{
  "name": "Emergency Visit",
  "color": "#FF0000"
}
```

**Response:**
```json
{
  "status_id": "uuid",
  "name": "Emergency Visit"
}
```

### GET /statuses
Get all statuses.

**Response:**
```json
[
  {
    "status_id": "uuid",
    "company_id": "uuid",
    "name": "Emergency Visit",
    "color": "#FF0000",
    "is_active": true,
    "is_default": false,
    "sort_order": 1,
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### PATCH /statuses/{status_id}
Update status.

**Request:**
```json
{
  "name": "Updated Status",
  "color": "#00FF00",
  "is_active": true,
  "sort_order": 2
}
```

**Response:**
```json
{
  "message": "Status updated"
}
```

### DELETE /statuses/{status_id}
Deactivate status (cannot delete default statuses).

**Response:**
```json
{
  "message": "Status deleted"
}
```

---

## Schedules
*Requires: CompanyAdmin (create/update/delete), User (read)*

### POST /schedules
Create schedule (with optional recurring rule).

**Request:**
```json
{
  "patient_id": "uuid",
  "patient_name": "Patient Name",
  "visit_address": "123 Main St",
  "start_time": "2025-12-27T10:00:00",
  "end_time": "2025-12-27T11:00:00",
  "status_id": "uuid",
  "memo": "Regular checkup",
  "assigned_user_ids": ["uuid1", "uuid2"],
  "recurring_rule": {
    "frequency": "Weekly",
    "day_of_week": [1, 3, 5],
    "interval": 1,
    "start_date": "2025-12-27",
    "end_date": "2026-12-27"
  }
}
```

**Response:**
```json
{
  "schedule_id": "uuid",
  "recurring_series_id": "uuid"
}
```

### GET /schedules
Get schedules with filters.

**Query Params:**
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)
- `patient_name` (optional): Search by patient name

**Response:**
```json
[
  {
    "schedule_id": "uuid",
    "company_id": "uuid",
    "patient_id": "uuid",
    "patient_name": "Patient Name",
    "visit_address": "123 Main St",
    "start_time": "2025-12-27T10:00:00",
    "end_time": "2025-12-27T11:00:00",
    "status_id": "uuid",
    "memo": "Regular checkup",
    "recurring_series_id": "uuid",
    "is_exception": false,
    "assigned_users": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "role": "User",
        "name": "John Doe",
        "profession": "Nurse",
        "display_color": "#FF5733",
        "avatar_url": null
      }
    ],
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### PATCH /schedules/{schedule_id}
Update schedule.

**Request:**
```json
{
  "patient_name": "Updated Name",
  "visit_address": "456 New St",
  "start_time": "2025-12-27T14:00:00",
  "end_time": "2025-12-27T15:00:00",
  "status_id": "uuid",
  "memo": "Updated memo",
  "assigned_user_ids": ["uuid1"],
  "update_scope": "this"
}
```
*update_scope: "this" | "future" | "all"*

**Response:**
```json
{
  "message": "Schedule updated"
}
```

### DELETE /schedules/{schedule_id}
Delete schedule.

**Response:**
```json
{
  "message": "Schedule deleted"
}
```

### GET /schedules/{schedule_id}/copy
Copy schedule data for duplication.

**Response:**
```json
{
  "patient_name": "Patient Name",
  "visit_address": "123 Main St"
}
```

### GET /schedules/export/csv
Export schedules to CSV.

**Query Params:**
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD

**Response:** CSV file download

---

## Shifts
*Requires: CompanyAdmin (create/update/delete), User (read)*

### POST /shifts
Create shift.

**Request:**
```json
{
  "user_id": "uuid",
  "shift_date": "2025-12-27",
  "shift_type": "Workday"
}
```
*shift_type: "Workday" | "ScheduledDayOff" | "NightDuty1" | "NightDuty2" | "NightDuty1_Off" | "NightDuty2_Off"*

**Response:**
```json
{
  "shift_id": "uuid"
}
```

### GET /shifts
Get shifts with filters.

**Query Params:**
- `user_id` (optional): Filter by user
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD

**Response:**
```json
[
  {
    "shift_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "shift_date": "2025-12-27",
    "shift_type": "Workday",
    "is_auto_reflected": false,
    "memo": null,
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### PATCH /shifts/{shift_id}
Update shift.

**Request:**
```json
{
  "shift_type": "ScheduledDayOff"
}
```

**Response:**
```json
{
  "message": "Shift updated"
}
```

### DELETE /shifts/{shift_id}
Delete shift.

**Response:**
```json
{
  "message": "Shift deleted"
}
```

### POST /shifts/weekly-off-rules
Create weekly off rule.

**Request:**
```json
{
  "user_id": "uuid",
  "day_of_week": "Sun",
  "shift_type": "ScheduledDayOff"
}
```
*day_of_week: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"*

**Response:**
```json
{
  "rule_id": "uuid"
}
```

### GET /shifts/weekly-off-rules
Get weekly off rules.

**Query Params:**
- `user_id` (optional): Filter by user

**Response:**
```json
[
  {
    "rule_id": "uuid",
    "company_id": "uuid",
    "user_id": "uuid",
    "day_of_week": "Sun",
    "shift_type": "ScheduledDayOff",
    "is_active": true,
    "created_at": "2025-12-27T00:00:00"
  }
]
```

### POST /shifts/apply-weekly-rules
Apply weekly off rules to date range.

**Query Params:**
- `start_date` (required): YYYY-MM-DD
- `end_date` (required): YYYY-MM-DD

**Response:**
```json
{
  "message": "Weekly off rules applied"
}
```

### GET /shifts/export/csv
Export shifts to CSV.

**Query Params:**
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD

**Response:** CSV file download

---

## General Endpoints

### GET /
Root endpoint.

**Response:**
```json
{
  "message": "Nurse Service API",
  "version": "1.0.0"
}
```

### GET /health
Health check.

**Response:**
```json
{
  "status": "healthy"
}
```

---

## Authentication

All endpoints except `/auth/*`, `/bootstrap/*`, `/`, and `/health` require JWT authentication.

**Header:**
```
Authorization: Bearer <access_token>
```

## Role Permissions

- **SystemAdmin**: Full access to all companies
- **CompanyAdmin**: Full access within their company
- **User**: Read-only access to schedules, shifts, patients, statuses
