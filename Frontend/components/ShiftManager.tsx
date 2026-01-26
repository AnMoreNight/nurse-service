"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Staff, ShiftAssignment, ShiftType, CompanySettings } from '@/lib/types';
import { ChevronLeft, ChevronRight, Moon, Sun, Palmtree, Plus, Edit, Trash2, Copy, Check, Users } from 'lucide-react';
import { getEffectiveShiftType, toLocalISOString } from '@/lib/constants';
import { useModal } from '@/contexts/ModalContext';

interface ShiftManagerProps {
  staff: Staff[];
  shifts: ShiftAssignment[];
  currentDate: string;
  companySettings: CompanySettings;
  onUpdateShift: (staffId: string, date: string, type: ShiftType) => void;
  onOpenStaffForm: (staff?: Staff) => void;
  onDeleteStaff: (staffId: string) => void;
  isReadOnly?: boolean;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({
  staff, shifts, currentDate, companySettings, onUpdateShift, onOpenStaffForm, onDeleteStaff, isReadOnly = false
}) => {
  console.log('[ShiftManager] Received props:', { staffCount: staff.length, shiftsCount: shifts.length, staff });
  const { showConfirm } = useModal();

  const [viewDate, setViewDate] = useState(() => {
    // Try to restore the last viewed month from localStorage
    const savedMonth = localStorage.getItem('shiftManager_viewMonth');
    if (savedMonth) {
      try {
        const [y, m] = savedMonth.split('-').map(Number);
        return new Date(y, m - 1, 1);
      } catch {
        // If parse fails, fall back to current date
      }
    }
    // Default to current date
    const [y, m] = currentDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  // Persist the viewed month in localStorage whenever it changes
  useEffect(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;
    localStorage.setItem('shiftManager_viewMonth', `${year}-${month}`);
  }, [viewDate]);

  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [activeCell, setActiveCell] = useState<{ staffId: string; date: string; rect?: DOMRect } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleCellClick = (e: React.MouseEvent, staffId: string, date: string) => {
    if (isReadOnly) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveCell({ staffId, date, rect });
  };

  const handleShiftSelect = (type: ShiftType) => {
    if (!activeCell) return;
    onUpdateShift(activeCell.staffId, activeCell.date, type);
    setActiveCell(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveCell(null);
      }
    };
    if (activeCell) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCell]);

  const renderCellIcon = (type: ShiftType | 'none') => {
    if (type === 'night1' || type === 'night2') {
      return (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${type === 'night1' ? 'bg-slate-700 text-white' : 'bg-slate-500 text-white'}`}>
          <Moon className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (type === 'holiday') {
      return (
        <div className="w-7 h-7 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center">
          <Palmtree className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (type === 'work') {
      return (
        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <Sun className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (type === 'night1_holiday' || type === 'night2_holiday') {
      return (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold relative ${type === 'night1_holiday' ? 'bg-slate-700' : 'bg-slate-500'}`}>
          <Moon className="w-3.5 h-3.5 text-white" />
          <Palmtree className="w-2.5 h-2.5 text-pink-400 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    }
    return <div className="w-7 h-7"></div>;
  };

  const handleCopyLastMonth = async () => {
    if (isReadOnly) return;

    // Show confirmation dialog before copying
    const confirmed = await showConfirm('前月のシフトを今月にコピーしますか？\n（全てのシフトがコピーされます）');
    if (!confirmed) return;

    const lastMonth = new Date(year, month - 1, 1);
    const lastMonthYear = lastMonth.getFullYear();
    const lastMonthMonth = lastMonth.getMonth();
    const daysInLastMonth = new Date(lastMonthYear, lastMonthMonth + 1, 0).getDate();

    // Get all shifts from last month
    const lastMonthShifts = shifts.filter(s => {
      const [sy, sm] = s.date.split('-').map(Number);
      return sy === lastMonthYear && sm === lastMonthMonth + 1;
    });

    // All shift types to copy (copy all assigned shifts)
    const shiftTypesToCopy: ShiftType[] = ['work', 'holiday', 'night1', 'night2', 'night1_holiday', 'night2_holiday'];
    let copiedCount = 0;

    // For each day in current month, copy shifts if they exist on same day-of-month in last month
    for (let day = 1; day <= daysInMonth; day++) {
      if (day > daysInLastMonth) break;

      const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      staff.forEach(s => {
        const lastMonthShift = lastMonthShifts.find(sh => sh.staffId === s.id && sh.date.endsWith(`-${String(day).padStart(2, '0')}`));
        // Copy if it's any of the shift types we want to copy
        if (lastMonthShift && lastMonthShift.type && shiftTypesToCopy.includes(lastMonthShift.type)) {
          onUpdateShift(s.id, currentDateStr, lastMonthShift.type);
          copiedCount++;
        }
      });
    }

    setShowCopyConfirm(true);
    setTimeout(() => setShowCopyConfirm(false), 2000);

    // Optional: could add a console log for debugging
    console.log(`Copied ${copiedCount} shifts from last month`);
  };

  // Show empty state if no staff
  if (staff.length === 0) {
    return (
      <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">スタッフが登録されていません</h3>
          <p className="text-gray-500 mb-6">
            シフトを管理するには、まずスタッフを追加してください。
          </p>
          {!isReadOnly && (
            <button
              onClick={() => onOpenStaffForm()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition-colors font-bold shadow-sm mx-auto"
            >
              <Plus className="w-5 h-5" />
              スタッフを追加
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-200 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {year}年 {month + 1}月
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-200 rounded-full">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!isReadOnly && (
            <>
              <button
                onClick={handleCopyLastMonth}
                className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-colors text-sm font-bold shadow-sm"
              >
                <Copy className="w-4 h-4" />
                前月からコピー
              </button>
              <button
                onClick={() => onOpenStaffForm()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                スタッフ追加
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b bg-slate-50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center"><Moon className="w-2.5 h-2.5 text-white" /></div>
          <span>夜間待機1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-slate-500 flex items-center justify-center"><Moon className="w-2.5 h-2.5 text-white" /></div>
          <span>夜間待機2</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center"><Palmtree className="w-2.5 h-2.5 text-pink-600" /></div>
          <span>公休</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center"><Sun className="w-2.5 h-2.5 text-emerald-600" /></div>
          <span>出勤(公休解除)</span>
        </div>
        <span className="text-gray-400">|</span>
        <span className="text-gray-400 italic">セルをクリックで切替</span>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b">
            <tr>
              <th className="py-3 px-3 text-left font-bold text-gray-600 w-36 border-r bg-gray-50 sticky left-0 z-20">
                スタッフ
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayOfWeek = new Date(year, month, day).getDay();
                const isToday = dateStr === toLocalISOString(new Date());
                return (
                  <th
                    key={day}
                    className={`py-3 px-1 text-center font-medium w-10 border-r border-gray-100 ${isToday ? 'bg-blue-50' : ''} ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                  >
                    <div className="text-xs text-gray-400">{weekDayLabels[dayOfWeek]}</div>
                    <div className={`text-base ${isToday ? 'font-bold text-blue-600' : ''}`}>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map(member => (
              <tr key={member.id} className="hover:bg-gray-50/50 group">
                <td className="py-2 px-3 border-r font-medium text-gray-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full bg-${member.color}-100 flex items-center justify-center text-${member.color}-700 font-bold text-xs shrink-0`}>
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="truncate font-medium whitespace-nowrap" title={member.name}>{member.name.substring(0, 2)}</div>
                      {member.jobTitle && <div className="text-[10px] text-gray-400 truncate whitespace-nowrap max-w-full" title={member.jobTitle}>{member.jobTitle}</div>}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onOpenStaffForm(member)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                          <Edit className="w-3 h-3" />
                        </button>
                        <button onClick={async () => { const confirmed = await showConfirm(`${member.name}を削除しますか？`); if (confirmed) onDeleteStaff(member.id); }} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const effective = getEffectiveShiftType(member, dateStr, shifts);
                  const isToday = dateStr === toLocalISOString(new Date());
                  const isActive = activeCell?.staffId === member.id && activeCell?.date === dateStr;

                  return (
                    <td
                      key={day}
                      onClick={(e) => handleCellClick(e, member.id, dateStr)}
                      className={`p-1 text-center border-r border-b border-gray-100 cursor-pointer hover:bg-gray-100 relative ${isToday ? 'bg-blue-50/50' : ''} ${isActive ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
                    >
                      <div className="flex justify-center">
                        {renderCellIcon(effective)}
                      </div>
                    </td>
                  );
                })
                }
              </tr >
            ))}
          </tbody >
        </table >
      </div >

      {/* Copy Confirmation Toast */}
      {
        showCopyConfirm && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
            <Check className="w-5 h-5 text-emerald-400" />
            前月のシフトをコピーしました
          </div>
        )
      }

      {/* Shift Type Dropdown */}
      {activeCell && activeCell.rect && (
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
          style={{
            top: `${activeCell.rect.bottom + window.scrollY + 5}px`,
            left: `${activeCell.rect.left + window.scrollX}px`,
          }}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b">シフト選択</div>
          <button
            onClick={() => handleShiftSelect(null)}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6"></div>
            <span className="text-gray-600">なし（デフォルト）</span>
          </button>
          <button
            onClick={() => handleShiftSelect('work')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Sun className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-gray-700">出勤</span>
          </button>
          <button
            onClick={() => handleShiftSelect('holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center">
              <Palmtree className="w-3.5 h-3.5 text-pink-600" />
            </div>
            <span className="text-gray-700">公休</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night1')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
              <Moon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-700">夜間待機1</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night2')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center">
              <Moon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-700">夜間待機2</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night1_holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center relative">
              <Moon className="w-3.5 h-3.5 text-white" />
              <Palmtree className="w-2.5 h-2.5 text-pink-400 absolute -bottom-0.5 -right-0.5" />
            </div>
            <span className="text-gray-700">夜間待機1（休）</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night2_holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center relative">
              <Moon className="w-3.5 h-3.5 text-white" />
              <Palmtree className="w-2.5 h-2.5 text-pink-400 absolute -bottom-0.5 -right-0.5" />
            </div>
            <span className="text-gray-700">夜間待機2（休）</span>
          </button>
        </div>
      )}
    </div >
  );
};
