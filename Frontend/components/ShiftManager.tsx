"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Staff, ShiftAssignment, ShiftType, CompanySettings } from '@/lib/types';
import { ChevronLeft, ChevronRight, Moon, Sun, Palmtree, Plus, Edit, Users } from 'lucide-react';
import { getEffectiveShiftType, toLocalISOString } from '@/lib/constants';
import { useModal } from '@/contexts/ModalContext';
import { getColorStyles } from '@/lib/utils';

interface ShiftManagerProps {
  staff: Staff[];
  shifts: ShiftAssignment[];
  currentDate: string;
  companySettings: CompanySettings;
  onUpdateShift: (staffId: string, date: string, type: ShiftType) => void;
  onOpenStaffForm: (staff?: Staff) => void;
  onDeleteStaff: (staffId: string) => void;
  onResignStaff?: (staffId: string) => void;
  isReadOnly?: boolean;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({
  staff, shifts, currentDate, companySettings, onUpdateShift, onOpenStaffForm, onDeleteStaff, onResignStaff, isReadOnly = false
}) => {
  const { showConfirm, showAlert } = useModal();
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);

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
        <div
          className="w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: type === 'night1' ? '#da5597' : '#5383ec' }}
        >
          <Moon className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
        </div>
      );
    }
    if (type === 'holiday') {
      return (
        <div className="w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8f8f8f' }}>
          <Palmtree className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-white" />
        </div>
      );
    }
    if (type === 'night1_holiday' || type === 'night2_holiday') {
      return (
        <div
          className="w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-bold relative"
          style={{ backgroundColor: type === 'night1_holiday' ? '#da5597' : '#5383ec' }}
        >
          <Moon className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-white" />
          <Palmtree className="w-2 h-2 md:w-2.5 md:h-2.5 text-white absolute -bottom-0.5 -right-0.5" style={{ backgroundColor: '#8f8f8f', borderRadius: '50%', padding: '1px' }} />
        </div>
      );
    }
    return <div className="w-5 h-5 md:w-7 md:h-7"></div>;
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
            ユーザー管理でユーザーを登録すると、自動的にシフト管理に表示されます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-none md:rounded-xl shadow-none md:shadow-sm border-0 md:border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-2.5 md:p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-gray-800 font-bold text-sm md:text-xl">
            {year}年 {month + 1}月
          </span>
          <div className="flex gap-1 shrink-0">
            <button onClick={prevMonth} className="p-1.5 md:p-2 hover:bg-gray-200 rounded-full text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-1.5 md:p-2 hover:bg-gray-200 rounded-full text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
        </div>
      </div>

      {/* Legend */}
      <div className="px-2.5 md:px-4 py-1.5 md:py-2 border-b bg-slate-50 flex flex-wrap items-center gap-x-2 md:gap-x-4 gap-y-1 text-[10px] md:text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#da5597' }}><Moon className="w-2.5 h-2.5 text-white" /></div>
          <span>夜間待機1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#5383ec' }}><Moon className="w-2.5 h-2.5 text-white" /></div>
          <span>夜間待機2</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8f8f8f' }}><Palmtree className="w-2.5 h-2.5 text-white" /></div>
          <span>休み</span>
        </div>
        {!isReadOnly && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-gray-400 italic">セルをクリックで切替</span>
          </>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full border-collapse text-xs md:text-sm min-w-[400px] sm:min-w-[600px] md:min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b">
            <tr>
              <th className="py-2 px-1.5 md:py-3 md:px-3 text-left font-bold text-gray-600 w-16 md:w-36 border-r bg-gray-50 sticky left-0 z-20">
                <span className="hidden md:inline">スタッフ</span>
                <span className="md:hidden text-[10px]">名前</span>
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayOfWeek = new Date(year, month, day).getDay();
                const isToday = dateStr === toLocalISOString(new Date());
                return (
                  <th
                    key={day}
                    className={`py-1.5 md:py-3 px-0.5 md:px-1 text-center font-medium w-7 md:w-10 border-r border-gray-100 ${isToday ? 'bg-blue-50' : ''} ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-600'}`}
                  >
                    <div className="text-[9px] md:text-xs text-gray-400">{weekDayLabels[dayOfWeek]}</div>
                    <div className={`text-xs md:text-base ${isToday ? 'font-bold text-blue-600' : ''}`}>{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map(member => {
              const isDeleting = deletingStaffId === member.id;
              return (
              <tr key={member.id} className={`hover:bg-gray-50/50 group ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
                <td className="py-1.5 md:py-2 px-1.5 md:px-3 border-r font-medium text-gray-800 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    {isDeleting ? (
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-red-100 shrink-0">
                        <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-[10px] md:text-xs shrink-0"
                        style={{
                          backgroundColor: getColorStyles(member.color).bgLight,
                          color: getColorStyles(member.color).text
                        }}
                      >
                        {member.avatar}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className={`truncate font-medium whitespace-nowrap text-[11px] md:text-sm ${isDeleting ? 'text-red-500 line-through' : ''}`} title={member.name}>
                        {isDeleting ? '削除中...' : member.name.substring(0, 2)}
                      </div>
                      {member.jobTitle && !isDeleting && <div className="text-[9px] md:text-[10px] text-gray-400 truncate whitespace-nowrap max-w-full hidden md:block" title={member.jobTitle}>{member.jobTitle}</div>}
                    </div>
                    {!isReadOnly && !isDeleting && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onOpenStaffForm(member)} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                          <Edit className="w-3 h-3" />
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
                      className={`p-0.5 md:p-1 text-center border-r border-b border-gray-100 cursor-pointer hover:bg-gray-100 relative ${isToday ? 'bg-blue-50/50' : ''} ${isActive ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
                    >
                      <div className="flex justify-center">
                        {renderCellIcon(effective)}
                      </div>
                    </td>
                  );
                })
                }
              </tr >
            )})}
          </tbody >
        </table >
      </div >

      {/* Shift Type Dropdown */}
      {activeCell && activeCell.rect && (() => {
        const dropdownWidth = 200;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 横方向の位置計算（画面右端を超える場合は左に配置）
        let left = activeCell.rect.left + window.scrollX;
        if (left + dropdownWidth > viewportWidth) {
          left = Math.max(10, activeCell.rect.right + window.scrollX - dropdownWidth);
        }
        
        // 縦方向の位置計算（画面下端を超える場合は上に配置）
        let top = activeCell.rect.bottom + window.scrollY + 5;
        const dropdownHeight = 400; // 概算の高さ
        if (activeCell.rect.bottom + dropdownHeight > viewportHeight) {
          top = activeCell.rect.top + window.scrollY - dropdownHeight - 5;
        }
        
        return (
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
          style={{
            top: `${top}px`,
            left: `${left}px`,
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
            onClick={() => handleShiftSelect('holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8f8f8f' }}>
              <Palmtree className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-700">休み</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night1')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#da5597' }}>
              <Moon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-700">夜間待機1</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night2')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#5383ec' }}>
              <Moon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-gray-700">夜間待機2</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night1_holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center relative" style={{ backgroundColor: '#da5597' }}>
              <Moon className="w-3.5 h-3.5 text-white" />
              <Palmtree className="w-2.5 h-2.5 text-white absolute -bottom-0.5 -right-0.5" style={{ backgroundColor: '#8f8f8f', borderRadius: '50%', padding: '1px' }} />
            </div>
            <span className="text-gray-700">夜間待機1（休）</span>
          </button>
          <button
            onClick={() => handleShiftSelect('night2_holiday')}
            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 text-sm"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center relative" style={{ backgroundColor: '#5383ec' }}>
              <Moon className="w-3.5 h-3.5 text-white" />
              <Palmtree className="w-2.5 h-2.5 text-white absolute -bottom-0.5 -right-0.5" style={{ backgroundColor: '#8f8f8f', borderRadius: '50%', padding: '1px' }} />
            </div>
            <span className="text-gray-700">夜間待機2（休）</span>
          </button>
        </div>
        );
      })()}
    </div >
  );
};
