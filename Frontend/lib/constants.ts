import { Visit, Staff, ShiftAssignment, ShiftType, CompanySettings } from './types';

// Helper for dates to ensure Local Time usage
export const toLocalISOString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateForCSV = (isoDateStr: string) => {
  if (!isoDateStr) return '';
  const [y, m, d] = isoDateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const w = weekLabels[dateObj.getDay()];
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')} (${w})`;
};

// Calculates the effective shift type considering defaults and overrides
// Returns 'none' if it's a regular working day (implied), otherwise the specific ShiftType
export const getEffectiveShiftType = (staff: Staff, dateStr: string, shifts: ShiftAssignment[]): ShiftType | 'none' => {
  const shift = shifts.find(s => s.staffId === staff.id && s.date === dateStr);

  // Explicit override exists (including 'work', 'holiday', 'night1_holiday' etc.)
  if (shift) {
    return shift.type || 'none';
  }

  // Check Default Holidays
  if (staff.defaultHolidayWeekDays) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    if (staff.defaultHolidayWeekDays.includes(dayOfWeek)) {
      return 'holiday';
    }
  }

  // Default is working ('none')
  return 'none';
};

// Visibility check cache - dramatically improves performance
// With 100 visits × 30 days = 3,000 checks per month view
const visibilityCache = new Map<string, boolean>();
const MAX_CACHE_SIZE = 5000;

// Clear cache when it grows too large (simple LRU-like behavior)
function clearCacheIfNeeded() {
  if (visibilityCache.size > MAX_CACHE_SIZE) {
    // Keep newest 50% of entries by clearing oldest
    const entries = Array.from(visibilityCache.entries());
    visibilityCache.clear();
    // Re-add second half (newest entries)
    entries.slice(Math.floor(entries.length / 2)).forEach(([k, v]) => {
      visibilityCache.set(k, v);
    });
  }
}

// Common logic to check if a visit occurs on a specific date (handles recurrence)
export const checkVisitVisibility = (visit: Visit, targetDate: string): boolean => {
  // Check cache first
  const cacheKey = `${visit.id}-${targetDate}`;
  if (visibilityCache.has(cacheKey)) {
    return visibilityCache.get(cacheKey)!;
  }

  // Calculate visibility
  const result = calculateVisibility(visit, targetDate);

  // Cache the result
  visibilityCache.set(cacheKey, result);
  clearCacheIfNeeded();

  return result;
};

// Internal function that does the actual visibility calculation
function calculateVisibility(visit: Visit, targetDate: string): boolean {
  // 1. Check exclusions (specific dates removed from series)
  if (visit.excludeDates && visit.excludeDates.includes(targetDate)) return false;

  // 2. Check recurrence end date (if series was terminated)
  if (visit.recurrenceEndDate && targetDate > visit.recurrenceEndDate) return false;

  // 3. Simple date match for non-recurring or base date match
  if (visit.date === targetDate) return true;

  // 4. Recurrence rules check
  if (visit.recurrence === 'custom' && visit.recurrenceRule) {
    // Ensure strictly comparable dates (YYYY-MM-DD)
    if (targetDate < visit.date) return false;

    const start = new Date(visit.date);
    const current = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    current.setHours(0, 0, 0, 0);

    const rule = visit.recurrenceRule;
    if (rule.endType === 'date' && rule.endDate && targetDate > rule.endDate) return false;

    if (rule.frequency === 'daily') {
      const diffTime = Math.abs(current.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % rule.interval === 0;
    }
    if (rule.frequency === 'weekly') {
      if (!rule.weekDays.includes(current.getDay())) return false;
      const startWeekStart = new Date(start);
      startWeekStart.setDate(start.getDate() - start.getDay());
      const currentWeekStart = new Date(current);
      currentWeekStart.setDate(current.getDate() - current.getDay());
      const weeksDiff = Math.round((currentWeekStart.getTime() - startWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return weeksDiff >= 0 && weeksDiff % rule.interval === 0;
    }
    if (rule.frequency === 'monthly') {
      const monthsDiff = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
      if (monthsDiff < 0 || monthsDiff % rule.interval !== 0) return false;

      // Monthly by weekday mode (第○曜日)
      if (rule.weekNos && rule.weekNos.length > 0) {
        if (!rule.weekDays.includes(current.getDay())) return false;
        const day = current.getDate();
        const nth = Math.floor((day - 1) / 7) + 1;
        return rule.weekNos.includes(nth);
      }
      // Monthly by date mode (毎月同日)
      else {
        // Use dayOfMonth if specified, otherwise fall back to start date
        const expectedDay = rule.dayOfMonth !== undefined ? rule.dayOfMonth : start.getDate();
        return current.getDate() === expectedDay;
      }
    }
    if (rule.frequency === 'yearly') {
      const yearDiff = current.getFullYear() - start.getFullYear();
      if (yearDiff < 0 || yearDiff % rule.interval !== 0) return false;
      // Check if same month and date
      return current.getMonth() === start.getMonth() && current.getDate() === start.getDate();
    }
  }
  return false;
}

// Default Settings for new company
export const DEFAULT_SETTINGS: CompanySettings = {
  visitStatuses: [
    { key: 'REGULAR_NURSE', label: '通常訪問(看護)', color: 'blue' },
    { key: 'REGULAR_REHAB', label: '通常訪問(リハ)', color: 'emerald' },
    { key: 'EMERGENCY', label: '緊急訪問', color: 'red' },
    { key: 'OTHER', label: 'その他', color: 'orange' },
    { key: 'CANCELLED', label: 'キャンセル', color: 'gray' },
  ],
  jobTitles: ['看護師', '理学療法士(PT)', '作業療法士(OT)', '言語聴覚士(ST)', '事務']
};
