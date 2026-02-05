"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  // Data loading
  refreshData: (silent?: boolean) => Promise<void>;

  // Staff operations
  addStaff: (data: Partial<Staff>) => Promise<void>;
  updateStaff: (id: string, data: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  resignStaff: (id: string) => Promise<void>;
  reorderStaff: (sortOrders: { userId: string; sortOrder: number }[]) => Promise<void>;

  // Schedule operations
  addSchedule: (data: any) => Promise<void>;
  updateSchedule: (id: string, data: any, scope?: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

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
  showToast: (message: string) => void;
  toastMessage: string | null;
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
    recurrence: schedule.recurring_series_id ? 'custom' : 'none',
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

  // Error & toast state
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
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
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
      } catch {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
      }
    }
    setIsLoading(false);
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

  // Fetch data when user is authenticated
  // silent: if true, don't show loading indicator (for background refreshes)
  const refreshData = useCallback(async (silent = false) => {
    console.log('[Context] refreshData called, silent:', silent, 'currentUser:', currentUser?.user_id?.slice(0, 8));

    if (!currentUser || !localStorage.getItem('token')) {
      console.log('[Context] No user or token, clearing data');
      setStaff([]);
      setVisits([]);
      setShifts([]);
      setStatuses([]);
      return;
    }

    try {
      // Only show loading for explicit refreshes, not background updates
      if (!silent) setIsLoading(true);
      console.log('[Context] Fetching data from API...');

      // Fetch all data in parallel
      const [usersRes, schedulesRes, shiftsRes, statusesRes] = await Promise.allSettled([
        userService.getAll(currentUser?.company_id),
        scheduleService.getAll(undefined, undefined, undefined, currentUser?.company_id),
        shiftService.getAll(undefined, undefined, undefined, currentUser?.company_id),
        statusService.getAll(currentUser?.company_id),
      ]);

      console.log('[Context] API Results:', {
        users: usersRes.status === 'fulfilled' ? usersRes.value : usersRes.reason,
        schedules: schedulesRes.status === 'fulfilled' ? schedulesRes.value : schedulesRes.reason,
        shifts: shiftsRes.status === 'fulfilled' ? shiftsRes.value : shiftsRes.reason,
        statuses: statusesRes.status === 'fulfilled' ? statusesRes.value : statusesRes.reason,
      });

      // Process users -> staff (filter by role for normal users)
      if (usersRes.status === 'fulfilled') {
        const users = usersRes.value;
        console.log('[Context] Raw users:', users);
        const staffMembers = users
          .filter(u => u.is_active && u.role !== 'SUPER_ADMIN')
          .map(userToStaff)
          .sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0));
        console.log('[Context] Processed staff:', staffMembers);
        setStaff(staffMembers);
      } else {
        console.error('[Context] Users fetch failed:', usersRes.reason);
      }

      // Process schedules -> visits
      if (schedulesRes.status === 'fulfilled') {
        const schedules = schedulesRes.value;
        console.log('[Context] Raw schedules:', schedules);

        // Convert to visits and deduplicate by (date, startTime, patientName, staffIds)
        const allVisits = schedules.map(scheduleToVisit);
        const seen = new Set<string>();
        const deduplicatedVisits = allVisits.filter(visit => {
          const staffKey = [...visit.staffIds].sort().join(',');
          const key = `${visit.date}|${visit.startTime}|${visit.patientName}|${staffKey}`;
          if (seen.has(key)) {
            console.log('[Context] Duplicate visit filtered:', key);
            return false;
          }
          seen.add(key);
          return true;
        });

        console.log('[Context] Visits after dedup:', deduplicatedVisits.length, 'from', allVisits.length);
        setVisits(deduplicatedVisits);
      } else {
        console.error('[Context] Schedules fetch failed:', schedulesRes.reason);
      }

      // Process shifts
      if (shiftsRes.status === 'fulfilled') {
        const shiftsData = shiftsRes.value;
        console.log('[Context] Raw shifts:', shiftsData);
        setShifts(shiftsData.map(shiftToAssignment));
      } else {
        console.error('[Context] Shifts fetch failed:', shiftsRes.reason);
      }

      // Process statuses -> company settings
      if (statusesRes.status === 'fulfilled') {
        const statusList = statusesRes.value;
        setStatuses(statusList);

        // Convert to company settings format
        if (statusList.length > 0) {
          const newSettings: CompanySettings = {
            visitStatuses: statusList.map(s => ({
              key: s.status_id,
              label: s.name,
              color: s.color,
            })),
            jobTitles: DEFAULT_SETTINGS.jobTitles, // Default for now
          };
          setCompanySettings(newSettings);
          console.log('[Context] Set default company settings:', newSettings);

          // Load jobTitles from backend
          if (currentUser?.company_id) {
            console.log('[Context] Loading jobTitles for company:', currentUser.company_id);
            try {
              const { companyService } = await import('@/services/companyService');
              const jobTitlesSetting = await companyService.getSetting(currentUser.company_id, 'jobTitles');
              console.log('[Context] JobTitles setting received:', jobTitlesSetting);
              if (jobTitlesSetting?.value && Array.isArray(jobTitlesSetting.value)) {
                console.log('[Context] Setting jobTitles from backend:', jobTitlesSetting.value);
                setCompanySettings(prev => ({
                  ...prev,
                  jobTitles: jobTitlesSetting.value
                }));
              } else {
                console.log('[Context] JobTitles value not an array or empty');
              }
            } catch (error) {
              // Setting might not exist yet, use defaults
              console.log('[Context] JobTitles not found (error):', error);
            }
          } else {
            console.log('[Context] No company_id, skipping jobTitles load');
          }
        }
      }

    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isImpersonating]);

  // Refresh data when user changes
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser, refreshData]);

  // Auto-refresh for real-time sync (every 30 seconds)
  useEffect(() => {
    if (!currentUser || !localStorage.getItem('token')) {
      return;
    }

    const intervalId = setInterval(() => {
      // Only refresh if page is visible - use silent mode to avoid showing loading indicator
      if (document.visibilityState === 'visible') {
        console.log('[Context] Auto-refresh triggered (silent)');
        refreshData(true); // silent refresh
      }
    }, 60000); // 60 seconds - increased to reduce operational stress

    return () => clearInterval(intervalId);
  }, [currentUser, refreshData]);

  // Staff operations
  const addStaff = useCallback(async (data: Partial<Staff>) => {
    try {
      await userService.create({
        email: `${data.name?.replace(/\s/g, '').toLowerCase()}@company.local`,
        password: 'temppass123',
        role: 'NORMAL_USER',
        name: data.name || '',
        job_title: data.jobTitle,
        display_color: data.color,
        join_date: data.joinedDate,
      });
      await refreshData();
      showToast('スタッフを追加しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

  const updateStaff = useCallback(async (id: string, data: Partial<Staff>) => {
    try {
      await userService.update(id, {
        name: data.name,
        job_title: data.jobTitle,
        display_color: data.color,
        join_date: data.joinedDate,
        left_date: data.leftDate,
        default_holiday_weekdays: data.defaultHolidayWeekDays,
      });

      await refreshData();
      showToast('スタッフを更新しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

  const deleteStaff = useCallback(async (id: string) => {
    try {
      // Permanent delete - removes user and all related data
      await userService.delete(id);
      await refreshData();
      showToast('スタッフを完全に削除しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

  const resignStaff = useCallback(async (id: string) => {
    try {
      // Soft delete for resignation - preserves employment schedules
      await userService.resign(id);
      await refreshData();
      showToast('退職処理が完了しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

  const reorderStaff = useCallback(async (sortOrders: { userId: string; sortOrder: number }[]) => {
    try {
      await userService.updateSortOrders(
        sortOrders.map(so => ({ user_id: so.userId, sort_order: so.sortOrder }))
      );
      await refreshData();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData]);

  // Schedule operations
  const addSchedule = useCallback(async (data: any) => {
    try {
      // Map frontend shift types to backend
      const typeMap: Record<string, string> = {
        'work': 'Workday',
        'holiday': 'ScheduledDayOff',
        'night1': 'NightDuty1',
        'night2': 'NightDuty2',
        'night1_holiday': 'NightDuty1DayOff',
        'night2_holiday': 'NightDuty2DayOff',
      };

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
          // Monthly by weekday fields - send full array for multiple week support
          week_of_month: data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0
            ? data.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: data.recurrenceRule.frequency === 'monthly' &&
            data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0 &&
            data.recurrenceRule.weekDays && data.recurrenceRule.weekDays.length > 0
            ? data.recurrenceRule.weekDays[0] : undefined,
          // Monthly by date field
          day_of_month: data.recurrenceRule.dayOfMonth,
          start_date: data.date,
          end_date: data.recurrenceRule.endDate,
        } : undefined,
      });
      await refreshData();
      showToast('スケジュールを追加しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentUser, refreshData, showToast]);

  const updateSchedule = useCallback(async (id: string, data: any, scope?: string) => {
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
          // Monthly by weekday fields - send full array for multiple week support
          week_of_month: data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0
            ? data.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: data.recurrenceRule.frequency === 'monthly' &&
            data.recurrenceRule.weekNos && data.recurrenceRule.weekNos.length > 0 &&
            data.recurrenceRule.weekDays && data.recurrenceRule.weekDays.length > 0
            ? data.recurrenceRule.weekDays[0] : undefined,
          // Monthly by date field
          day_of_month: data.recurrenceRule.dayOfMonth,
          start_date: data.date,
          end_date: data.recurrenceRule.endDate,
        } : undefined,
        update_scope: scope as any,
      });
      await refreshData();
      showToast('スケジュールを更新しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentUser, refreshData, showToast]);

  const deleteSchedule = useCallback(async (id: string) => {
    try {
      await scheduleService.delete(id);
      await refreshData();
      showToast('スケジュールを削除しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

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
      await refreshData();
    } catch (err: any) {
      // On error, revert by refreshing
      await refreshData();
      setError(err.message);
      throw err;
    }
  }, [shifts, refreshData, currentUser]);

  const applyWeeklyRules = useCallback(async (startDate: string, endDate: string) => {
    try {
      await shiftService.applyWeeklyRules(startDate, endDate);
      await refreshData();
      showToast('週間ルールを適用しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refreshData, showToast]);

  // Status operations (admin only)
  const addStatus = useCallback(async (data: { name: string; color: string }) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.create(data);
      await refreshData();
      showToast('ステータスを追加しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentUser, refreshData, showToast]);

  const updateStatus = useCallback(async (id: string, data: Partial<ScheduleStatus>) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.update(id, data);
      await refreshData();
      showToast('ステータスを更新しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentUser, refreshData, showToast]);

  const deleteStatus = useCallback(async (id: string) => {
    if (currentUser?.role !== 'COMPANY_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Permission denied');
      return;
    }
    try {
      await statusService.delete(id);
      await refreshData();
      showToast('ステータスを削除しました');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [currentUser, refreshData, showToast]);

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
      refreshData,
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
