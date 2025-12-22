# Frontend Backend Integration - Complete

## ✅ What's Been Created

### API Services Layer (`services/`)
All backend endpoints are now accessible through TypeScript services:

- **authService** - Login, password reset, invitations
- **companyService** - Company CRUD (System Admin)
- **userService** - User/staff management, sort orders
- **patientService** - Patient CRUD with search
- **scheduleService** - Schedule CRUD, recurring, copy, CSV export
- **shiftService** - Shift CRUD, weekly rules, auto-reflection, CSV
- **statusService** - Schedule status management

### New Components
- **LoginConnected.tsx** - API-connected login (replaces mock)
- **NurseAppConnected.tsx** - Fully API-connected main app

## 🔄 Migration Path

### Option 1: Use New Connected Version (Recommended)

Replace the dashboard page to use the connected version:

```bash
# Rename files
mv app/(dashboard)/dashboard/page.tsx app/(dashboard)/dashboard/page-mock.tsx
mv app/(dashboard)/dashboard/page-connected.tsx app/(dashboard)/dashboard/page.tsx
```

### Option 2: Gradual Migration

Keep both versions and switch between them:

```typescript
// In app/(dashboard)/dashboard/page.tsx
import NurseApp from '@/components/NurseApp'; // Mock version
import NurseAppConnected from '@/components/NurseAppConnected'; // API version

export default function DashboardPage() {
  // Toggle between versions
  const USE_BACKEND = process.env.NEXT_PUBLIC_USE_BACKEND === 'true';
  return USE_BACKEND ? <NurseAppConnected /> : <NurseApp />;
}
```

## 🚀 Setup Instructions

### 1. Environment Configuration

Create `.env.local`:
```bash
cp .env.local.example .env.local
```

Update with your backend URL:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Start Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start Frontend

```bash
cd Frontend
npm install  # if needed
npm run dev
```

### 4. Create Test Data

Use the backend to create:
1. A company (System Admin)
2. Users/staff (Company Admin)
3. Schedule statuses (auto-created with company)

## 📋 API Mapping

### Frontend → Backend Data Mapping

**Staff (Frontend) → User (Backend)**
```typescript
Frontend: { id, name, jobTitle, color, avatar }
Backend:  { user_id, name, job_title, display_color, avatar_url }
```

**Visit (Frontend) → Schedule (Backend)**
```typescript
Frontend: { id, patientName, date, startTime, endTime, staffIds, status }
Backend:  { schedule_id, patient_name, start_time, end_time, assigned_users, status_id }
```

**Shift (Frontend) → Shift (Backend)**
```typescript
Frontend: { id, staffId, date, type }
Backend:  { shift_id, user_id, shift_date, shift_type }
```

## 🔐 Authentication Flow

1. User logs in with email/password
2. Backend returns JWT token + user info
3. Token stored in localStorage
4. All API calls include token in Authorization header
5. Backend validates token and enforces role-based access

## 🎯 Key Features Implemented

✅ Real-time data from backend  
✅ JWT authentication  
✅ Role-based access control  
✅ CRUD operations for all entities  
✅ CSV export  
✅ Staff reordering  
✅ Schedule drag & drop (with API update)  
✅ Shift management with auto-reflection  
✅ Error handling with toast notifications  
✅ Loading states  

## 🐛 Known Limitations

1. **Recurring schedules** - Backend supports it, frontend needs recurrence UI updates
2. **Patient management** - Not exposed in UI yet (API ready)
3. **Company settings** - Uses default statuses, custom status UI needed
4. **Search functionality** - API ready, UI integration pending
5. **Weekly off rules** - API ready, UI integration pending

## 📝 Next Steps

To complete the integration:

1. **Update VisitModal** to handle recurring schedule creation
2. **Add patient management UI** (use patientService)
3. **Add search modal** integration with scheduleService.getAll(patientName)
4. **Add weekly off rules UI** in ShiftManager
5. **Add custom status management** in settings view
6. **Handle schedule copy** feature with scheduleService.copy()

## 🔧 Troubleshooting

**CORS errors?**
- Backend has CORS enabled for all origins
- Check backend is running on correct port

**401 Unauthorized?**
- Token expired or invalid
- Logout and login again

**Data not loading?**
- Check browser console for errors
- Verify backend API is accessible
- Check DATABASE_URL in backend .env

**Type errors?**
- Frontend types may need adjustment based on actual backend responses
- Check browser network tab for actual API response structure
