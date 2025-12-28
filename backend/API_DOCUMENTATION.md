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
    "role": "ADMIN",
    "name": "John Doe",
    "company_id": "uuid"
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
  "message": "If email exists, reset link sent"
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
  "message": "Invitation accepted",
  "user_id": "uuid"
}
```

---

## Bootstrap

### POST /bootstrap/create-admin
Create first SuperAdmin (requires `X-Bootstrap-Secret` header).

**Headers:**
```
X-Bootstrap-Secret: your-bootstrap-secret
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
  "message": "SuperAdmin created successfully",
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "admin@example.com",
  "role": "SUPER_ADMIN"
}
```

---

## Companies
*Requires: SUPER_ADMIN role*

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
  "name": "New Company",
  "created_at": "2025-12-28T00:00:00"
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
    "created_at": "2025-12-28T00:00:00"
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
  "created_at": "2025-12-28T00:00:00"
}
```

### PUT /companies/{company_id}
Update company.

**Request:**
```json
{
  "name": "Updated Company Name"
}
```

**Response:**
```json
{
  "company_id": "uuid",
  "name": "Updated Company Name",
  "created_at": "2025-12-28T00:00:00"
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
*Requires: Authentication*

### POST /users
Create new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "USER",
  "name": "John Doe",
  "profession": "Nurse",
  "job_title": "Senior Nurse",
  "display_color": "#FF5733",
  "join_date": "2025-01-01",
  "left_date": null
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "user@example.com",
  "role": "USER",
  "name": "John Doe",
  "profession": "Nurse",
  "job_title": "Senior Nurse",
  "display_color": "#FF5733",
  "avatar_url": null,
  "sort_order": null,
  "is_active": true,
  "join_date": "2025-01-01",
  "left_date": null,
  "created_at": "2025-12-28T00:00:00"
}
```

### POST /users/invite
Invite user via email.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "USER"
}
```

**Response:**
```json
{
  "message": "Invitation sent",
  "user_id": "uuid"
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
    "role": "USER",
    "name": "John Doe",
    "profession": "Nurse",
    "job_title": "Senior Nurse",
    "display_color": "#FF5733",
    "avatar_url": null,
    "sort_order": 1,
    "is_active": true,
    "join_date": "2025-01-01",
    "left_date": null,
    "created_at": "2025-12-28T00:00:00"
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
  "role": "USER",
  "name": "John Doe",
  "profession": "Nurse",
  "job_title": "Senior Nurse",
  "display_color": "#FF5733",
  "avatar_url": null,
  "sort_order": 1,
  "is_active": true,
  "join_date": "2025-01-01",
  "left_date": null,
  "created_at": "2025-12-28T00:00:00"
}
```

### PUT /users/{user_id}
Update user.

**Request:**
```json
{
  "name": "John Updated",
  "profession": "Head Nurse",
  "job_title": "Lead Nurse",
  "display_color": "#00FF00",
  "avatar_url": "https://example.com/avatar.jpg",
  "role": "ADMIN",
  "is_active": true,
  "join_date": "2025-01-01",
  "left_date": null
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "name": "John Updated",
  "profession": "Head Nurse",
  "job_title": "Lead Nurse",
  "display_color": "#00FF00",
  "avatar_url": "https://example.com/avatar.jpg",
  "sort_order": 1,
  "is_active": true,
  "join_date": "2025-01-01",
  "left_date": null,
  "created_at": "2025-12-28T00:00:00"
}
```

### PUT /users/sort-order
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
*Requires: Authentication*

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
  "company_id": "uuid",
  "name": "Patient Name",
  "address": "123 Main St",
  "phone": "555-1234",
  "notes": "Special care needed",
  "is_active": true,
  "created_at": "2025-12-28T00:00:00"
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
    "created_at": "2025-12-28T00:00:00"
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
  "created_at": "2025-12-28T00:00:00"
}
```

### PUT /patients/{patient_id}
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
  "patient_id": "uuid",
  "company_id": "uuid",
  "name": "Updated Name",
  "address": "456 New St",
  "phone": "555-5678",
  "notes": "Updated notes",
  "is_active": true,
  "created_at": "2025-12-28T00:00:00"
}
```

### DELETE /patients/{patient_id}
Delete patient.

**Response:**
```json
{
  "message": "Patient deleted"
}
```

---

## Schedule Statuses
*Requires: Authentication*

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
  "company_id": "uuid",
  "name": "Emergency Visit",
  "color": "#FF0000",
  "is_active": true,
  "is_default": false,
  "sort_order": null
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
    "sort_order": 1
  }
]
```

### PUT /statuses/{status_id}
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
  "status_id": "uuid",
  "company_id": "uuid",
  "name": "Updated Status",
  "color": "#00FF00",
  "is_active": true,
  "is_default": false,
  "sort_order": 2
}
```

### DELETE /statuses/{status_id}
Delete status.

**Response:**
```json
{
  "message": "Status deleted"
}
```

---

## Schedules
*Requires: Authentication*

### POST /schedules
Create schedule (with optional recurring rule).

**Request:**
```json
{
  "patient_id": "uuid",
  "patient_name": "Patient Name",
  "visit_address": "123 Main St",
  "start_time": "2025-12-28T10:00:00",
  "end_time": "2025-12-28T11:00:00",
  "status_id": "uuid",
  "memo": "Regular checkup",
  "assigned_user_ids": ["uuid1", "uuid2"],
  "recurring_rule": {
    "frequency": "Weekly",
    "day_of_week": [1, 3, 5],
    "week_of_month": null,
    "day_of_week_monthly": null,
    "month_of_year": null,
    "day_of_month": null,
    "interval": 1,
    "start_date": "2025-12-28",
    "end_date": "2026-12-28"
  }
}
```
*frequency: "Weekly" | "Monthly" | "Yearly"*

**Response:**
```json
{
  "schedule_id": "uuid",
  "company_id": "uuid",
  "patient_id": "uuid",
  "patient_name": "Patient Name",
  "visit_address": "123 Main St",
  "start_time": "2025-12-28T10:00:00",
  "end_time": "2025-12-28T11:00:00",
  "status_id": "uuid",
  "memo": "Regular checkup",
  "recurring_series_id": "uuid",
  "is_exception": false,
  "assigned_users": [
    {
      "user_id": "uuid",
      "email": "user@example.com",
      "role": "USER",
      "name": "John Doe",
      "profession": "Nurse",
      "display_color": "#FF5733",
      "avatar_url": null
    }
  ],
  "created_at": "2025-12-28T00:00:00"
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
    "start_time": "2025-12-28T10:00:00",
    "end_time": "2025-12-28T11:00:00",
    "status_id": "uuid",
    "memo": "Regular checkup",
    "recurring_series_id": "uuid",
    "is_exception": false,
    "assigned_users": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "role": "USER",
        "name": "John Doe",
        "profession": "Nurse",
        "display_color": "#FF5733",
        "avatar_url": null
      }
    ],
    "created_at": "2025-12-28T00:00:00"
  }
]
```

### PUT /schedules/{schedule_id}
Update schedule.

**Request:**
```json
{
  "patient_name": "Updated Name",
  "visit_address": "456 New St",
  "start_time": "2025-12-28T14:00:00",
  "end_time": "2025-12-28T15:00:00",
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
  "message": "Schedule updated",
  "affected_count": 1
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
  "patient_id": "uuid",
  "patient_name": "Patient Name",
  "visit_address": "123 Main St",
  "start_time": "2025-12-28T10:00:00",
  "end_time": "2025-12-28T11:00:00",
  "status_id": "uuid",
  "memo": "Regular checkup",
  "assigned_user_ids": ["uuid1", "uuid2"]
}
```

### GET /schedules/export/csv
Export schedules to CSV.

**Query Params:**
- `start_date` (optional): YYYY-MM-DD
- `end_date` (optional): YYYY-MM-DD

**Response:** CSV file download (schedules.csv)

---

## Shifts
*Requires: Authentication*

### POST /shifts
Create shift.

**Request:**
```json
{
  "user_id": "uuid",
  "shift_date": "2025-12-28",
  "shift_type": "Workday"
}
```
*shift_type: "Workday" | "ScheduledDayOff" | "NightDuty1" | "NightDuty2" | "NightDuty1_Off" | "NightDuty2_Off"*

**Response:**
```json
{
  "shift_id": "uuid",
  "company_id": "uuid",
  "user_id": "uuid",
  "shift_date": "2025-12-28",
  "shift_type": "Workday",
  "is_auto_reflected": false,
  "memo": null,
  "created_at": "2025-12-28T00:00:00"
}
```

### POST /shifts/bulk
Bulk create shifts.

**Request:**
```json
{
  "user_id": "uuid",
  "shifts": [
    {
      "shift_date": "2025-12-28",
      "shift_type": "Workday"
    },
    {
      "shift_date": "2025-12-29",
      "shift_type": "ScheduledDayOff"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Shifts created",
  "count": 2
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
    "shift_date": "2025-12-28",
    "shift_type": "Workday",
    "is_auto_reflected": false,
    "memo": null,
    "created_at": "2025-12-28T00:00:00"
  }
]
```

### PUT /shifts/{shift_id}
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
  "shift_id": "uuid",
  "company_id": "uuid",
  "user_id": "uuid",
  "shift_date": "2025-12-28",
  "shift_type": "ScheduledDayOff",
  "is_auto_reflected": false,
  "memo": null,
  "created_at": "2025-12-28T00:00:00"
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
  "day_of_week": "Sunday",
  "shift_type": "ScheduledDayOff"
}
```
*day_of_week: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"*

**Response:**
```json
{
  "rule_id": "uuid",
  "company_id": "uuid",
  "user_id": "uuid",
  "day_of_week": 6,
  "shift_type": "ScheduledDayOff",
  "is_active": true,
  "created_at": "2025-12-28T00:00:00"
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
    "day_of_week": 6,
    "shift_type": "ScheduledDayOff",
    "is_active": true,
    "created_at": "2025-12-28T00:00:00"
  }
]
```

### POST /shifts/apply-weekly-rules
Apply weekly off rules to month.

**Query Params:**
- `year` (required): 2025
- `month` (required): 1-12

**Response:**
```json
{
  "message": "Weekly off rules applied",
  "shifts_created": 4
}
```

### GET /shifts/export/csv
Export shifts to CSV.

**Query Params:**
- `start_date` (required): YYYY-MM-DD
- `end_date` (required): YYYY-MM-DD

**Response:** CSV file download (shifts.csv)

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

- **SUPER_ADMIN**: Full access to all companies and system-wide operations
- **ADMIN**: Full access within their company (create/update/delete)
- **USER**: Read-only access to schedules, shifts, patients, statuses within their company

## Error Responses

All endpoints may return the following error responses:

**401 Unauthorized:**
```json
{
  "detail": "Not authenticated"
}
```

**403 Forbidden:**
```json
{
  "detail": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "detail": "Resource not found"
}
```

**400 Bad Request:**
```json
{
  "detail": "Invalid request data"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Internal server error"
}
```
