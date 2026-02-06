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

// Common logic to check if a visit occurs on a specific date.
// The backend already expands recurring schedules into individual occurrences
// (each with its own date), so we only need a simple date comparison here.
// Previously, this function re-applied recurrence expansion on the frontend,
// which caused N^2 duplicate entries for weekly/monthly recurring schedules.
export const checkVisitVisibility = (visit: Visit, targetDate: string): boolean => {
  return visit.date === targetDate;
};

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
