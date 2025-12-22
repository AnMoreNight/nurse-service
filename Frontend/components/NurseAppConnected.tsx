"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  authService, userService, scheduleService, shiftService, statusService, patientService,
  User, Schedule, Shift, ScheduleStatus
} from '@/services';
import { LoginConnected } from './LoginConnected';
import { Dashboard } from './Dashboard';
import { ShiftManager } from './ShiftManager';
import { VisitModal } from './VisitModal';
import { StaffFormModal } from './StaffFormModal';
import { UserManagement } from './UserManagement';
import { Toast } from './Toast';
import { toLocalISOString } from '@/lib/constants';
import { 
  Calendar, Notebook, LogOut, Download, Search, Users, Settings, Menu, X 
} from 'lucide-react';

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
      active ? 'bg-teal-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="block">{label}</span>
  </button>
);

export default function NurseAppConnected() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'schedule' | 'shifts' | 'users' | 'settings'>('schedule');
  
  const [staff, setStaff] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [statuses, setStatuses] = useState<ScheduleStatus[]>([]);
  
  const [currentDate, setCurrentDate] = useState<string>(toLocalISOString(new Date()));
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: any }>({ isOpen: false });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isReadOnly = currentUser?.role === 'NormalUser';
  const isAdmin = currentUser?.role === 'CompanyAdmin';

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

  // Convert backend data to frontend format
  const staffList = useMemo(() => {
    return staff.map(s => ({
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
        recurrence: 'none' as const,
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
    jobTitles: [],
  }), [statuses]);

  const handleAddVisit = async (visitData: any) => {
    try {
      const startDateTime = `${visitData.date}T${visitData.startTime}:00`;
      const endDateTime = `${visitData.date}T${visitData.endTime}:00`;
      
      await scheduleService.create({
        patient_name: visitData.patientName,
        visit_address: visitData.address,
        start_time: startDateTime,
        end_time: endDateTime,
        status_id: visitData.status,
        memo: visitData.notes,
        assigned_user_ids: visitData.staffIds,
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
      
      if (updates.date || updates.startTime || updates.endTime) {
        const visit = visits.find(v => v.id === visitId);
        const date = updates.date || visit?.date;
        const startTime = updates.startTime || visit?.startTime;
        const endTime = updates.endTime || visit?.endTime;
        updateData.start_time = `${date}T${startTime}:00`;
        updateData.end_time = `${date}T${endTime}:00`;
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
        start_time: `${visit.date}T${newStartTime}:00`,
        update_scope: scope || 'this',
      });
      
      await loadData();
      showToast('スケジュールを移動しました');
    } catch (error: any) {
      showToast(error.message || '移動に失敗しました');
    }
  };

  const handleUpdateShift = async (staffId: string, date: string, type: any) => {
    try {
      const existing = shifts.find(s => s.user_id === staffId && s.shift_date === date);
      
      if (existing) {
        await shiftService.update(existing.shift_id, { shift_type: type });
      } else {
        await shiftService.create({ user_id: staffId, shift_date: date, shift_type: type });
      }
      
      await loadData();
      showToast('シフトを更新しました');
    } catch (error: any) {
      showToast(error.message || 'シフト更新に失敗しました');
    }
  };

  const handleAddStaff = async (staffData: any) => {
    try {
      await userService.create({
        email: staffData.email || `${staffData.name}@example.com`,
        password: 'temp123',
        role: 'NormalUser',
        name: staffData.name,
        profession: staffData.jobTitle,
        display_color: staffData.color,
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
        profession: updates.jobTitle,
        display_color: updates.color,
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
              <span className="text-xl font-bold">N</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">NurseAssist</h1>
              <p className="text-xs text-slate-400">{currentUser.name}</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton active={view === 'schedule'} onClick={() => { setView('schedule'); setIsMobileMenuOpen(false); }} icon={<Calendar className="w-5 h-5" />} label="スケジュール" />
          <NavButton active={view === 'shifts'} onClick={() => { setView('shifts'); setIsMobileMenuOpen(false); }} icon={<Notebook className="w-5 h-5" />} label="シフト管理" />
          {isAdmin && <NavButton active={view === 'users'} onClick={() => { setView('users'); setIsMobileMenuOpen(false); }} icon={<Users className="w-5 h-5" />} label="ユーザー管理" />}
        </nav>

        <div className="p-4 border-t border-slate-700">
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
                  staffList={staffList}
                  shifts={shiftAssignments}
                  currentMonth={currentDate.substring(0, 7)}
                  onUpdateShift={handleUpdateShift}
                  onPrevMonth={() => {
                    const [y, m] = currentDate.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setCurrentDate(toLocalISOString(d));
                  }}
                  onNextMonth={() => {
                    const [y, m] = currentDate.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setCurrentDate(toLocalISOString(d));
                  }}
                  isReadOnly={isReadOnly}
                />
              )}

              {view === 'users' && isAdmin && (
                <UserManagement
                  users={staff}
                  onAddUser={handleAddStaff}
                  onUpdateUser={handleUpdateStaff}
                  onDeleteUser={(id) => userService.delete(id).then(loadData)}
                  onInviteUser={(email, role) => userService.invite({ email, role }).then(() => showToast('招待を送信しました'))}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedVisit && (
        <VisitModal
          visit={selectedVisit}
          staffList={staffList}
          companySettings={companySettings}
          onClose={() => setSelectedVisit(null)}
          onSave={(data) => {
            if (selectedVisit.id) {
              handleUpdateVisit(selectedVisit.id, data);
            } else {
              handleAddVisit(data);
            }
            setSelectedVisit(null);
          }}
          onDelete={selectedVisit.id ? () => {
            handleDeleteVisit(selectedVisit.id);
            setSelectedVisit(null);
          } : undefined}
          isReadOnly={isReadOnly}
        />
      )}

      {staffFormState.isOpen && (
        <StaffFormModal
          initialStaff={staffFormState.initialStaff}
          onClose={() => setStaffFormState({ isOpen: false })}
          onSave={(data) => {
            if (staffFormState.initialStaff) {
              handleUpdateStaff(staffFormState.initialStaff.id, data);
            } else {
              handleAddStaff(data);
            }
            setStaffFormState({ isOpen: false });
          }}
          companySettings={companySettings}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
