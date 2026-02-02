"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '@/lib/context';
import {
  authService, userService, scheduleService, shiftService, statusService, patientService,
  User, Schedule, Shift, ScheduleStatus
} from '@/services';
import { createDateTime } from '@/lib/timeUtils';
import { LoginConnected } from './LoginConnected';
import { Dashboard } from './Dashboard';
import { ShiftManager } from './ShiftManager';
import { VisitModal } from './VisitModal';
import { StaffFormModal } from './StaffFormModal';
import { UserManagement } from './UserManagement';
import { Toast } from './Toast';
import { toLocalISOString } from '@/lib/constants';
import {
  Calendar, Notebook, LogOut, Download, Search, Users, Settings, Menu, X, UserCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CompanySettingsView } from './CompanySettings';
import { useModal } from '@/contexts/ModalContext';

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-teal-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
  >
    {icon}
    <span className="block">{label}</span>
  </button>
);

export default function NurseAppConnected() {
  const router = useRouter();
  const { showConfirm } = useModal();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'schedule' | 'shifts' | 'users' | 'settings'>('schedule');

  const [staff, setStaff] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [statuses, setStatuses] = useState<ScheduleStatus[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);

  const [currentDate, setCurrentDate] = useState<string>(() => {
    // Restore date from localStorage, default to today
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('dashboard_currentDate');
      if (savedDate) {
        return savedDate;
      }
    }
    return toLocalISOString(new Date());
  });
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: any }>({ isOpen: false });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Persist current date to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_currentDate', currentDate);
  }, [currentDate]);

  // Debounce timer ref for shift updates
  const shiftUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingShiftUpdatesRef = useRef<Map<string, any>>(new Map());

  const isReadOnly = currentUser?.role === 'NORMAL_USER';
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN';

  useEffect(() => {
    const user = authService.getStoredUser();
    if (user) {
      setCurrentUser(user);
      loadData();
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, schedulesData, shiftsData, statusesData] = await Promise.all([
        userService.getAll(),
        scheduleService.getAll(),
        shiftService.getAll(),
        statusService.getAll(),
      ]);
      setStaff(usersData);
      setSchedules(schedulesData);
      setShifts(shiftsData);
      setStatuses(statusesData);

      // Load job titles from company settings (dynamic from DB)
      if (currentUser?.company_id) {
        try {
          const { companyService } = await import('@/services/companyService');
          const jobTitlesSetting = await companyService.getSetting(currentUser.company_id, 'jobTitles');
          if (jobTitlesSetting?.value && Array.isArray(jobTitlesSetting.value)) {
            setJobTitles(jobTitlesSetting.value);
          } else {
            setJobTitles([]);
          }
        } catch (error) {
          // Setting might not exist yet, use empty array
          console.log('Job titles not found, using empty array');
          setJobTitles([]);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token: string, user: any) => {
    setCurrentUser(user);
    loadData();
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setStaff([]);
    setSchedules([]);
    setShifts([]);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Convert backend data to frontend format - Backend already filters to NORMAL_USER only
  const staffList = useMemo(() => {
    return staff
      .map(s => ({
        id: s.user_id,
        companyId: s.company_id || '',
        name: s.name,
        jobTitle: s.job_title,
        color: s.display_color || 'blue',
        avatar: s.avatar_url || '',
        joinedDate: s.created_at.split('T')[0],
      }));
  }, [staff]);

  const visits = useMemo(() => {
    return schedules.map(sch => {
      const startDateTime = new Date(sch.start_time);
      const endDateTime = new Date(sch.end_time);
      return {
        id: sch.schedule_id,
        companyId: sch.company_id,
        staffIds: sch.assigned_users.map(u => u.user_id),
        patientName: sch.patient_name,
        address: sch.visit_address,
        date: startDateTime.toISOString().split('T')[0],
        startTime: `${startDateTime.getHours().toString().padStart(2, '0')}:${startDateTime.getMinutes().toString().padStart(2, '0')}`,
        endTime: `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`,
        status: sch.status_id,
        recurrence: sch.recurring_series_id ? 'custom' as const : 'none' as const,
        recurrenceRule: sch.recurring_rule ? {
          frequency: sch.recurring_rule.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
          interval: sch.recurring_rule.interval || 1,
          weekDays: sch.recurring_rule.day_of_week || [],
          weekNos: Array.isArray(sch.recurring_rule.week_of_month)
            ? sch.recurring_rule.week_of_month
            : (sch.recurring_rule.week_of_month ? [sch.recurring_rule.week_of_month] : []),
          dayOfMonth: sch.recurring_rule.day_of_month,
          endType: sch.recurring_rule.end_date ? 'date' as const : 'never' as const,
          endDate: sch.recurring_rule.end_date,
        } : undefined,
        notes: sch.memo || '',
        staffMembers: sch.assigned_users.map(u => ({
          id: u.user_id,
          companyId: u.company_id || '',
          name: u.name,
          color: u.display_color || 'blue',
          avatar: u.avatar_url || '',
          joinedDate: u.created_at.split('T')[0],
        })),
      };
    });
  }, [schedules]);

  const shiftAssignments = useMemo(() => {
    return shifts.map(sh => ({
      id: sh.shift_id,
      companyId: sh.company_id,
      staffId: sh.user_id,
      date: sh.shift_date,
      type: sh.shift_type as any,
    }));
  }, [shifts]);

  const companySettings = useMemo(() => ({
    visitStatuses: statuses.map(st => ({
      key: st.status_id,
      label: st.name,
      color: st.color,
    })),
    jobTitles: jobTitles,
  }), [statuses, jobTitles]);

  const handleAddVisit = async (visitData: any) => {
    try {
      await scheduleService.create({
        patient_name: visitData.patientName,
        visit_address: visitData.address,
        start_time: createDateTime(visitData.date, visitData.startTime),
        end_time: createDateTime(visitData.date, visitData.endTime),
        status_id: visitData.status,
        memo: visitData.notes,
        assigned_user_ids: visitData.staffIds,
        recurring_rule: visitData.recurrenceRule ? {
          frequency: visitData.recurrenceRule.frequency,
          interval: visitData.recurrenceRule.interval,
          day_of_week: visitData.recurrenceRule.weekDays,
          week_of_month: visitData.recurrenceRule.weekNos && visitData.recurrenceRule.weekNos.length > 0
            ? visitData.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: visitData.recurrenceRule.frequency === 'monthly' &&
            visitData.recurrenceRule.weekNos && visitData.recurrenceRule.weekNos.length > 0 &&
            visitData.recurrenceRule.weekDays && visitData.recurrenceRule.weekDays.length > 0
            ? visitData.recurrenceRule.weekDays[0] : undefined,
          day_of_month: visitData.recurrenceRule.dayOfMonth,
          start_date: visitData.date,
          end_date: visitData.recurrenceRule.endDate,
        } : undefined,
      });

      await loadData();
      showToast('スケジュールを追加しました');
    } catch (error: any) {
      showToast(error.message || '追加に失敗しました');
    }
  };

  const handleUpdateVisit = async (visitId: string, updates: any) => {
    try {
      const updateData: any = {};
      if (updates.patientName) updateData.patient_name = updates.patientName;
      if (updates.address) updateData.visit_address = updates.address;
      if (updates.status) updateData.status_id = updates.status;
      if (updates.notes !== undefined) updateData.memo = updates.notes;
      if (updates.staffIds) updateData.assigned_user_ids = updates.staffIds;
      if (updates.scope) updateData.update_scope = updates.scope;

      if (updates.date || updates.startTime || updates.endTime) {
        const visit = visits.find(v => v.id === visitId);
        const date = updates.date || visit?.date;
        const startTime = updates.startTime || visit?.startTime;
        const endTime = updates.endTime || visit?.endTime;
        updateData.start_time = createDateTime(date, startTime);
        updateData.end_time = createDateTime(date, endTime);
      }

      // Handle recurring rule
      if (updates.recurrenceRule) {
        updateData.recurring_rule = {
          frequency: updates.recurrenceRule.frequency,
          interval: updates.recurrenceRule.interval,
          day_of_week: updates.recurrenceRule.weekDays,
          week_of_month: updates.recurrenceRule.weekNos && updates.recurrenceRule.weekNos.length > 0
            ? updates.recurrenceRule.weekNos : undefined,
          day_of_week_monthly: updates.recurrenceRule.frequency === 'monthly' &&
            updates.recurrenceRule.weekNos && updates.recurrenceRule.weekNos.length > 0 &&
            updates.recurrenceRule.weekDays && updates.recurrenceRule.weekDays.length > 0
            ? updates.recurrenceRule.weekDays[0] : undefined,
          day_of_month: updates.recurrenceRule.dayOfMonth,
          start_date: updates.date,
          end_date: updates.recurrenceRule.endDate,
        };
      }

      await scheduleService.update(visitId, updateData);
      await loadData();
      showToast('スケジュールを更新しました');
    } catch (error: any) {
      showToast(error.message || '更新に失敗しました');
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    try {
      await scheduleService.delete(visitId);
      await loadData();
      showToast('スケジュールを削除しました');
    } catch (error: any) {
      showToast(error.message || '削除に失敗しました');
    }
  };

  const handleMoveVisit = async (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope?: any) => {
    try {
      const visit = visits.find(v => v.id === visitId);
      if (!visit) return;

      const newStaffIds = visit.staffIds.filter(id => id !== sourceStaffId);
      if (!newStaffIds.includes(targetStaffId)) {
        newStaffIds.push(targetStaffId);
      }

      await scheduleService.update(visitId, {
        assigned_user_ids: newStaffIds,
        start_time: createDateTime(visit.date, newStartTime),
        update_scope: scope || 'this',
      });

      await loadData();
      showToast('スケジュールを移動しました');
    } catch (error: any) {
      showToast(error.message || '移動に失敗しました');
    }
  };

  const handleUpdateShift = useCallback((staffId: string, date: string, type: any) => {
    // Optimistic update: immediately update local state
    setShifts(prevShifts => {
      const existing = prevShifts.find(s => s.user_id === staffId && s.shift_date === date);
      if (existing) {
        return prevShifts.map(s =>
          s.user_id === staffId && s.shift_date === date
            ? { ...s, shift_type: type }
            : s
        );
      } else {
        // Add new shift optimistically
        const newShift: any = {
          shift_id: `temp-${Date.now()}`,
          user_id: staffId,
          shift_date: date,
          shift_type: type,
          company_id: currentUser?.company_id
        };
        return [...prevShifts, newShift];
      }
    });

    // Store pending update for API call
    const key = `${staffId}-${date}`;
    pendingShiftUpdatesRef.current.set(key, { staffId, date, type });

    // Clear existing timer
    if (shiftUpdateTimerRef.current) {
      clearTimeout(shiftUpdateTimerRef.current);
    }

    // Set new timer for batched update (500ms debounce)
    shiftUpdateTimerRef.current = setTimeout(async () => {
      const updates = Array.from(pendingShiftUpdatesRef.current.values());
      pendingShiftUpdatesRef.current.clear();

      try {
        // Process all pending updates - get current shifts from state
        setShifts(currentShifts => {
          // Process updates in background without modifying state here
          (async () => {
            for (const update of updates) {
              const existing = currentShifts.find(s => s.user_id === update.staffId && s.shift_date === update.date);
              if (existing && !existing.shift_id.startsWith('temp-')) {
                await shiftService.update(existing.shift_id, { shift_type: update.type });
              } else {
                await shiftService.create({ user_id: update.staffId, shift_date: update.date, shift_type: update.type });
              }
            }
            // Refresh from server after all updates complete
            await loadData();
          })().catch((error: any) => {
            // On error, revert by reloading
            showToast(error.message || 'シフト更新に失敗しました');
            loadData();
          });
          return currentShifts;
        });
      } catch (error: any) {
        showToast(error.message || 'シフト更新に失敗しました');
        await loadData();
      }
    }, 500);
  }, [loadData, currentUser]);


  const handleAddStaff = async (staffData: any) => {
    try {
      await userService.create({
        email: staffData.email || `${staffData.name}@example.com`,
        password: 'temp123',
        role: 'NORMAL_USER',
        name: staffData.name,
        job_title: staffData.jobTitle,
        display_color: staffData.color,
        join_date: staffData.joinedDate,
        default_holiday_weekdays: staffData.defaultHolidays,
      });

      await loadData();
      showToast('スタッフを追加しました');
    } catch (error: any) {
      showToast(error.message || '追加に失敗しました');
    }
  };

  const handleUpdateStaff = async (staffId: string, updates: any) => {
    try {
      await userService.update(staffId, {
        name: updates.name,
        job_title: updates.jobTitle,
        display_color: updates.color,
        join_date: updates.joinedDate,
        default_holiday_weekdays: updates.defaultHolidays,
      });

      await loadData();
      showToast('スタッフを更新しました');
    } catch (error: any) {
      showToast(error.message || '更新に失敗しました');
    }
  };

  const handleReorderStaff = async (fromIndex: number, toIndex: number) => {
    try {
      const reordered = [...staff];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const sortOrders = reordered.map((s, idx) => ({
        user_id: s.user_id,
        sort_order: idx,
      }));

      await userService.updateSortOrders(sortOrders);
      await loadData();
    } catch (error: any) {
      showToast(error.message || '並び替えに失敗しました');
    }
  };

  const handleExportSchedules = async () => {
    try {
      const blob = await scheduleService.exportCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedules_${currentDate}.csv`;
      a.click();
      showToast('エクスポートしました');
    } catch (error: any) {
      showToast(error.message || 'エクスポートに失敗しました');
    }
  };

  const handleExportShifts = async () => {
    try {
      const blob = await shiftService.exportCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shifts_${currentDate}.csv`;
      a.click();
      showToast('エクスポートしました');
    } catch (error: any) {
      showToast(error.message || 'エクスポートに失敗しました');
    }
  };

  if (!currentUser) {
    return <LoginConnected onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 flex flex-col`}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">C</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">comorebi</h1>
              <p className="text-xs text-slate-400">{currentUser.name}</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {!isReadOnly && (
            <>
              <NavButton active={view === 'schedule'} onClick={() => { setView('schedule'); setIsMobileMenuOpen(false); }} icon={<Calendar className="w-5 h-5" />} label="スケジュール" />
              <NavButton active={view === 'shifts'} onClick={() => { setView('shifts'); setIsMobileMenuOpen(false); }} icon={<Notebook className="w-5 h-5" />} label="シフト管理" />
              {isAdmin && <NavButton active={view === 'users'} onClick={() => { setView('users'); setIsMobileMenuOpen(false); }} icon={<Users className="w-5 h-5" />} label="ユーザー管理" />}
              {isAdmin && <NavButton active={view === 'settings'} onClick={() => { setView('settings'); setIsMobileMenuOpen(false); }} icon={<Settings className="w-5 h-5" />} label="設定" />}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          <button
            onClick={() => router.push('/profile')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
          >
            <UserCircle2 className="w-5 h-5" />
            <span>プロフィール</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 rounded-lg transition-all">
            <LogOut className="w-5 h-5" />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">
            {view === 'schedule' && 'スケジュール管理'}
            {view === 'shifts' && 'シフト管理'}
            {view === 'users' && 'ユーザー管理'}
            {view === 'settings' && '詳細設定'}
          </h2>
          <div className="flex gap-2">
            {view === 'schedule' && <button onClick={handleExportSchedules} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-2"><Download className="w-4 h-4" />CSV</button>}
            {view === 'shifts' && <button onClick={handleExportShifts} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-2"><Download className="w-4 h-4" />CSV</button>}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">読み込み中...</p>
              </div>
            </div>
          ) : (
            <>
              {view === 'schedule' && (
                <Dashboard
                  visits={visits}
                  staffList={staffList}
                  shifts={shiftAssignments}
                  currentDate={currentDate}
                  onSelectVisit={setSelectedVisit}
                  onMoveVisit={handleMoveVisit}
                  onAddVisitSlot={(staffId, startTime) => {
                    setSelectedVisit({
                      staffIds: [staffId],
                      date: currentDate,
                      startTime,
                      endTime: startTime,
                    });
                  }}
                  onPrevDate={() => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() - 1);
                    setCurrentDate(toLocalISOString(d));
                  }}
                  onNextDate={() => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() + 1);
                    setCurrentDate(toLocalISOString(d));
                  }}
                  onToday={() => setCurrentDate(toLocalISOString(new Date()))}
                  onDateSelect={setCurrentDate}
                  onUpdateShift={handleUpdateShift}
                  onReorderStaff={handleReorderStaff}
                  monthlyStats={{}}
                  companySettings={companySettings}
                  isReadOnly={isReadOnly}
                />
              )}

              {view === 'shifts' && (
                <ShiftManager
                  staff={staffList}
                  shifts={shiftAssignments}
                  currentDate={currentDate}
                  companySettings={companySettings}
                  onUpdateShift={handleUpdateShift}
                  onOpenStaffForm={(s) => setStaffFormState({ isOpen: true, initialStaff: s })}
                  onDeleteStaff={async (id) => {
                    const confirmed = await showConfirm('このスタッフを削除しますか？');
                    if (confirmed) {
                      await userService.delete(id);
                      await loadData();
                      showToast('スタッフを削除しました');
                    }
                  }}
                  isReadOnly={isReadOnly}
                />
              )}

              {view === 'users' && isAdmin && (
                <UserManagement
                  companyId={currentUser?.company_id || ''}
                  users={staff.map(s => ({
                    id: s.user_id,
                    username: s.email,
                    name: s.name,
                    role: s.role === 'CompanyAdmin' ? 'admin' : 'user',
                    companyId: s.company_id || '',
                    password: '',
                  })) as any}
                  onAddUser={async (user: any) => {
                    await userService.create({
                      email: user.username,
                      password: user.password,
                      role: user.role === 'admin' ? 'CompanyAdmin' : 'NormalUser',
                      name: user.name,
                    });
                    await loadData();
                    showToast('ユーザーを追加しました');
                  }}
                  onUpdateUser={async (user: any) => {
                    await userService.update(user.id, {
                      name: user.name,
                      role: user.role === 'admin' ? 'CompanyAdmin' : 'NormalUser',
                    });
                    await loadData();
                    showToast('ユーザーを更新しました');
                  }}
                  onDeleteUser={async (id) => {
                    await userService.delete(id);
                    await loadData();
                    showToast('ユーザーを削除しました');
                  }}
                />
              )}

              {view === 'settings' && isAdmin && (
                <CompanySettingsView
                  settings={companySettings}
                  isLoading={loading}
                  onSave={async (updatedSettings) => {
                    try {
                      setLoading(true);
                      const { companyService } = await import('@/services/companyService');

                      // Save visit statuses using status bulk update API
                      const statusItems = updatedSettings.visitStatuses.map((s: any, index: number) => ({
                        status_id: statuses.find(st => st.status_id === s.key)?.status_id,
                        name: s.label,
                        color: s.color,
                        sort_order: index
                      }));

                      await statusService.bulkUpdate({ statuses: statusItems });

                      // Save job titles to company settings
                      await companyService.upsertSetting(
                        currentUser.company_id,
                        'jobTitles',
                        updatedSettings.jobTitles
                      );

                      // Reload data to reflect changes
                      await loadData();
                      showToast('設定を保存しました');
                    } catch (error: any) {
                      showToast(error.message || '設定の保存に失敗しました');
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedVisit && (
        <VisitModal
          visit={{
            id: selectedVisit.id || `new_${Date.now()}`,
            companyId: currentUser?.company_id || '',
            staffIds: selectedVisit.staffIds || [],
            patientName: selectedVisit.patientName || '',
            address: selectedVisit.address,
            date: selectedVisit.date,
            startTime: selectedVisit.startTime,
            endTime: selectedVisit.endTime,
            status: selectedVisit.status || (statuses[0]?.status_id) || '',
            recurrence: selectedVisit.recurrence || 'none',
            recurrenceRule: selectedVisit.recurrenceRule,
            notes: selectedVisit.notes || '',
            staffMembers: selectedVisit.staffMembers,
          }}
          staffList={staffList}
          statuses={statuses}
          companySettings={companySettings}
          onClose={() => setSelectedVisit(null)}
          onUpdate={async (updatedVisit, scope) => {
            if (updatedVisit.id.startsWith('new_')) {
              await handleAddVisit(updatedVisit);
            } else {
              await handleUpdateVisit(updatedVisit.id, { ...updatedVisit, scope });
            }
            setSelectedVisit(null);
          }}
          onDelete={async (visitId, scope) => {
            await handleDeleteVisit(visitId);
            setSelectedVisit(null);
          }}
          isReadOnly={isReadOnly}
        />
      )}

      {staffFormState.isOpen && (
        <StaffFormModal
          isOpen={staffFormState.isOpen}
          initialStaff={staffFormState.initialStaff}
          currentDate={currentDate}
          jobTitles={companySettings.jobTitles}
          onClose={() => setStaffFormState({ isOpen: false })}
          onSave={async (name, jobTitle, defaultHolidays, joinedDate, color) => {
            if (staffFormState.initialStaff) {
              await handleUpdateStaff(staffFormState.initialStaff.id, { 
                name, 
                jobTitle, 
                defaultHolidays, 
                joinedDate,
                color
              });
            } else {
              await handleAddStaff({ 
                name, 
                jobTitle, 
                defaultHolidays, 
                joinedDate,
                color
              });
            }
            setStaffFormState({ isOpen: false });
          }}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
