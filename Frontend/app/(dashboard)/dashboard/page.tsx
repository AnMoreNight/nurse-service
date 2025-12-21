"use client";

import { Dashboard } from '@/Frontend/components/Dashboard';
import { ShiftManager } from '@/Frontend/components/ShiftManager';
import { UserManagement } from '@/Frontend/components/UserManagement';
import { CompanySettingsView } from '@/Frontend/components/CompanySettings';
import { VisitModal } from '@/Frontend/components/VisitModal';
import { StaffFormModal } from '@/Frontend/components/StaffFormModal';
import { ScheduleSuggestionModal } from '@/Frontend/components/ScheduleSuggestionModal';
import { SearchVisitsModal } from '@/Frontend/components/SearchVisitsModal';
import { ExportModal } from '@/Frontend/components/ExportModal';
import { Toast } from '@/Frontend/components/Toast';
import { useApp } from '@/lib/context';
import { useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';
import { toLocalISOString, checkVisitVisibility, formatDateForCSV, getEffectiveShiftType } from '@/lib/constants';
import { VisitWithStaff, Staff, RecurrenceScope, Visit, ShiftType, ScheduleSuggestion, ShiftAssignment } from '@/lib/types';
import { X } from 'lucide-react';

export default function Page() {
  const { currentUser, masterStaff, masterVisits, masterShifts, masterCompanies, dbUsers, setMasterVisits, setMasterStaff, setMasterShifts, setDbUsers, setMasterCompanies } = useApp();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'schedule';
  
  const [currentDate, setCurrentDate] = useState<string>(toLocalISOString(new Date()));
  const [selectedVisit, setSelectedVisit] = useState<VisitWithStaff | null>(null);
  const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: Staff }>({ isOpen: false });
  const [suggestionState, setSuggestionState] = useState<{ isOpen: boolean; initialValues?: any }>({ isOpen: false });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const companyId = currentUser?.companyId;
  const isReadOnly = currentUser?.role === 'user';
  
  const staffList = useMemo(() => {
    if (!companyId) return [];
    return masterStaff.filter(s => s.companyId === companyId && !s.leftDate);
  }, [masterStaff, companyId]);

  const companyVisits = useMemo(() => {
    if (!companyId) return [];
    return masterVisits.filter(v => v.companyId === companyId);
  }, [masterVisits, companyId]);

  const companyShifts = useMemo(() => {
    if (!companyId) return [];
    return masterShifts.filter(s => s.companyId === companyId);
  }, [masterShifts, companyId]);

  const currentCompany = useMemo(() => {
    return masterCompanies.find(c => c.id === companyId);
  }, [masterCompanies, companyId]);

  const companySettings = currentCompany?.settings || masterCompanies[0].settings;

  const allVisits = useMemo(() => {
    return companyVisits.map(v => ({
      ...v,
      staffMembers: staffList.filter(s => v.staffIds.includes(s.id))
    }));
  }, [companyVisits, staffList]);

  const currentVisits = useMemo(() => {
    return companyVisits
      .filter(v => checkVisitVisibility(v, currentDate))
      .map(v => ({
        ...v,
        date: currentDate,
        staffMembers: staffList.filter(s => v.staffIds.includes(s.id))
      }));
  }, [companyVisits, currentDate, staffList]);

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
      companyVisits.forEach(visit => {
        if (checkVisitVisibility(visit, checkDateStr)) {
          visit.staffIds.forEach(staffId => {
            stats[staffId] = (stats[staffId] || 0) + 1;
          });
        }
      });
    }
    return stats;
  }, [companyVisits, currentDate]);

  const handleExport = (type: 'visits' | 'shifts', start: string, end: string) => {
    const BOM = '\uFEFF';
    let csvContent = '';
    
    if (type === 'visits') {
      csvContent = "日付,開始時間,終了時間,患者名,担当者,ステータス,メモ\n";
      const targetVisits = companyVisits.filter(v => v.date >= start && v.date <= end).sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.localeCompare(b.startTime);
      });
      targetVisits.forEach(v => {
        const staffNames = staffList.filter(s => v.staffIds.includes(s.id)).map(s => s.name).join('/');
        const dateStr = formatDateForCSV(v.date);
        const statusLabel = companySettings.visitStatuses.find(s => s.key === v.status)?.label || v.status;
        const notes = (v.notes || '').replace(/\n/g, ' ');
        csvContent += `${dateStr},${v.startTime},${v.endTime},${v.patientName},${staffNames},${statusLabel},${notes}\n`;
      });
    } else {
      csvContent = "日付,スタッフ,シフトタイプ\n";
      const [sy, sm, sd] = start.split('-').map(Number);
      const [ey, em, ed] = end.split('-').map(Number);
      const curr = new Date(sy, sm - 1, sd);
      const last = new Date(ey, em - 1, ed);
      while (curr <= last) {
        const dateStr = toLocalISOString(curr);
        const dateFormatted = formatDateForCSV(dateStr);
        staffList.forEach(staff => {
          const effectiveType = getEffectiveShiftType(staff, dateStr, companyShifts);
          let typeLabel = '';
          switch(effectiveType) {
            case 'night1': typeLabel = '夜間待機1'; break;
            case 'night2': typeLabel = '夜間待機2'; break;
            case 'night1_holiday': typeLabel = '夜間待機1(休)'; break;
            case 'night2_holiday': typeLabel = '夜間待機2(休)'; break;
            case 'holiday': typeLabel = '公休'; break;
            case 'work': typeLabel = '出勤'; break;
            case 'none': typeLabel = '出勤'; break;
            default: typeLabel = effectiveType || '';
          }
          csvContent += `${dateFormatted},${staff.name},${typeLabel}\n`;
        });
        curr.setDate(curr.getDate() + 1);
      }
    }
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `export_${type}_${start}_${end}.csv`;
    link.click();
  };

  const handleAddVisitSlot = (staffId: string, startTime: string) => {
    if (isReadOnly) return;
    const [h, m] = startTime.split(':').map(Number);
    const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setSelectedVisit({
      id: `new_${Date.now()}`, companyId: companyId!, staffIds: [staffId], patientName: '', date: currentDate,
      startTime, endTime, status: 'REGULAR_NURSE', recurrence: 'none', notes: '',
      staffMembers: staffList.filter(s => s.id === staffId)
    });
  };

  const handleUpdateVisit = (updated: VisitWithStaff, scope: RecurrenceScope = 'this') => {
    setMasterVisits(prev => {
      if (updated.id.startsWith('new_') || updated.id.startsWith('ai_') || updated.id.startsWith('dup_')) {
        const { staffMembers, ...visitData } = updated;
        return [...prev, { ...visitData, id: `v_${Date.now()}` }];
      }
      const original = prev.find(v => v.id === updated.id);
      if (!original) return prev;
      if (updated.recurrence === 'custom' && scope !== 'all') {
        if (scope === 'this') {
          const updatedOriginal = { ...original, excludeDates: [...(original.excludeDates || []), updated.date] };
          const { staffMembers, ...visitData } = updated;
          const exceptionVisit = { ...visitData, id: `exc_${Date.now()}`, recurrence: 'none' as const, recurrenceRule: undefined };
          return prev.map(v => v.id === updated.id ? updatedOriginal : v).concat(exceptionVisit);
        } else if (scope === 'following') {
          const endDate = new Date(updated.date);
          endDate.setDate(endDate.getDate() - 1);
          const updatedOriginal = { ...original, recurrenceEndDate: toLocalISOString(endDate) };
          const { staffMembers, ...visitData } = updated;
          const newSeries = { ...visitData, id: `ser_${Date.now()}` };
          return prev.map(v => v.id === updated.id ? updatedOriginal : v).concat(newSeries);
        }
      }
      return prev.map(v => v.id === updated.id ? { ...updated, staffMembers: undefined } : v);
    });
    setToastMessage('保存しました');
  };

  const handleDeleteVisit = (visitId: string, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;
    setMasterVisits(prev => {
      const target = prev.find(v => v.id === visitId);
      if (!target) return prev;
      if (target.recurrence === 'custom' && scope !== 'all') {
        if (scope === 'this') return prev.map(v => v.id === visitId ? { ...v, excludeDates: [...(v.excludeDates || []), currentDate] } : v);
        else if (scope === 'following') {
          const endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() - 1);
          return prev.map(v => v.id === visitId ? { ...v, recurrenceEndDate: toLocalISOString(endDate) } : v);
        }
      }
      return prev.filter(v => v.id !== visitId);
    });
    setToastMessage('スケジュールを削除しました');
  };

  const handleDuplicateVisit = (visit: VisitWithStaff) => {
    if (isReadOnly) return;
    setSelectedVisit({
      id: `dup_${Date.now()}`, companyId: visit.companyId, patientName: visit.patientName, address: visit.address,
      status: visit.status, notes: visit.notes, date: '', startTime: '', endTime: '', staffIds: [], staffMembers: [], recurrence: 'none',
    });
    setToastMessage('複製しました');
  };

  const handleMoveVisit = (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope: RecurrenceScope = 'this') => {
    if (isReadOnly) return;
    setMasterVisits(prev => {
      const targetVisit = prev.find(v => v.id === visitId);
      if (!targetVisit) return prev;
      const timeToMinutes = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const minutesToTime = (tm: number) => `${String(Math.floor(tm/60)).padStart(2,'0')}:${String(tm%60).padStart(2,'0')}`;
      const duration = timeToMinutes(targetVisit.endTime) - timeToMinutes(targetVisit.startTime);
      const newEndTime = minutesToTime(timeToMinutes(newStartTime) + duration);
      const updatedFields = {
        staffIds: targetVisit.staffIds.filter(id => id !== sourceStaffId).concat([targetStaffId]).filter((id, i, self) => self.indexOf(id) === i),
        startTime: newStartTime, endTime: newEndTime
      };
      if (targetVisit.recurrence === 'custom' && scope !== 'all') {
        if (scope === 'this') {
          const updatedOriginal = { ...targetVisit, excludeDates: [...(targetVisit.excludeDates || []), currentDate] };
          const exception: Visit = { ...targetVisit, id: `exc_${Date.now()}`, date: currentDate, recurrence: 'none', recurrenceRule: undefined, ...updatedFields };
          return prev.map(v => v.id === visitId ? updatedOriginal : v).concat(exception);
        } else if (scope === 'following') {
          const endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() - 1);
          const updatedOriginal = { ...targetVisit, recurrenceEndDate: toLocalISOString(endDate) };
          const newSeries: Visit = { ...targetVisit, id: `ser_${Date.now()}`, date: currentDate, ...updatedFields };
          return prev.map(v => v.id === visitId ? updatedOriginal : v).concat(newSeries);
        }
      }
      return prev.map(v => v.id === visitId ? { ...v, ...updatedFields } : v);
    });
    setToastMessage('スケジュールを移動しました');
  };

  const handleUpdateShift = (staffId: string, date: string, type: ShiftType) => {
    if (isReadOnly) return;
    setMasterShifts(prev => {
      const night1Types = ['night1', 'night1_holiday'];
      const night2Types = ['night2', 'night2_holiday'];
      let conflictingTypes: string[] = [];
      if (night1Types.includes(type || '')) conflictingTypes = night1Types;
      else if (night2Types.includes(type || '')) conflictingTypes = night2Types;
      const filtered = prev.filter(s => {
        if (s.staffId === staffId && s.date === date) return false;
        if (conflictingTypes.length > 0 && s.date === date && s.type && conflictingTypes.includes(s.type)) return false;
        return true;
      });
      return [...filtered, { id: `sh_${Date.now()}`, companyId: companyId!, staffId, date, type }];
    });
  };

  const handleReorderStaff = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newStaffList = [...staffList];
    const [movedStaff] = newStaffList.splice(fromIndex, 1);
    newStaffList.splice(toIndex, 0, movedStaff);
    setMasterStaff(prev => {
      const otherStaff = prev.filter(s => s.companyId !== companyId);
      return [...otherStaff, ...newStaffList];
    });
  };

  const handleSaveStaff = (name: string, jobTitle: string, defaultHolidays: number[], joinedDate: string) => {
    if (staffFormState.initialStaff) {
      setMasterStaff(prev => prev.map(s => s.id === staffFormState.initialStaff!.id ? { ...s, name, jobTitle, defaultHolidayWeekDays: defaultHolidays, joinedDate } : s));
    } else {
      setMasterStaff(prev => [...prev, {
        id: `s_${Date.now()}`, companyId: companyId!, name, jobTitle, color: 'blue',
        avatar: name.slice(0, 2), joinedDate, defaultHolidayWeekDays: defaultHolidays
      }]);
    }
    setStaffFormState({ isOpen: false });
    setToastMessage('スタッフを保存しました');
  };

  const handleDeleteStaff = (staffId: string) => {
    if (window.confirm('このスタッフを削除（退職処理）しますか？')) {
      setMasterStaff(prev => prev.map(s => s.id === staffId ? { ...s, leftDate: toLocalISOString(new Date()) } : s));
      setToastMessage('スタッフを削除しました');
    }
  };

  const handleApplySuggestion = (suggestion: ScheduleSuggestion, pName: string, addr: string) => {
    setSelectedVisit({
      id: `ai_${Date.now()}`, companyId: companyId!, staffIds: [suggestion.staffId], patientName: pName, address: addr,
      date: suggestion.date, startTime: suggestion.startTime, endTime: suggestion.endTime, status: 'REGULAR_NURSE',
      recurrence: 'none', notes: 'AI提案により作成', staffMembers: staffList.filter(s => s.id === suggestion.staffId)
    });
    setSuggestionState({ isOpen: false });
  };

  return (
    <>
      <div className="flex-1 overflow-hidden p-2 md:p-4">
        {view === 'schedule' && (
          <Dashboard 
            visits={currentVisits} staffList={staffList} shifts={companyShifts} currentDate={currentDate}
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
            staff={staffList} shifts={companyShifts} currentDate={currentDate}
            onUpdateShift={handleUpdateShift} onOpenStaffForm={(staff) => setStaffFormState({ isOpen: true, initialStaff: staff })}
            onDeleteStaff={handleDeleteStaff} isReadOnly={isReadOnly} companySettings={companySettings}
          />
        )}

        {view === 'users' && currentUser?.role === 'admin' && (
          <UserManagement 
            companyId={companyId!} users={dbUsers}
            onAddUser={(u) => setDbUsers([...dbUsers, u])}
            onUpdateUser={(u) => setDbUsers(dbUsers.map(user => user.id === u.id ? u : user))}
            onDeleteUser={(id) => setDbUsers(dbUsers.filter(u => u.id !== id))}
          />
        )}

        {view === 'settings' && currentUser?.role === 'admin' && (
          <CompanySettingsView 
            settings={companySettings}
            onSave={(newSettings) => {
              setMasterCompanies(masterCompanies.map(c => c.id === companyId ? { ...c, settings: newSettings } : c));
              setToastMessage('保存しました');
            }}
            onDirtyChange={() => {}}
          />
        )}
      </div>

      {view === 'search' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => window.history.back()} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-2xl font-bold text-gray-800">スケジュール検索</h2>
              <button onClick={() => window.history.back()} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-88px)]">
              <SearchVisitsModal 
                onClose={() => window.history.back()} allVisits={allVisits} staffList={staffList}
                companySettings={companySettings} onSelectVisit={setSelectedVisit}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'export' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => window.history.back()} />
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
          visit={selectedVisit} staffList={staffList} companySettings={companySettings}
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
          onClose={() => setSuggestionState({ isOpen: false })} staffList={staffList}
          allVisits={allVisits} onApply={handleApplySuggestion} initialValues={suggestionState.initialValues}
        />
      )}

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </>
  );
}
