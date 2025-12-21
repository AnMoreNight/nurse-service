"use client";

import React, { useState } from 'react';
import { Staff, ShiftAssignment, ShiftType, CompanySettings } from '@/lib/types';
import { ChevronLeft, ChevronRight, Moon, Sun, Palmtree, Plus, Edit, Trash2, Copy, Check } from 'lucide-react';
import { getEffectiveShiftType, toLocalISOString } from '@/lib/constants';

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
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = currentDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cycleShiftType = (staffMember: Staff, dayIndex: number) => {
    if (isReadOnly) return;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayIndex).padStart(2, '0')}`;
    const effective = getEffectiveShiftType(staffMember, dateStr, shifts);

    // Cycle: none -> night1 -> night2 -> holiday -> night1_holiday -> night2_holiday -> work -> none
    // 'work' is used to override a default holiday back to a regular working day.
    // 'night(1|2)_holiday' combines night duty with the day also being a holiday.
    let nextType: ShiftType = null;
    if (effective === 'none' || effective === null) nextType = 'night1';
    else if (effective === 'night1') nextType = 'night2';
    else if (effective === 'night2') nextType = 'holiday';
    else if (effective === 'holiday') nextType = 'night1_holiday';
    else if (effective === 'night1_holiday') nextType = 'night2_holiday';
    else if (effective === 'night2_holiday') nextType = 'work';
    else if (effective === 'work') nextType = null; // Back to default

    onUpdateShift(staffMember.id, dateStr, nextType);
  };

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

  const handleCopyLastMonth = () => {
    if (isReadOnly) return;

    const lastMonth = new Date(year, month - 1, 1);
    const lastMonthYear = lastMonth.getFullYear();
    const lastMonthMonth = lastMonth.getMonth();
    const daysInLastMonth = new Date(lastMonthYear, lastMonthMonth + 1, 0).getDate();

    // Get all shifts from last month
    const lastMonthShifts = shifts.filter(s => {
      const [sy, sm] = s.date.split('-').map(Number);
      return sy === lastMonthYear && sm === lastMonthMonth + 1;
    });

    // For each day in current month, copy the shift if it exists on same day-of-month in last month
    for (let day = 1; day <= daysInMonth; day++) {
      if (day > daysInLastMonth) break;

      const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      staff.forEach(s => {
        const lastMonthShift = lastMonthShifts.find(sh => sh.staffId === s.id && sh.date.endsWith(`-${String(day).padStart(2, '0')}`));
        if (lastMonthShift && lastMonthShift.type) {
          onUpdateShift(s.id, currentDateStr, lastMonthShift.type);
        }
      });
    }

    setShowCopyConfirm(true);
    setTimeout(() => setShowCopyConfirm(false), 2000);
  };

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
          <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center"><Moon className="w-2.5 h-2.5 text-white"/></div>
          <span>夜間待機1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-slate-500 flex items-center justify-center"><Moon className="w-2.5 h-2.5 text-white"/></div>
          <span>夜間待機2</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center"><Palmtree className="w-2.5 h-2.5 text-pink-600"/></div>
          <span>公休</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center"><Sun className="w-2.5 h-2.5 text-emerald-600"/></div>
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
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{member.name}</div>
                      {member.jobTitle && <div className="text-[10px] text-gray-400 truncate">{member.jobTitle}</div>}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onOpenStaffForm(member)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                          <Edit className="w-3 h-3" />
                        </button>
                        <button onClick={() => { if (window.confirm(`${member.name}を削除しますか？`)) onDeleteStaff(member.id); }} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600">
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

                  return (
                    <td 
                      key={day} 
                      onClick={() => cycleShiftType(member, day)}
                      className={`p-1 text-center border-r border-b border-gray-100 cursor-pointer hover:bg-gray-100 ${isToday ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex justify-center">
                        {renderCellIcon(effective)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Copy Confirmation Toast */}
      {showCopyConfirm && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-5 h-5 text-emerald-400" />
          前月のシフトをコピーしました
        </div>
      )}
    </div>
  );
};
