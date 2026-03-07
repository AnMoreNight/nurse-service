"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthUser, UserAccount, Staff, Visit, ShiftAssignment, CompanySettings, UserRole } from '@/lib/types';
import { authService } from '@/services/authService';
import { userService, User } from '@/services/userService';
import { scheduleService, Schedule } from '@/services/scheduleService';
import { shiftService, Shift } from '@/services/shiftService';
import { statusService, ScheduleStatus } from '@/services/statusService';
import { createDateTime } from '@/lib/timeUtils';

// Default settings for fallback
const DEFAULT_SETTINGS: CompanySettings = {
  visitStatuses: [
    { key: 'REGULAR_NURSE', label: '通常訪問(看護)', color: 'blue' },
    { key: 'REGULAR_REHAB', label: '通常訪問(リハ)', color: 'emerald' },
    { key: 'EMERGENCY', label: '緊急訪問', color: 'red' },
    { key: 'OTHER', label: 'その他', color: 'orange' },
    { key: 'CANCELLED', label: 'キャンセル', color: 'gray' },
  ],
  jobTitles: ['看護師', '理学療法士(PT)', '作業療法士(OT)', '言語聴覚士(ST)', '事務']
};

interface AppContextType {
  // Auth state
  currentUser: AuthUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  originalUser: AuthUser | null;
  originalToken: string | null;
  setImpersonating: (user: AuthUser | null, isImpersonating: boolean) => void;

  // Data state
  staff: Staff[];
  visits: Visit[];
  shifts: ShiftAssignment[];
  statuses: ScheduleStatus[];
  companySettings: CompanySettings;
  setShifts: React.Dispatch<React.SetStateAction<ShiftAssignment[]>>;

  // Data loading - targeted refresh functions
  isRefreshing: boolean;
  refreshData: (silent?: boolean) => Promise<void>;
  refreshStaff: () => Promise<void>;
  refreshVisits: () => Promise<void>;
  refreshShifts: () => Promise<void>;
  refreshStatuses: () => Promise<void>;

  // Real-time updates
  isPollingActive: boolean;

  // Staff operations
  addStaff: (data: Partial<Staff>) => Promise<void>;
  updateStaff: (id: string, data: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  resignStaff: (id: string) => Promise<void>;
  reorderStaff: (sortOrders: { userId: string; sortOrder: number }[]) => Promise<void>;

  // Schedule operations
  addSchedule: (data: any) => Promise<void>;
  updateSchedule: (id: string, data: any, scope?: string) => Promise<void>;
  deleteSchedule: (id: string, scope?: string, occurrenceDate?: string) => Promise<void>;

  // Shift operations
  updateShift: (staffId: string, date: string, type: string | null) => Promise<void>;
  applyWeeklyRules: (startDate: string, endDate: string) => Promise<void>;

  // Status operations (for admin)
  addStatus: (data: { name: string; color: string }) => Promise<void>;
  updateStatus: (id: string, data: Partial<ScheduleStatus>) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;

  // Error handling
  error: string | null;
  clearError: () => void;

  // Toast
  showToast: (message: string, type?: 'success' | 'error') => void;
  toastMessage: string | null;
  toastType: 'success' | 'error';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to convert API User to Staff type
function userToStaff(user: User): Staff {
  return {
    id: user.user_id,
    companyId: user.company_id || '',
    name: user.name,
    jobTitle: user.job_title,
    color: user.display_color || 'blue',
    avatar: user.name.slice(0, 2).toUpperCase(),
    joinedDate: user.join_date || user.created_at.split('T')[0],
    leftDate: user.left_date,
    defaultHolidayWeekDays: user.default_holiday_weekdays || [],
  };
}

// Helper to convert API Schedule to Visit type
function scheduleToVisit(schedule: Schedule): Visit {
  return {
    id: schedule.schedule_id,
    companyId: schedule.company_id,
    staffIds: schedule.assigned_users.map(u => u.user_id),
    patientName: schedule.patient_name,
    address: schedule.visit_address,
    date: schedule.start_time.split('T')[0],
    startTime: schedule.start_time.split('T')[1]?.slice(0, 5) || '09:00',
    endTime: schedule.end_time.split('T')[1]?.slice(0, 5) || '10:00',
    status: schedule.status_id,
    recurrence: (schedule.recurring_series_id && schedule.recurring_rule && !schedule.is_exception) ? 'custom' : 'none',
    recurrenceRule: schedule.recurring_rule ? {
      frequency: schedule.recurring_rule.frequency as any,
      interval: schedule.recurring_rule.interval || 1,
      weekDays: schedule.recurring_rule.day_of_week || [],
      // Handle week_of_month as array (new format) or single value (legacy)
      weekNos: Array.isArray(schedule.recurring_rule.week_of_month)
        ? schedule.recurring_rule.week_of_month
        : (schedule.recurring_rule.week_of_month ? [schedule.recurring_rule.week_of_month] : []),
      dayOfMonth: schedule.recurring_rule.day_of_month,
      endType: schedule.recurring_rule.end_date ? 'date' : 'never',
      endDate: schedule.recurring_rule.end_date,
      endCount: undefined,
    } : undefined,
    notes: schedule.memo || '',
  };
}

// Helper to convert API Shift to ShiftAssignment type
function shiftToAssignment(shift: Shift): ShiftAssignment {
  // Map backend shift types to frontend types
  const typeMap: Record<string, string> = {
    'Workday': 'work',
    'ScheduledDayOff': 'holiday',
    'NightDuty1': 'night1',
    'NightDuty2': 'night2',
    'NightDuty1DayOff': 'night1_holiday',
    'NightDuty2DayOff': 'night2_holiday',
  };

  return {
    id: shift.shift_id,
    companyId: shift.company_id,
    staffId: shift.user_id,
    date: shift.shift_date,
    type: (typeMap[shift.shift_type] || shift.shift_type) as any,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonatingState] = useState(false);
  const [originalUser, setOriginalUser] = useState<AuthUser | null>(null);
  const [originalToken, setOriginalToken] = useState<string | null>(null);

  // Data state
  const [staff, setStaff] = useState<Staff[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [statuses, setStatuses] = useState<ScheduleStatus[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_SETTINGS);

  // Refresh tracking - counts concurrent active refreshes
  const [activeRefreshes, setActiveRefreshes] = useState(0);
  const isRefreshing = activeRefreshes > 0;

  // Error & toast state
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Real-time polling state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string>('');
  const [isPollingActive, setIsPollingActive] = useState(false);

  // Generate hash of current data for change detection
  const generateDataHash = useCallback(() => {
    const visitSummary = visits.slice(0, 50).map(v =>
      `${v.id}:${v.startTime}:${v.staffIds?.join(',') || ''}`
    ).join('|');
    const dataToHash = {
      staffCount: staff.length,
      visitsCount: visits.length,
      shiftsCount: shifts.length,
      statusesCount: statuses.length,
      visitSummary,
    };
    return JSON.stringify(dataToHash);
  }, [staff, visits, shifts, statuses]);

  // Start real-time polling
  const startPolling = useCallback(() => {
    if (!currentUser || pollingIntervalRef.current) return;

    setIsPollingActive(true);
    pollingIntervalRef.current = setInterval(async () => {
      // Only poll if document is visible, user is logged in, and no active refreshes
      if (document.hidden || !currentUser || activeRefreshes > 0) return;

      try {
        // Quick check - get data counts/timestamps without full refresh
        const [staffData, scheduleData, shiftData, statusData] = await Promise.all([
          userService.getAll(currentUser.company_id),
          scheduleService.getAll(undefined, undefined, undefined, currentUser.company_id),
          shiftService.getAll(),
          statusService.getAll(currentUser.company_id),
        ]);

        // Generate hash of new data - include enough detail to detect moves/updates
        const visitSummary = scheduleData.slice(0, 50).map((s: any) =>
          `${s.schedule_id}:${s.start_time}:${s.assigned_user_ids?.join(',') || ''}`
        ).join('|');
        const newDataHash = JSON.stringify({
          staffCount: staffData.length,
          visitsCount: scheduleData.length,
          shiftsCount: shiftData.length,
          statusesCount: statusData.length,
          visitSummary,
        });

        // Only refresh if data actually changed
        if (newDataHash !== lastDataHashRef.current) {
          lastDataHashRef.current = newDataHash;

          // Convert and update all data — same filter as refreshStaff()
          setStaff(staffData.filter(u => u.is_active && u.role !== 'SUPER_ADMIN').map(userToStaff));
          setVisits(scheduleData.map(scheduleToVisit));
          setShifts(shiftData.map(shiftToAssignment));
          setStatuses(statusData);
          
          console.log('🔄 Real-time update: Data refreshed');
        }
      } catch (error) {
        console.warn('⚠️  Real-time update failed:', error);
        // Don't stop polling on errors, just log them
      }
    }, 8000); // Poll every 8 seconds
  }, [currentUser, activeRefreshes]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPollingActive(false);
    }
  }, []);

  // Handle document visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, reduce polling frequency or stop
        stopPolling();
      } else if (currentUser && !pollingIntervalRef.current) {
        // Page visible, resume polling
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, startPolling, stopPolling]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Handle impersonation mode
  const setImpersonating = useCallback((user: AuthUser | null, isImpersonating: boolean) => {
    if (isImpersonating && user) {
      // Save original user before impersonating
      // Keep the token - system admin can access all companies
      setOriginalUser(currentUser);
      setOriginalToken(localStorage.getItem('token'));
      setCurrentUser(user);
      setIsImpersonatingState(true);
    } else {
      // Restore original user
      if (originalUser) {
        setCurrentUser(originalUser);
      } else {
        setCurrentUser(null);
      }
      setIsImpersonatingState(false);
      setOriginalUser(null);
      setOriginalToken(null);
    }
  }, [currentUser, originalUser, originalToken]);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    const token = localStorage.getItem('token');
    if (stored && token) {
      // Check if token is expired before restoring session
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          // Token expired — clear storage and go to login
          localStorage.removeItem('currentUser');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoading(false);
        return;
      }
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        // Keep isLoading=true - refreshData will set it false after data loads
      } catch {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Persist user to localStorage (only if not impersonating)
  useEffect(() => {
    if (currentUser && !isImpersonating) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      document.cookie = `currentUser=${JSON.stringify(currentUser)}; path=/`;
    } else if (!currentUser) {
      localStorage.removeItem('currentUser');
      document.cookie = 'currentUser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, [currentUser, isImpersonating]);

  // Update data hash when data changes
  useEffect(() => {
    lastDataHashRef.current = generateDataHash();
  }, [generateDataHash]);

  // Start/stop polling based on authentication
  useEffect(() => {
    if (currentUser && !document.hidden) {
      startPolling();
    } else {
      stopPolling();
    }

    // Cleanup on unmount
    return () => stopPolling();
  }, [currentUser, startPolling, stopPolling]);

  // Individual refresh functions - fetch only the data you need
  const refreshStaff = useCallback(async () => {
    if (!currentUser || !localStorage.getItem('token')) return;
    setActiveRefreshes(c => c + 1);
    try {
      const users = await userService.getAll(currentUser.company_id);
      const staffMembers = users
        .filter(u => u.is_active && u.role !== 'SUPER_ADMIN')
        .map(userToStaff)
        .sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0));
      setStaff(staffMembers);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff');
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser]);

  const refreshVisits = useCallback(async () => {
    if (!currentUser || !localStorage.getItem('token')) return;
    setActiveRefreshes(c => c + 1);
    try {
      const schedules = await scheduleService.getAll(undefined, undefined, undefined, currentUser.company_id);
      setVisits(schedules.map(scheduleToVisit));
    } catch (err: any) {
      setError(err.message || 'Failed to load visits');
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser]);

  const refreshShifts = useCallback(async () => {
    if (!currentUser || !localStorage.getItem('token')) return;
    setActiveRefreshes(c => c + 1);
    try {
      const shiftsData = await shiftService.getAll(undefined, undefined, undefined, currentUser.company_id);
      setShifts(shiftsData.map(shiftToAssignment));
    } catch (err: any) {
      setError(err.message || 'Failed to load shifts');
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser]);

  const refreshStatuses = useCallback(async () => {
    if (!currentUser || !localStorage.getItem('token')) return;
    setActiveRefreshes(c => c + 1);
    try {
      const statusList = await statusService.getAll(currentUser.company_id);
      setStatuses(statusList);

      if (statusList.length > 0) {
        let jobTitles = DEFAULT_SETTINGS.jobTitles;
        if (currentUser.company_id) {
          try {
            const { companyService } = await import('@/services/companyService');
            const jobTitlesSetting = await companyService.getSetting(currentUser.company_id, 'jobTitles');
            if (jobTitlesSetting?.value && Array.isArray(jobTitlesSetting.value)) {
              jobTitles = jobTitlesSetting.value;
            }
          } catch {
            // Setting might not exist yet, use defaults
          }
        }

        setCompanySettings({
          visitStatuses: statusList.map(s => ({
            key: s.status_id,
            label: s.name,
            color: s.color,
          })),
          jobTitles,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load statuses');
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser]);

  // Full refresh - fetches all data in parallel (used on login/error recovery)
  const refreshData = useCallback(async (silent = false) => {
    if (!currentUser || !localStorage.getItem('token')) {
      setStaff([]);
      setVisits([]);
      setShifts([]);
      setStatuses([]);
      return;
    }

    if (!silent) setIsLoading(true);
    await Promise.allSettled([refreshStaff(), refreshVisits(), refreshShifts(), refreshStatuses()]);
    setIsLoading(false);
  }, [refreshStaff, refreshVisits, refreshShifts, refreshStatuses, currentUser]);

  // Refresh data when user changes
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser, refreshData]);

  // Staff operations
  const addStaff = useCallback(async (data: Partial<Staff>) => {
    try {
      await userService.create({
        login_id: `${data.name?.replace(/\s/g, '').toLowerCase()}.staff`,
        password: 'temppass123',
        role: 'NORMAL_USER',
        name: data.name || '',
        job_title: data.jobTitle,
        display_color: data.color,
        join_date: new Date().toISOString().split('T')[0], // Set current date as default
      });
      await refreshStaff();
      showToast('スタッフを追加しました');
    } catch (err: any) {
      throw err;
    }
  }, [refreshStaff, showToast]);

  const updateStaff = useCallback(async (id: string, data: Partial<Staff>) => {
    try {
      await userService.update(id, {
        name: data.name,
        job_title: data.jobTitle,
        display_color: data.color,
        left_date: data.leftDate,
        default_holiday_weekdays: data.defaultHolidayWeekDays,
      });

      await refreshStaff();
      showToast('スタッフを更新しました');
    } catch (err: any) {
      throw err;
    }
  }, [refreshStaff, showToast]);

  const deleteStaff = useCallback(async (id: string) => {
    try {
      // Permanent delete - removes user and all related data
      await userService.delete(id);
      await refreshStaff();
      showToast('スタッフを完全に削除しました');
    } catch (err: any) {
      throw err;
    }
  }, [refreshStaff, showToast]);

  const resignStaff = useCallback(async (id: string) => {
    try {
      // Soft delete for resignation - preserves employment schedules
      await userService.resign(id);
      await refreshStaff();
      showToast('退職処理が完了しました');
    } catch (err: any) {
      throw err;
    }
  }, [refreshStaff, showToast]);

  const reorderStaff = useCallback(async (sortOrders: { userId: string; sortOrder: number }[]) => {
    try {
      await userService.updateSortOrders(
        sortOrders.map(so => ({ user_id: so.userId, sort_order: so.sortOrder }))
      );
      await refreshStaff();
    } catch (err: any) {
      throw err;
    }
  }, [refreshStaff]);

  // Schedule operations
  const addSchedule = useCallback(async (data: any) => {
    setActiveRefreshes(c => c + 1);
    try {
      await scheduleService.create({
        company_id: currentUser?.company_id,
        patient_name: data.patientName,
        visit_address: data.address,
        start_time: createDateTime(data.date, data.startTime),
        end_time: createDateTime(data.date, data.endTime),
        status_id: data.status,
        memo: data.notes,
        assigned_user_ids: data.staffIds,
        recurring_rule: data.recurrenceRule ? {
          frequency: data.recurrenceRule.frequency,
          interval: data.recurrenceRule.interval,
          day_of_week: data.recurrenceRule.weekDays,
          week_of_month: data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0
            ? data.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: data.recurrenceRule.frequency === 'monthly' &&
            data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0 &&
            data.recurrenceRule.weekDays && data.recurrenceRule.weekDays.length > 0
            ? data.recurrenceRule.weekDays[0] : undefined,
          day_of_month: data.recurrenceRule.dayOfMonth,
          start_date: data.date,
          end_date: data.recurrenceRule.endDate,
        } : undefined,
      });
      await refreshVisits();
      showToast('スケジュールを追加しました');
    } catch (err: any) {
      throw err;
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser, refreshVisits, showToast]);

  const updateSchedule = useCallback(async (id: string, data: any, scope?: string) => {
    setActiveRefreshes(c => c + 1);
    try {
      await scheduleService.update(id, {
        company_id: currentUser?.company_id,
        patient_name: data.patientName,
        visit_address: data.address,
        start_time: data.date && data.startTime ? createDateTime(data.date, data.startTime) : undefined,
        end_time: data.date && data.endTime ? createDateTime(data.date, data.endTime) : undefined,
        status_id: data.status,
        memo: data.notes,
        assigned_user_ids: data.staffIds,
        recurring_rule: data.recurrenceRule ? {
          frequency: data.recurrenceRule.frequency,
          interval: data.recurrenceRule.interval,
          day_of_week: data.recurrenceRule.weekDays,
          week_of_month: data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0
            ? data.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: data.recurrenceRule.frequency === 'monthly' &&
            data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0 &&
            data.recurrenceRule.weekDays && data.recurrenceRule.weekDays.length > 0
            ? data.recurrenceRule.weekDays[0] : undefined,
          day_of_month: data.recurrenceRule.dayOfMonth,
          start_date: data.date,
          end_date: data.recurrenceRule.endDate,
        } : undefined,
        update_scope: scope as any,
      });
      await refreshVisits();
      showToast('スケジュールを更新しました');
    } catch (err: any) {
      throw err;
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [currentUser, refreshVisits, showToast]);

  const deleteSchedule = useCallback(async (id: string, scope?: string, occurrenceDate?: string) => {
    setActiveRefreshes(c => c + 1);
    try {
      await scheduleService.delete(id, scope, occurrenceDate);
      await refreshVisits();
      showToast('スケジュールを削除しました');
    } catch (err: any) {
      throw err;
    } finally {
      setActiveRefreshes(c => Math.max(0, c - 1));
    }
  }, [refreshVisits, showToast]);

  // Shift operations
  const updateShift = useCallback(async (staffId: string, date: string, type: string | null) => {
    try {
      // Map frontend types to backend
      const typeMap: Record<string, string> = {
        'work': 'Workday',
        'holiday': 'ScheduledDayOff',
        'night1': 'NightDuty1',
        'night2': 'NightDuty2',
        'night1_holiday': 'NightDuty1DayOff',
        'night2_holiday': 'NightDuty2DayOff',
      };

      // Find existing shift
      const existingShift = shifts.find(s => s.staffId === staffId && s.date === date);

      // Optimistic update - immediately reflect in UI
      const tempShifts = [...shifts];
      const existingIndex = tempShifts.findIndex(s => s.staffId === staffId && s.date === date);

      if (type && type !== 'none') {
        const newShift: ShiftAssignment = {
          id: existingShift?.id || `temp-${Date.now()}`,
          companyId: currentUser?.company_id || '',
          staffId: staffId,
          date: date,
          type: type as any
        };

        if (existingIndex >= 0) {
          tempShifts[existingIndex] = newShift;
        } else {
          tempShifts.push(newShift);
        }
        setShifts(tempShifts);

        // Background API call
        if (existingShift) {
          await shiftService.update(existingShift.id, { shift_type: typeMap[type] || type });
        } else {
          await shiftService.create({
            user_id: staffId,
            shift_date: date,
            shift_type: typeMap[type] || type,
          });
        }
      } else if (existingShift) {
        // Remove shift optimistically
        if (existingIndex >= 0) {
          tempShifts.splice(existingIndex, 1);
          setShifts(tempShifts);
        }
        await shiftService.delete(existingShift.id);
      }

      // Refresh from server to get real data
      await refreshShifts();
    } catch (err: any) {
      // On error, revert by refreshing
      await refreshShifts();
      throw err;
    }
  }, [shifts, refreshShifts, currentUser]);

  const applyWeeklyRules = useCallback(async (startDate: string, endDate: string) => {
    try {
      await shiftService.applyWeeklyRules(startDate, endDate);
      await refreshShifts();
      showToast('週間ルールを適用しました');
    } catch (err: any) {
      throw err;
    }
  }, [refreshShifts, showToast]);

  // Status operations (admin only)
  const addStatus = useCallback(async (data: { name: string; color: string }) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.create(data);
      await refreshStatuses();
      showToast('ステータスを追加しました');
    } catch (err: any) {
      throw err;
    }
  }, [currentUser, refreshStatuses, showToast]);

  const updateStatus = useCallback(async (id: string, data: Partial<ScheduleStatus>) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.update(id, data);
      await refreshStatuses();
      showToast('ステータスを更新しました');
    } catch (err: any) {
      throw err;
    }
  }, [currentUser, refreshStatuses, showToast]);

  const deleteStatus = useCallback(async (id: string) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.delete(id);
      await refreshStatuses();
      showToast('ステータスを削除しました');
    } catch (err: any) {
      throw err;
    }
  }, [currentUser, refreshStatuses, showToast]);

  const isAuthenticated = currentUser !== null && (localStorage.getItem('token') !== null || isImpersonating);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      isAuthenticated,
      isLoading,
      isImpersonating,
      originalUser,
      originalToken,
      setImpersonating,
      staff,
      visits,
      shifts,
      setShifts,
      statuses,
      companySettings,
      isRefreshing,
      isPollingActive,
      refreshData,
      refreshStaff,
      refreshVisits,
      refreshShifts,
      refreshStatuses,
      addStaff,
      updateStaff,
      deleteStaff,
      resignStaff,
      reorderStaff,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      updateShift,
      applyWeeklyRules,
      addStatus,
      updateStatus,
      deleteStatus,
      error,
      clearError,
      showToast,
      toastMessage,
      toastType,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Role-based access helpers
export function useRoleAccess() {
  const { currentUser } = useApp();

  return {
    isSystemAdmin: currentUser?.role === 'SUPER_ADMIN',
    isCompanyAdmin: currentUser?.role === 'COMPANY_ADMIN',
    isNormalUser: currentUser?.role === 'NORMAL_USER',

    // Permission checks
    canManageUsers: currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'SUPER_ADMIN',
    canManageSettings: currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'SUPER_ADMIN',
    canEditSchedules: currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'SUPER_ADMIN',
    canEditShifts: currentUser?.role === 'COMPANY_ADMIN' || currentUser?.role === 'SUPER_ADMIN',
    isReadOnly: currentUser?.role === 'NORMAL_USER',
  };
}
