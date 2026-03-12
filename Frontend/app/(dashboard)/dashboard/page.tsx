"use client";

import { Dashboard } from '@/components/Dashboard';
import { ShiftManager } from '@/components/ShiftManager';
import { UserManagementConnected } from '@/components/UserManagementConnected';
import { CompanySettingsView } from '@/components/CompanySettings';
import { VisitModal } from '@/components/VisitModal';
import { StaffFormModal } from '@/components/StaffFormModal';
import { ScheduleSuggestionModal } from '@/components/ScheduleSuggestionModal';
import { SearchVisitsModal } from '@/components/SearchVisitsModal';
import { ExportModal } from '@/components/ExportModal';
import { SpecialInstructionModal } from '@/components/SpecialInstructionModal';
import { BulkRecurringModal } from '@/components/BulkRecurringModal';
import { Toast } from '@/components/Toast';
import { useApp, useRoleAccess } from '@/lib/context';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { toLocalISOString, checkVisitVisibility, formatDateForCSV, getEffectiveShiftType } from '@/lib/constants';
import { VisitWithStaff, Staff, RecurrenceScope, Visit, ShiftType, ScheduleSuggestion, ShiftAssignment } from '@/lib/types';
import { X, Loader2 } from 'lucide-react';
import { scheduleService } from '@/services/scheduleService';
import { shiftService } from '@/services/shiftService';
import { useModal } from '@/contexts/ModalContext';

function DashboardContent() {
  const {
    currentUser,
    staff: staffList,
    visits: companyVisits,
    shifts: companyShifts,
    companySettings,
    statuses,
    isLoading,
    error,
    clearError,
    toastMessage,
    toastType,
    showToast,
    isRefreshing,
    refreshData,
    refreshStaff,
    refreshVisits,
    refreshShifts,
    refreshStatuses,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    updateShift,
    reorderStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    resignStaff,
    addStatus,
    updateStatus,
    deleteStatus,
  } = useApp();

  const { canManageUsers, canManageSettings } = useRoleAccess();
  const { showConfirm } = useModal();
  const isReadOnly = currentUser?.role === 'NORMAL_USER';
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'schedule';

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
  const [selectedVisit, setSelectedVisit] = useState<VisitWithStaff | null>(null);
  const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: Staff }>({ isOpen: false });
  const [suggestionState, setSuggestionState] = useState<{ isOpen: boolean; initialValues?: any }>({ isOpen: false });
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [localToastType, setLocalToastType] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [specialInstructionData, setSpecialInstructionData] = useState<{
    date: string; startTime: string; endTime: string; staffIds: string[];
    patientName: string; visitAddress?: string; statusId: string; memo?: string;
  } | null>(null);
  const [isBulkRecurringOpen, setIsBulkRecurringOpen] = useState(false);
  const settingsDirtyRef = useRef(false);
  const prevViewRef = useRef(view);

  // Persist current date to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard_currentDate', currentDate);
  }, [currentDate]);

  const companyId = currentUser?.company_id;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, isLoading, router]);

  // Redirect user role away from admin-only views
  useEffect(() => {
    if (currentUser?.role === 'NORMAL_USER' && (view === 'users' || view === 'settings')) {
      // Immediately redirect normal users away from admin-only views
      router.replace('/dashboard?view=schedule');
    }
  }, [view, currentUser, router]);

  // Guard: if navigating away from settings with unsaved changes, confirm
  useEffect(() => {
    if (prevViewRef.current === 'settings' && view !== 'settings' && settingsDirtyRef.current) {
      (async () => {
        const leave = await showConfirm('設定が保存されていません。このまま移動しますか？');
        if (!leave) {
          router.replace('/dashboard?view=settings');
          prevViewRef.current = 'settings';
          return;
        }
        settingsDirtyRef.current = false;
      })();
    }
    prevViewRef.current = view;
  }, [view, router, showConfirm]);

  // View-aware auto-refresh: only fetch data the current view needs
  useEffect(() => {
    if (!currentUser || !localStorage.getItem('token')) return;

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;

      if (view === 'schedule') {
        refreshStaff(); refreshVisits(); refreshShifts();
      } else if (view === 'shifts') {
        refreshStaff(); refreshShifts();
      } else if (view === 'users') {
        refreshStaff();
      } else if (view === 'settings') {
        refreshStatuses();
      } else if (view === 'search') {
        refreshStaff(); refreshVisits();
      }
      // export view: no auto-refresh needed
    }, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, [currentUser, view, refreshStaff, refreshVisits, refreshShifts, refreshStatuses]);

  // Filter staff by company (for non-system admins)
  // For NORMAL_USER, put their own column at the far left
  const filteredStaff = useMemo(() => {
    if (!companyId) return staffList;
    let filtered = staffList.filter(s => s.companyId === companyId && !s.leftDate);
    
    // If current user is NORMAL_USER, sort to put them first
    if (currentUser?.role === 'NORMAL_USER' && currentUser?.user_id) {
      filtered = filtered.sort((a, b) => {
        if (a.id === currentUser.user_id) return -1;
        if (b.id === currentUser.user_id) return 1;
        return 0; // Keep original order for others
      });
    }
    
    return filtered;
  }, [staffList, companyId, currentUser]);

  // Filter visits by company
  const filteredVisits = useMemo(() => {
    if (!companyId) return companyVisits;
    return companyVisits.filter(v => v.companyId === companyId);
  }, [companyVisits, companyId]);

  // Filter shifts by company
  const filteredShifts = useMemo(() => {
    if (!companyId) return companyShifts;
    return companyShifts.filter(s => s.companyId === companyId);
  }, [companyShifts, companyId]);

  const allVisits = useMemo(() => {
    return filteredVisits.map(v => ({
      ...v,
      staffMembers: filteredStaff.filter(s => v.staffIds.includes(s.id))
    }));
  }, [filteredVisits, filteredStaff]);

  const currentVisits = useMemo(() => {
    return filteredVisits
      .filter(v => checkVisitVisibility(v, currentDate))
      .map(v => ({
        ...v,
        date: currentDate,
        staffMembers: filteredStaff.filter(s => v.staffIds.includes(s.id))
      }));
  }, [filteredVisits, currentDate, filteredStaff]);

  const monthlyStats = useMemo(() => {
    const stats: Record<string, number> = {};
    if (!currentDate) return stats;
    const [year, month] = currentDate.split('-').map(Number);
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;

    // Single pass: filter visits by month prefix instead of iterating 31 days
    filteredVisits.forEach(visit => {
      if (visit.date.startsWith(monthPrefix)) {
        visit.staffIds.forEach(staffId => {
          stats[staffId] = (stats[staffId] || 0) + 1;
        });
      }
    });
    return stats;
  }, [filteredVisits, currentDate]);

  const handleExport = async (type: 'visits' | 'shifts', start: string, end: string) => {
    try {
      let blob: Blob;
      if (type === 'visits') {
        blob = await scheduleService.exportCSV(start, end);
      } else {
        blob = await shiftService.exportCSV(start, end);
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `export_${type}_${start}_${end}.csv`;
      link.click();
      showToast('エクスポートしました');
    } catch (err: any) {
      console.error('Export failed:', err);
      setLocalToast('エクスポートに失敗しました');
      setLocalToastType('error');
    }
  };

  const handleAddVisitSlot = (staffId: string, startTime: string) => {
    if (isReadOnly) return;

    // Validate status - must be a UUID, not a fallback string
    const firstStatus = companySettings.visitStatuses[0];
    if (!firstStatus || firstStatus.key.length < 30) {
      showToast('設定画面でスケジュールステータスを追加してください');
      return;
    }

    const [h, m] = startTime.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setSelectedVisit({
      id: `new_${Date.now()}`, companyId: companyId!, staffIds: [staffId], patientName: '', date: currentDate,
      startTime, endTime, status: firstStatus.key, recurrence: 'none', notes: '',
      staffMembers: filteredStaff.filter(s => s.id === staffId)
    });
  };

  const handleUpdateVisit = async (updated: VisitWithStaff, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;

    try {
      if (updated.id.startsWith('new_') || updated.id.startsWith('ai_') || updated.id.startsWith('dup_')) {
        // Create new schedule
        await addSchedule({
          patientName: updated.patientName,
          address: updated.address,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          status: updated.status,
          notes: updated.notes,
          staffIds: updated.staffIds,
          recurrenceRule: updated.recurrenceRule,
        });
      } else {
        // Update existing schedule
        await updateSchedule(updated.id, {
          patientName: updated.patientName,
          address: updated.address,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          status: updated.status,
          notes: updated.notes,
          staffIds: updated.staffIds,
          recurrenceRule: updated.recurrenceRule,
        }, scope);
      }
      setSelectedVisit(null);
    } catch (err: any) {
      showToast(`更新に失敗しました: ${err.message || '不明なエラー'}`, 'error');
    }
  };

  const handleDeleteVisit = async (visitId: string, scope: RecurrenceScope = 'this', occurrenceDate?: string) => {
    if (isReadOnly) return;

    try {
      // Use the occurrence date passed from VisitModal (which has the correct displayed date),
      // NOT the base schedule date from filteredVisits
      const effectiveDate = occurrenceDate || filteredVisits.find(v => v.id === visitId)?.date;
      await deleteSchedule(visitId, scope, effectiveDate);
      setSelectedVisit(null);
    } catch (err: any) {
      showToast(`削除に失敗しました: ${err.message || '不明なエラー'}`, 'error');
    }
  };

  const handleDuplicateVisit = (visit: VisitWithStaff) => {
    if (isReadOnly) return;
    setSelectedVisit({
      id: `dup_${Date.now()}`,
      companyId: visit.companyId,
      patientName: visit.patientName,
      address: visit.address,
      status: visit.status,
      notes: visit.notes,
      date: currentDate, // Use current date instead of empty
      startTime: visit.startTime, // Copy time
      endTime: visit.endTime, // Copy time
      staffIds: [],
      staffMembers: [],
      recurrence: visit.recurrence, // Copy recurrence setting
      recurrenceRule: visit.recurrenceRule, // Copy recurrence rule
    });
    showToast('複製しました');
  };

  const handleSpecialInstruction = (data: {
    date: string; startTime: string; endTime: string; staffIds: string[];
    patientName: string; visitAddress?: string; statusId: string; memo?: string;
  }) => {
    setSpecialInstructionData(data);
  };

  const handleSubmitSpecialInstruction = async (data: {
    start_date: string; start_time: string; end_time: string; assigned_user_ids: string[];
    patient_name: string; visit_address?: string; status_id: string; memo?: string;
  }) => {
    try {
      const result = await scheduleService.bulkSpecialInstruction({
        company_id: currentUser?.company_id || undefined,
        ...data,
      });
      setSpecialInstructionData(null);
      showToast(`${result.created_count}件の訪問予定を一括登録しました`);
      await refreshVisits();
    } catch (err: any) {
      showToast(`一括登録に失敗しました: ${err.message || '不明なエラー'}`, 'error');
      throw err;
    }
  };

  const handleSubmitBulkRecurring = async (data: {
    patient_name: string; visit_address?: string; start_date: string;
    start_time: string; end_time: string; day_of_week: number[];
    status_id: string; memo?: string; assigned_user_ids: string[];
  }) => {
    try {
      await scheduleService.bulkRecurring({
        company_id: currentUser?.company_id || undefined,
        ...data,
      });
      setIsBulkRecurringOpen(false);
      showToast('定期訪問を登録しました');
      await refreshVisits();
    } catch (err: any) {
      showToast(`登録に失敗しました: ${err.message || '不明なエラー'}`, 'error');
      throw err;
    }
  };

  const handleMoveVisit = async (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;

    try {
      // Look for visit in all available sources
      const targetVisit = filteredVisits.find(v => v.id === visitId) 
        || companyVisits.find(v => v.id === visitId);
      
      if (!targetVisit) {
        console.error('Visit not found:', visitId);
        return;
      }

      const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const minutesToTime = (tm: number) => { const wrapped = ((tm % 1440) + 1440) % 1440; return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`; };
      let duration = timeToMinutes(targetVisit.endTime) - timeToMinutes(targetVisit.startTime);
      if (duration < 0) duration += 1440; // Handle midnight crossing
      const newEndTime = minutesToTime(timeToMinutes(newStartTime) + duration);

      // Build new staff list: remove from source, add to target (no duplicates)
      const newStaffIds = targetVisit.staffIds
        .filter(id => id !== sourceStaffId)
        .concat([targetStaffId])
        .filter((id, i, self) => self.indexOf(id) === i);

      await updateSchedule(visitId, {
        startTime: newStartTime,
        endTime: newEndTime,
        staffIds: newStaffIds,
        date: currentDate,
      }, scope);
    } catch (err: any) {
      showToast(`移動に失敗しました: ${err.message || '不明なエラー'}`, 'error');
    }
  };

  const handleUpdateShift = async (staffId: string, date: string, type: ShiftType) => {
    if (isReadOnly) return;

    try {
      await updateShift(staffId, date, type);
    } catch (err: any) {
      showToast(`シフト更新に失敗しました`, 'error');
    }
  };

  const handleReorderStaff = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || isReadOnly) return;

    try {
      const newStaffList = [...filteredStaff];
      const [movedStaff] = newStaffList.splice(fromIndex, 1);
      newStaffList.splice(toIndex, 0, movedStaff);

      const sortOrders = newStaffList.map((s, idx) => ({ userId: s.id, sortOrder: idx }));
      await reorderStaff(sortOrders);
    } catch (err: any) {
      showToast(`並び替えに失敗しました`, 'error');
    }
  };

  const handleSaveStaff = async (name: string, jobTitle: string, defaultHolidays: number[], color: string) => {
    try {
      if (staffFormState.initialStaff) {
        await updateStaff(staffFormState.initialStaff.id, { name, jobTitle, defaultHolidayWeekDays: defaultHolidays, color });
      } else {
        await addStaff({
          name,
          jobTitle,
          companyId: companyId!,
          color: color || 'blue',
          avatar: name.slice(0, 2),
          defaultHolidayWeekDays: defaultHolidays,
        });
      }
      setStaffFormState({ isOpen: false });
    } catch (err: any) {
      showToast(`スタッフの保存に失敗しました: ${err.message || '不明なエラー'}`, 'error');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    try {
      await deleteStaff(staffId);
    } catch (err: any) {
      showToast(`スタッフの削除に失敗しました`, 'error');
    }
  };

  const handleResignStaff = async (staffId: string) => {
    try {
      await resignStaff(staffId);
    } catch (err: any) {
      showToast(`退職処理に失敗しました`, 'error');
    }
  };

  const handleApplySuggestion = (suggestion: ScheduleSuggestion, pName: string, addr: string) => {
    const firstStatus = companySettings.visitStatuses[0];
    if (!firstStatus || firstStatus.key.length < 30) {
      showToast('設定画面でスケジュールステータスを追加してください');
      return;
    }

    setSelectedVisit({
      id: `ai_${Date.now()}`, companyId: companyId!, staffIds: [suggestion.staffId], patientName: pName, address: addr,
      date: suggestion.date, startTime: suggestion.startTime, endTime: suggestion.endTime, status: firstStatus.key,
      recurrence: 'none', notes: 'AI提案により作成', staffMembers: filteredStaff.filter(s => s.id === suggestion.staffId)
    });
    setSuggestionState({ isOpen: false });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center bg-red-50 p-8 rounded-2xl max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => { clearError(); refreshData(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sync indicator - indeterminate progress bar */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-teal-100 overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full" style={{
            width: '30%',
            animation: 'slideIndeterminate 1.2s ease-in-out infinite',
          }} />
          <style>{`@keyframes slideIndeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(433%); } }`}</style>
        </div>
      )}
      <div className="flex-1 overflow-hidden p-2 md:p-4">
        {view === 'schedule' && (
          <Dashboard
            visits={currentVisits} staffList={filteredStaff} shifts={filteredShifts} currentDate={currentDate}
            onSelectVisit={setSelectedVisit} onMoveVisit={handleMoveVisit} onAddVisitSlot={handleAddVisitSlot}
            onPrevDate={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(toLocalISOString(d)); }}
            onNextDate={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(toLocalISOString(d)); }}
            onToday={() => setCurrentDate(toLocalISOString(new Date()))} onDateSelect={setCurrentDate}
            onUpdateShift={handleUpdateShift} onReorderStaff={handleReorderStaff} monthlyStats={monthlyStats}
            companySettings={companySettings} isReadOnly={isReadOnly}
            onBulkRecurring={!isReadOnly ? () => setIsBulkRecurringOpen(true) : undefined}
          />
        )}

        {view === 'shifts' && (
          <ShiftManager
            staff={filteredStaff} shifts={filteredShifts} currentDate={currentDate}
            onUpdateShift={handleUpdateShift} onOpenStaffForm={(staff) => setStaffFormState({ isOpen: true, initialStaff: staff })}
            onDeleteStaff={handleDeleteStaff} onResignStaff={handleResignStaff} 
            isReadOnly={isReadOnly} companySettings={companySettings}
          />
        )}

        {/* Users view - ADMIN ONLY */}
        {view === 'users' && (
          <>
            {!canManageUsers ? null : (
              <UserManagementConnected companyId={companyId!} />
            )}
          </>
        )}

        {/* Settings view - ADMIN ONLY */}
        {view === 'settings' && (
          <>
            {!canManageSettings ? null : (
              <CompanySettingsView
                settings={companySettings}
                isLoading={isSaving}
                onSave={async (newSettings) => {
                  setIsSaving(true);
                  try {
                    const { statusService } = await import('@/services/statusService');
                    const { companyService } = await import('@/services/companyService');

                    const statusItems = newSettings.visitStatuses.map((status, index) => {
                      const isUUID = status.key.length > 30 && status.key.includes('-');
                      return {
                        status_id: isUUID ? status.key : undefined,
                        name: status.label,
                        color: status.color,
                        sort_order: index,
                      };
                    });

                    await statusService.bulkUpdate({ statuses: statusItems });

                    if (currentUser?.company_id) {
                      await companyService.upsertSetting(currentUser.company_id, 'jobTitles', newSettings.jobTitles);
                    }

                    showToast('設定を保存しました');
                    await refreshStatuses();
                  } catch (error: any) {
                    showToast(`保存に失敗しました: ${error.message || '不明なエラー'}`, 'error');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                onDirtyChange={(dirty) => { settingsDirtyRef.current = dirty; }}
              />
            )}
          </>
        )}
      </div>

      {view === 'search' && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-md" onClick={() => window.history.back()} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-linear-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold text-gray-800">スケジュール検索</h2>
              <button onClick={() => window.history.back()} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-88px)]">
              <SearchVisitsModal
                onClose={() => window.history.back()} allVisits={allVisits} staffList={filteredStaff}
                companySettings={companySettings} onSelectVisit={(visit) => { setCurrentDate(visit.date); setSelectedVisit(visit); }}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'export' && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-md" onClick={() => window.history.back()} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-linear-to-r from-green-50 to-emerald-50">
              <h2 className="text-2xl font-bold text-gray-800">データ出力</h2>
              <button onClick={() => window.history.back()} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <div className="p-6">
              <ExportModal onClose={() => window.history.back()} onExport={handleExport} />
            </div>
          </div>
        </div>
      )}

      {selectedVisit && (
        <VisitModal
          visit={selectedVisit} staffList={filteredStaff} statuses={statuses} companySettings={companySettings}
          onClose={() => setSelectedVisit(null)} onUpdate={handleUpdateVisit} onDelete={handleDeleteVisit}
          onDuplicate={handleDuplicateVisit} onAiQuery={!isReadOnly ? (data) => { setSelectedVisit(null); setSuggestionState({ isOpen: true, initialValues: data }); } : undefined}
          onSpecialInstruction={!isReadOnly ? handleSpecialInstruction : undefined}
          isReadOnly={isReadOnly}
        />
      )}

      {staffFormState.isOpen && (
        <StaffFormModal
          isOpen={true} onClose={() => setStaffFormState({ isOpen: false })} onSave={handleSaveStaff}
          initialStaff={staffFormState.initialStaff} currentDate={currentDate} jobTitles={companySettings.jobTitles}
        />
      )}

      {suggestionState.isOpen && (
        <ScheduleSuggestionModal
          onClose={() => setSuggestionState({ isOpen: false })} staffList={filteredStaff}
          allVisits={allVisits} onApply={handleApplySuggestion} initialValues={suggestionState.initialValues}
        />
      )}

      {specialInstructionData && (
        <SpecialInstructionModal
          defaultDate={specialInstructionData.date}
          defaultStartTime={specialInstructionData.startTime}
          defaultEndTime={specialInstructionData.endTime}
          defaultStaffIds={specialInstructionData.staffIds}
          patientName={specialInstructionData.patientName}
          visitAddress={specialInstructionData.visitAddress}
          statusId={specialInstructionData.statusId}
          memo={specialInstructionData.memo}
          staffList={filteredStaff}
          onSubmit={handleSubmitSpecialInstruction}
          onClose={() => setSpecialInstructionData(null)}
        />
      )}

      {isBulkRecurringOpen && (
        <BulkRecurringModal
          currentDate={currentDate}
          staffList={filteredStaff}
          statuses={statuses}
          companySettings={companySettings}
          onSubmit={handleSubmitBulkRecurring}
          onClose={() => setIsBulkRecurringOpen(false)}
        />
      )}

      {(toastMessage || localToast) && <Toast message={toastMessage || localToast!} onClose={() => setLocalToast(null)} type={toastMessage ? toastType : localToastType} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
