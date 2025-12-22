# Frontend API Integration

## Setup

1. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

2. Update the API URL if needed:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Services

All backend API calls are organized in the `services/` directory:

- **authService** - Login, password reset, invitations
- **companyService** - Company CRUD (System Admin)
- **userService** - User management, invitations, sort orders
- **patientService** - Patient CRUD with search
- **scheduleService** - Schedule CRUD, recurring, copy, CSV export
- **shiftService** - Shift CRUD, weekly rules, auto-reflection, CSV export
- **statusService** - Schedule status management

## Usage Example

```typescript
import { authService, scheduleService } from '@/services';

// Login
const response = await authService.login({ email, password });
authService.storeAuth(response.access_token, response.user);

// Get schedules
const schedules = await scheduleService.getAll('2025-01-01', '2025-01-31');

// Create schedule
await scheduleService.create({
  patient_name: 'Patient Name',
  start_time: '2025-01-15T10:00:00',
  end_time: '2025-01-15T11:00:00',
  status_id: 'status-uuid',
  assigned_user_ids: ['user-uuid-1', 'user-uuid-2'],
});

// Export CSV
const blob = await scheduleService.exportCSV('2025-01-01', '2025-01-31');
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'schedules.csv';
a.click();
```

## API Client

The `apiClient` automatically:
- Adds JWT token from localStorage to all requests
- Handles JSON serialization
- Throws errors with proper messages
- Supports CSV downloads

## Authentication Flow

1. User logs in via `authService.login()`
2. Token and user info stored in localStorage
3. All subsequent API calls include the token
4. On logout, call `authService.logout()` to clear storage

## Role-Based Access

The backend enforces role-based access:
- **SuperAdmin** - All company operations
- **CompanyAdmin** - Full management within company
- **NormalUser** - View schedules only

Frontend should check user role from `authService.getStoredUser()` to show/hide UI elements.
