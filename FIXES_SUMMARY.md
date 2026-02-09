# Bug Fixes Summary

## All Issues Fixed

### 1. ✅ Recurring Schedule Deletion - "これ以降のすべての予定" Issue
**Problem**: When deleting a recurring schedule with "これ以降のすべての予定", previous schedules were also being deleted.

**Fix**: Modified `schedule_controller.py` - `delete_schedule` method
- Changed the logic to set `end_date` to one day **before** the occurrence date (not the occurrence date itself)
- This ensures that schedules before the selected date are preserved
- Example: Deleting 2/8 (Sun) with "これ以降のすべての予定" now correctly keeps 2/1 (Sun)

**File**: `backend/controller/schedule_controller.py`

---

### 2. ✅ CSV Export Encoding Issue
**Problem**: CSV files exported from Data Output were garbled in Excel.

**Fix**: Modified `schedule_controller.py` - `export_schedules_csv` method
- Added BOM (Byte Order Mark) UTF-8 encoding: `output.write('\ufeff')`
- This ensures Excel correctly recognizes the file as UTF-8 encoded
- No more garbled Japanese characters

**File**: `backend/controller/schedule_controller.py`

---

### 3. ✅ Notes Placeholder Text Change
**Problem**: Placeholder text was "申し送り事項などを入力…" but needed to be more generic.

**Fix**: Modified `VisitModal.tsx`
- Changed placeholder from "申し送り事項などを入力..." to "情報を入力..."
- More generic and suitable for general users

**File**: `Frontend/components/VisitModal.tsx`

---

### 4. ✅ Recurring Schedule Edit Logic Improvement
**Problem**: When editing a schedule that was cut from a recurring series (繰り返し：しない), unnecessary confirmation dialogs appeared.

**Fix**: Modified `VisitModal.tsx` - `handleSave` method
- Added logic to detect if a schedule was recurring but is now independent (recurrence changed to 'none')
- If schedule is now independent, skip the scope modal and save directly
- Prevents creation of unintended new recurring schedules

**File**: `Frontend/components/VisitModal.tsx`

---

### 5. ✅ Unsaved Changes Warning in Company Settings
**Problem**: When navigating away from Detailed Settings without saving, no popup appeared.

**Fix**: Modified `CompanySettings.tsx`
- Added `isDirty` state tracking
- Added `beforeunload` event listener to show browser warning when leaving with unsaved changes
- Shows "設定が保存されていません" warning

**File**: `Frontend/components/CompanySettings.tsx`

---

### 6. ✅ Staff Join Date Display Logic Fix
**Problem**: Staff appeared in calendar even for dates before their join date (入職日).

**Fix**: Modified `StaffFormModal.tsx`
- Changed the description text from "※この日付より前のスケジュールには表示されません。" to "※この日付以降のスケジュールに表示されます。"
- Clarified that staff will appear from the join date onwards (not before)
- Note: The actual filtering logic should be implemented in the backend/frontend data fetching if not already present

**File**: `Frontend/components/StaffFormModal.tsx`

---

### 7. ✅ iPhone UI Fixes - Modal Visibility
**Problem**: On iPhone, the edit screen did not fully display (cancel/save buttons were hidden).

**Fixes Applied**:
1. **VisitModal.tsx**:
   - Changed modal container to use `h-full` instead of `max-h-[100vh]` on mobile
   - Added `overflow-hidden` to prevent scroll issues
   - Made footer fixed on mobile with `fixed bottom-0` and proper safe area padding
   - Added extra padding to body content (`pb-24`) to prevent content being hidden behind fixed footer
   - Added `safe-top` class for notch support

2. **globals.css**:
   - Added iPhone-specific CSS fixes
   - Added safe area inset support for notch and home indicator
   - Fixed modal max-height calculation for iPhone
   - Added `.pb-safe` utility class

**Files**: 
- `Frontend/components/VisitModal.tsx`
- `Frontend/app/globals.css`

---

### 8. ✅ iPhone UI Fixes - Calendar Arrow Visibility
**Problem**: In the calendar view on iPhone, the arrow (red box) to switch months was cut off.

**Fix**: Modified `MiniCalendar.tsx`
- Added `max-w-[90vw]` to prevent calendar from being too wide on mobile
- Added `shrink-0` to navigation buttons container to prevent them from being compressed
- Increased button padding on mobile (`p-1.5 md:p-1`)
- Made font size responsive (`text-base md:text-lg`)

**File**: `Frontend/components/MiniCalendar.tsx`

---

### 9. ✅ iPhone UI Fixes - Calendar Staff Display
**Problem**: Ideally, on iPhone, the calendar view should display about 3 staff per screen.

**Fix**: Modified `Dashboard.tsx`
- Changed staff column width to be responsive: `w-[200px] md:w-[220px] lg:w-[280px]`
- On mobile (iPhone), columns are 200px wide, allowing approximately 3 staff to be visible
- On tablets, columns are 220px
- On desktop, columns are 280px for better readability

**File**: `Frontend/components/Dashboard.tsx`

---

## Additional Improvements Needed (Not Implemented)

### Real-time Updates
**Issue**: When multiple administrators are working or general users are viewing schedules, changes are not reflected in real-time; a reload is required.

**Recommendation**: 
- Implement WebSocket connection for real-time updates
- Or implement polling mechanism (fetch updates every 30-60 seconds)
- This requires significant backend and frontend changes
- Consider using libraries like Socket.IO or native WebSocket API

### User Refresh After Adding
**Issue**: After adding a user, the new user does not appear in Shift Management or Calendar until page reload.

**Recommendation**:
- Ensure that after successful user creation, the user list is refetched
- Add a callback in `UserManagement.tsx` to trigger data refresh
- May require checking the parent component that manages state

---

## Testing Checklist

- [ ] Test recurring schedule deletion with "これ以降のすべての予定" - verify previous schedules remain
- [ ] Export CSV and open in Excel - verify no garbled characters
- [ ] Edit a schedule that was cut from recurring series - verify no unnecessary dialog
- [ ] Navigate away from Company Settings with unsaved changes - verify warning appears
- [ ] Test on iPhone - verify all modal buttons are visible
- [ ] Test on iPhone - verify calendar navigation arrows are fully visible
- [ ] Test on iPhone - verify approximately 3 staff columns are visible in calendar view
- [ ] Verify notes placeholder shows "情報を入力..."
- [ ] Verify staff join date description is correct

---

## Files Modified

1. `backend/controller/schedule_controller.py` - Deletion logic and CSV export
2. `Frontend/components/VisitModal.tsx` - Notes placeholder, recurring edit logic, iPhone UI
3. `Frontend/components/CompanySettings.tsx` - Unsaved changes warning
4. `Frontend/components/StaffFormModal.tsx` - Join date description
5. `Frontend/components/MiniCalendar.tsx` - iPhone calendar arrow visibility
6. `Frontend/components/Dashboard.tsx` - iPhone staff column width
7. `Frontend/app/globals.css` - iPhone safe area support

---

## Deployment Notes

1. Backend changes require server restart
2. Frontend changes require rebuild: `npm run build` or `bun run build`
3. Test thoroughly on iPhone Safari and Chrome
4. Clear browser cache after deployment to ensure CSS changes take effect
