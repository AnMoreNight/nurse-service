**Issues / Symptoms:**

1. In deletion, when selecting **"これ以降のすべての予定"**, all previous schedules also seem to be deleted.
   * Example: For a schedule repeated every Sunday, if you delete 2/8 (Sun) and select **"これ以降のすべての予定"**, the schedule on 2/1 (Sun) is also deleted. It should remain.
   > **✅ Fixed:** Changed `schedule_controller.py` delete logic to set `rule.end_date = day_before` (one day before the occurrence) instead of ending on the occurrence date itself. This ensures only future occurrences are removed.  
2. After adding a user, the new user does not appear in **Shift Management** or the **Calendar** until the page is reloaded, which could cause confusion.
   > **✅ Fixed:** Added `await loadUsers()` call after user creation/update in `UserManagementConnected.tsx` so the staff list refreshes immediately without requiring a page reload.  
3. In **Shift Management → Staff Edit**, setting the **入職日 (start date)** allows the staff to appear in the calendar even for dates before the start date.
   * This feature is of low importance, so the **入職日** field can be removed. Newly added staff can simply appear in all dates.
   > **✅ Fixed:** Removed the `joinedDate` field entirely from `StaffFormModal.tsx`. Staff now appear in all date views without any start-date filtering.
4. In **Detailed Settings**, when navigating away without saving, no popup appears to indicate that settings are unsaved.
   * Could a popup like **"設定が保存されていません"** be added to alert users if they leave without saving?
   > **✅ Fixed:** Added `beforeunload` event listener in `CompanySettings.tsx` that tracks an `isDirty` flag. Browser shows a "Leave site?" warning when navigating away with unsaved changes.  
5. In the general user view, notes can be entered in the calendar, but cannot be saved.
   * This is okay; general users are not required to save notes.
   > **By design:** General users can view details but saves are blocked at the API level via `require_company_admin` middleware. No change needed.  
6. change the placeholder for notes from **"申し送り事項などを入力…"** to **"情報を入力…"**.
   > **✅ Fixed:** Updated placeholder text in `VisitModal.tsx` from `"申し送り事項などを入力..."` to `"情報を入力..."`.  
7. CSV files exported from **Data Output** are garbled in Excel.
   * Could this be fixed, for example, using BOM UTF-8 encoding to prevent garbling?
   > **✅ Fixed:** Added UTF-8 BOM (`\ufeff`) at the start of CSV output in both `schedule_controller.py` and `shift_controller.py`. Excel now correctly detects encoding and displays Japanese characters.  
8. When multiple administrators are working or general users are viewing schedules, changes are not reflected in real-time; a reload is required to see updates.
   * Could this be updated to reflect changes in real-time?
   > **✅ Fixed:** Added 8-second polling in `context.tsx` that compares data hashes and auto-refreshes staff/visits/shifts when changes are detected. Pauses when tab is hidden to save resources.  
9. Regarding repeating schedules (**毎週, etc.**):
   * Currently, if a schedule created as repeating is moved (automatically changed to **繰り返し：しない**), then moved again and saved with **"これ以降のすべての予定"**, a new repeating schedule is sometimes created.
   * We would like to improve this as follows (AI helped draft this requirement):
   > **✅ Fixed:** Three changes — (1) `context.tsx`: exceptions now get `recurrence:'none'` so scope dialog doesn't appear. (2) `schedule_controller.py`: added exception migration during series splits. (3) Added safety fallback treating exception + 'future' scope as single-day update.  
10. **Goal: ✅**
    * When editing a schedule that has been cut out from a repeating series (**繰り返し：しない**), unnecessary confirmation dialogs (**この予定 / これ以降のすべて**) should not appear. The single schedule should be updated immediately.
    > **✅ Fixed:** `context.tsx` line 113 now checks `!schedule.is_exception` and `schedule.recurring_rule` in addition to `recurring_series_id`, so exceptions are treated as non-recurring.  
11. **Trigger Condition: ✅**
    * The schedule was originally part of a repeating series.
    * The schedule has already been edited to **繰り返し：しない** (independent from the parent repeating series).
    > **✅ Handled:** Backend identifies these via `is_exception=True` + `recurring_rule_id=None`. Frontend detects them via the updated `scheduleToVisit()` mapping.  
12. **Current Process: ✅**
    * Move a schedule originally created as repeating and now set to **繰り返し：しない**.
    * Save triggers the dialog (**この予定 / これ以降のすべて**).
    * User selects an option, which may unintentionally generate a new repeating rule.
    > **✅ Fixed:** The scope dialog no longer appears for exception schedules. `Dashboard.tsx` drag check and `VisitModal.tsx` both rely on `visit.recurrence === 'custom'`, which is now `'none'` for exceptions.  
13. **Proposed Process:✅**
    * Move a schedule set to **繰り返し：しない**.
    * The system detects it is independent.
    * Update immediately without displaying a dialog.
      * Do not create a new repeating schedule.
      * Maintain the schedule as a single-day event.
    > **✅ Implemented:** Drag now sends `update_scope: 'this'` directly (no dialog). Backend updates the single exception in-place without touching the parent series or creating new rules.  
14. **Expected Effect: ✅**
    * More efficient: 1 action (drag) completes the update.
    * Data integrity: prevents creation of unintended repeated schedules, avoiding duplication and clutter in the calendar.
    > **✅ Achieved:** Single drag completes the move. Also added `POST /schedules/cleanup-duplicates` endpoint to clean up any existing duplicates from before the fix.

**iPhone Specific Issues: ✅**

* The edit screen does not fully display (cancel/save buttons are hidden), so input is not possible.
  * adjust so that all elements are visible.
  > **✅ Fixed:** Added `env(safe-area-inset-bottom)` padding and `pb-safe` class in `globals.css` for modal footers. Buttons are now visible on iPhone.
* In the calendar view, when selecting dates, the arrow (red box) to switch months is cut off.
  * adjust so that the red-box portion is fully visible.
  > **✅ Fixed:** Added `overflow: visible !important` override in `globals.css` for the calendar navigation container.
* Ideally, on iPhone, the calendar view should display about 3 staff per screen.
  > **✅ Fixed:** Set responsive column widths in `Dashboard.tsx` — `w-[200px] md:w-[220px] lg:w-[280px]` — and added `-webkit-overflow-scrolling: touch` for smooth iOS scrolling.
  ![][image1]
