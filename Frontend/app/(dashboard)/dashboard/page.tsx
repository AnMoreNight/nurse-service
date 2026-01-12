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
import { Toast } from '@/components/Toast';
import { useApp, useRoleAccess } from '@/lib/context';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { toLocalISOString, checkVisitVisibility, formatDateForCSV, getEffectiveShiftType } from '@/lib/constants';
import { VisitWithStaff, Staff, RecurrenceScope, Visit, ShiftType, ScheduleSuggestion, ShiftAssignment } from '@/lib/types';
import { X, Loader2 } from 'lucide-react';
import { scheduleService } from '@/services/scheduleService';
import { shiftService } from '@/services/shiftService';

function DashboardContent() {
  const {
    currentUser,
    staff: staffList,
    visits: companyVisits,
    shifts: companyShifts,
    companySettings,
    isLoading,
    error,
    clearError,
    toastMessage,
    showToast,
    refreshData,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    updateShift,
    reorderStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    addStatus,
    updateStatus,
    deleteStatus,
  } = useApp();

  const { isReadOnly, canManageUsers, canManageSettings } = useRoleAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'schedule';

  const [currentDate, setCurrentDate] = useState<string>(toLocalISOString(new Date()));
  const [selectedVisit, setSelectedVisit] = useState<VisitWithStaff | null>(null);
  const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: Staff }>({ isOpen: false });
  const [suggestionState, setSuggestionState] = useState<{ isOpen: boolean; initialValues?: any }>({ isOpen: false });
  const [localToast, setLocalToast] = useState<string | null>(null);

  const companyId = currentUser?.companyId;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, isLoading, router]);

  // Redirect user role away from admin-only views
  useEffect(() => {
    if (currentUser?.role === 'user' && (view === 'users' || view === 'settings')) {
      router.push('/dashboard?view=schedule');
    }
  }, [view, currentUser, router]);

  // Filter staff by company (for non-system admins)
  const filteredStaff = useMemo(() => {
    if (!companyId) return staffList;
    const filtered = staffList.filter(s => s.companyId === companyId && !s.leftDate);
    console.log('[Dashboard] Staff filtering:', {
      companyId,
      totalStaff: staffList.length,
      filtered: filtered.length,
      staffList: staffList.map(s => ({ id: s.id, name: s.name, companyId: s.companyId, leftDate: s.leftDate }))
    });
    return filtered;
  }, [staffList, companyId]);

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
    const currentD = new Date(currentDate);
    const year = currentD.getFullYear();
    const month = currentD.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(year, month, day);
      const checkDateStr = toLocalISOString(checkDate);
      filteredVisits.forEach(visit => {
        if (checkVisitVisibility(visit, checkDateStr)) {
          visit.staffIds.forEach(staffId => {
            stats[staffId] = (stats[staffId] || 0) + 1;
          });
        }
      });
    }
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
        }, scope);
      }
      setSelectedVisit(null);
    } catch (err) {
      console.error('Failed to update visit:', err);
    }
  };

  const handleDeleteVisit = async (visitId: string, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;

    try {
      await deleteSchedule(visitId);
      setSelectedVisit(null);
    } catch (err) {
      console.error('Failed to delete visit:', err);
    }
  };

  const handleDuplicateVisit = (visit: VisitWithStaff) => {
    if (isReadOnly) return;
    setSelectedVisit({
      id: `dup_${Date.now()}`, companyId: visit.companyId, patientName: visit.patientName, address: visit.address,
      status: visit.status, notes: visit.notes, date: '', startTime: '', endTime: '', staffIds: [], staffMembers: [], recurrence: 'none',
    });
    showToast('複製しました');
  };

  const handleMoveVisit = async (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;

    try {
      const targetVisit = filteredVisits.find(v => v.id === visitId);
      if (!targetVisit) return;

      const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const minutesToTime = (tm: number) => `${String(Math.floor(tm / 60)).padStart(2, '0')}:${String(tm % 60).padStart(2, '0')}`;
      const duration = timeToMinutes(targetVisit.endTime) - timeToMinutes(targetVisit.startTime);
      const newEndTime = minutesToTime(timeToMinutes(newStartTime) + duration);

      const newStaffIds = targetVisit.staffIds.filter(id => id !== sourceStaffId).concat([targetStaffId]).filter((id, i, self) => self.indexOf(id) === i);

      await updateSchedule(visitId, {
        startTime: newStartTime,
        endTime: newEndTime,
        staffIds: newStaffIds,
        date: currentDate,
      }, scope);

      showToast('スケジュールを移動しました');
    } catch (err) {
      console.error('Failed to move visit:', err);
    }
  };

  const handleUpdateShift = async (staffId: string, date: string, type: ShiftType) => {
    if (isReadOnly) return;

    try {
      await updateShift(staffId, date, type);
    } catch (err) {
      console.error('Failed to update shift:', err);
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
    } catch (err) {
      console.error('Failed to reorder staff:', err);
    }
  };

  const handleSaveStaff = async (name: string, jobTitle: string, defaultHolidays: number[], joinedDate: string) => {
    try {
      if (staffFormState.initialStaff) {
        await updateStaff(staffFormState.initialStaff.id, { name, jobTitle, joinedDate });
      } else {
        await addStaff({
          name,
          jobTitle,
          joinedDate,
          companyId: companyId!,
          color: 'blue',
          avatar: name.slice(0, 2),
          defaultHolidayWeekDays: defaultHolidays,
        });
      }
      setStaffFormState({ isOpen: false });
    } catch (err) {
      console.error('Failed to save staff:', err);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (window.confirm('このスタッフを削除（退職処理）しますか？')) {
      try {
        await deleteStaff(staffId);
      } catch (err) {
        console.error('Failed to delete staff:', err);
      }
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
          />
        )}

        {view === 'shifts' && (
          <ShiftManager
            staff={filteredStaff} shifts={filteredShifts} currentDate={currentDate}
            onUpdateShift={handleUpdateShift} onOpenStaffForm={(staff) => setStaffFormState({ isOpen: true, initialStaff: staff })}
            onDeleteStaff={handleDeleteStaff} isReadOnly={isReadOnly} companySettings={companySettings}
          />
        )}

        {/* Users view - ADMIN ONLY */}
        {view === 'users' && canManageUsers && (
          <UserManagementConnected companyId={companyId!} />
        )}

        {/* Settings view - ADMIN ONLY */}
        {view === 'settings' && canManageSettings && (
          <CompanySettingsView
            settings={companySettings}
            onSave={async (newSettings) => {
              // Update statuses via API
              for (const status of newSettings.visitStatuses) {
                // Only process statuses that need to be created/updated
                // Skip default fallback keys (length < 30) and only create/update real ones
                if (status.key.startsWith('CUSTOM_') || status.key.startsWith('new_')) {
                  // Create new status
                  await addStatus({ name: status.label, color: status.color });
                } else if (status.key.length > 30) {
                  // Update existing status (has valid UUID)
                  await updateStatus(status.key, { name: status.label, color: status.color });
                }
                // Skip default string keys like 'REGULAR_NURSE', 'EMERGENCY', etc.
              }
              showToast('設定を保存しました');
              // Refresh data to get actual UUIDs from backend
              await refreshData();
            }}
            onDirtyChange={() => { }}
          />
        )}
      </div>

      {view === 'search' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-md" onClick={() => window.history.back()} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold text-gray-800">スケジュール検索</h2>
              <button onClick={() => window.history.back()} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-88px)]">
              <SearchVisitsModal
                onClose={() => window.history.back()} allVisits={allVisits} staffList={filteredStaff}
                companySettings={companySettings} onSelectVisit={setSelectedVisit}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'export' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-md" onClick={() => window.history.back()} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
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
          visit={selectedVisit} staffList={filteredStaff} companySettings={companySettings}
          onClose={() => setSelectedVisit(null)} onUpdate={handleUpdateVisit} onDelete={handleDeleteVisit}
          onDuplicate={handleDuplicateVisit} onAiQuery={!isReadOnly ? (data) => { setSelectedVisit(null); setSuggestionState({ isOpen: true, initialValues: data }); } : undefined}
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

      {(toastMessage || localToast) && <Toast message={toastMessage || localToast!} onClose={() => setLocalToast(null)} />}
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
