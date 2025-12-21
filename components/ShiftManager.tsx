
import React, { useState } from 'react';
import { Staff, ShiftAssignment, ShiftType } from '../types';
import { ChevronLeft, ChevronRight, Notebook, Settings, Plus, Trash2, UserPlus, Copy, AlertTriangle, X } from 'lucide-react';
import { getEffectiveShiftType, toLocalISOString } from '../constants';

interface ShiftManagerProps {
  staffList: Staff[];
  shifts: ShiftAssignment[];
  onUpdateShift: (staffId: string, date: string, type: ShiftType) => void;
  onUpdateShifts: (monthPrefix: string, newShifts: ShiftAssignment[]) => void;
  onEditStaff: (staff: Staff) => void;
  onAddStaff: () => void;
  onDeleteStaff: (staffId: string) => void;
  isReadOnly?: boolean;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({ staffList, shifts, onUpdateShift, onUpdateShifts, onEditStaff, onAddStaff, onDeleteStaff, isReadOnly = false }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  // Generate days for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return {
      date: d,
      dateStr: toLocalISOString(d),
      dayNum: i + 1,
      dayOfWeek: d.getDay(), // 0=Sun,
    };
  });

  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleShiftChange = (staffId: string, dateStr: string, val: string) => {
    if (isReadOnly) return;
    const type = val as ShiftType;
    onUpdateShift(staffId, dateStr, type);
  };

  const executeCopyLastMonth = () => {
    if (isReadOnly) return;
    
    const prevDateObj = new Date(year, month - 1, 1);
    const prevYear = prevDateObj.getFullYear();
    const prevMonth = prevDateObj.getMonth();
    
    // Filter previous month's night shifts
    const sourceShifts = shifts.filter(s => {
        if (!s.date) return false;
        const parts = s.date.split('-');
        if (parts.length !== 3) return false;
        const [y, m, d] = parts.map(Number);
        // month in date string is 1-based, prevMonth is 0-based
        const isNightShift = s.type === 'night1' || s.type === 'night2' || s.type === 'night1_holiday' || s.type === 'night2_holiday';
        return y === prevYear && (m - 1) === prevMonth && isNightShift;
    });

    if (sourceShifts.length === 0) {
        alert('前月の夜間待機シフトが見つかりませんでした。');
        setShowCopyConfirm(false);
        return;
    }

    const newShifts: ShiftAssignment[] = [];
    
    sourceShifts.forEach(src => {
        const [srcY, srcM, srcD] = src.date.split('-').map(Number);
        const day = srcD;
        
        // Check if this day exists in current month
        // Using Date(year, month, day) automatically handles overflow (e.g. Feb 30 -> Mar 2), so we must check month match
        const targetDateObj = new Date(year, month, day);
        
        // Verify month match to ensure we don't copy 31st into a 30-day month
        if (targetDateObj.getMonth() !== month) return; 

        const targetDateStr = toLocalISOString(targetDateObj);
        
        newShifts.push({
            id: `copy_${Date.now()}_${Math.random()}`, 
            companyId: src.companyId,
            staffId: src.staffId,
            date: targetDateStr,
            type: src.type
        });
    });

    const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    onUpdateShifts(currentMonthStr, newShifts);
    setShowCopyConfirm(false);
  };

  const getShiftLabel = (type: ShiftType | 'none') => {
      if (type === 'night1') return <span>1</span>;
      if (type === 'night2') return <span>2</span>;
      if (type === 'night1_holiday') return <span className="text-[10px] leading-tight">1<br/>(休)</span>;
      if (type === 'night2_holiday') return <span className="text-[10px] leading-tight">2<br/>(休)</span>;
      if (type === 'holiday') return <span>休</span>;
      return null;
  };

  const getShiftColor = (type: ShiftType | 'none') => {
      if (type === 'night1') return 'bg-indigo-500 text-white';
      if (type === 'night2') return 'bg-pink-500 text-white';
      if (type === 'night1_holiday') return 'bg-indigo-500 text-white ring-2 ring-gray-300';
      if (type === 'night2_holiday') return 'bg-pink-500 text-white ring-2 ring-gray-300';
      if (type === 'holiday') return 'bg-gray-400 text-white';
      return 'bg-transparent'; // Transparent because the cell bg handles hover
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 flex flex-wrap justify-between items-center bg-white sticky top-0 z-20 gap-2">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
          <div className="p-1.5 md:p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Notebook className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          シフト管理
        </h2>
        <div className="flex items-center gap-2 md:gap-4">
           {/* Add Staff Button */}
           {!isReadOnly && (
               <>
                   <button 
                        onClick={() => setShowCopyConfirm(true)}
                        className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs md:text-sm font-bold transition-colors border border-gray-200"
                        title="前月の夜間待機シフトを今月にコピー"
                   >
                       <Copy className="w-3 h-3 md:w-4 md:h-4" />
                       <span className="hidden md:inline">夜間待機を前月からコピー</span>
                   </button>
                   <button 
                        onClick={onAddStaff}
                        className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs md:text-sm font-bold transition-colors"
                   >
                       <UserPlus className="w-3 h-3 md:w-4 md:h-4" />
                       <span className="hidden md:inline">スタッフ追加</span>
                       <span className="md:hidden">追加</span>
                   </button>
               </>
           )}

           <div className="h-4 md:h-6 border-r border-gray-300 mx-1 md:mx-2"></div>

           <span className="text-sm md:text-lg font-bold text-gray-700 whitespace-nowrap">
               {year}年 {month + 1}月
           </span>
           <div className="flex items-center gap-1">
                <button onClick={handlePrevMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={handleNextMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600">
                    <ChevronRight className="w-5 h-5" />
                </button>
           </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 md:px-6 py-2 bg-gray-50 border-b text-xs flex gap-2 md:gap-4 text-gray-600 flex-wrap">
         <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-indigo-500 rounded text-white flex items-center justify-center text-[10px]">1</div>
             夜間待機1
         </div>
         <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-pink-500 rounded text-white flex items-center justify-center text-[10px]">2</div>
             夜間待機2
         </div>
         <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-gray-400 rounded text-white flex items-center justify-center text-[10px]">休</div>
             公休
         </div>
         <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-indigo-500 rounded text-white flex items-center justify-center text-[10px] ring-2 ring-gray-300">1</div>
             夜間待機1(休)
         </div>
         <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-pink-500 rounded text-white flex items-center justify-center text-[10px] ring-2 ring-gray-300">2</div>
             夜間待機2(休)
         </div>
         <div className="ml-auto hidden md:block">
            <span className="bg-gray-200 px-2 py-1 rounded text-[10px] border border-gray-300">プルダウンで変更可能</span>
         </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
          <div className="min-w-max">
              {/* Grid Header (Days) */}
              <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-44 md:w-80 flex-shrink-0 p-2 md:p-3 font-bold text-gray-600 border-r bg-gray-100 sticky left-0 z-20 text-xs md:text-sm">
                      スタッフ名
                  </div>
                  {days.map((d) => (
                      <div 
                        key={d.dayNum} 
                        className={`w-10 flex-shrink-0 text-center py-2 border-r text-xs font-bold ${d.dayOfWeek === 0 ? 'text-red-500 bg-red-50' : d.dayOfWeek === 6 ? 'text-blue-500 bg-blue-50' : 'text-gray-600'}`}
                      >
                          <div>{d.dayNum}</div>
                          <div>{weekLabels[d.dayOfWeek]}</div>
                      </div>
                  ))}
              </div>

              {/* Grid Body (Staff Rows) */}
              {staffList.map(staff => (
                  <div key={staff.id} className="flex border-b border-gray-100 group hover:bg-gray-50">
                      {/* Staff Name Column */}
                      <div className="w-44 md:w-80 flex-shrink-0 p-2 md:p-3 border-r border-gray-200 bg-white group-hover:bg-gray-50 sticky left-0 z-10 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-white bg-${staff.color}-500 shrink-0`}>
                                {staff.avatar}
                            </div>
                            <span className="text-xs md:text-sm font-medium text-gray-700 truncate">{staff.name}</span>
                          </div>
                          
                          {!isReadOnly && (
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                                  <button 
                                    onClick={() => onEditStaff(staff)}
                                    className="p-1 md:p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                    title="設定"
                                  >
                                    <Settings size={14} />
                                  </button>
                                  <button 
                                    onClick={() => onDeleteStaff(staff.id)}
                                    className="hidden md:block p-1 md:p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    title="削除"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                              </div>
                          )}
                      </div>

                      {/* Days Cells */}
                      {days.map(d => {
                          const effectiveType = getEffectiveShiftType(staff, d.dateStr, shifts);
                          // For select value, we use the specific type, or 'work' if effectiveType is 'none' (implied work)
                          const typeVal = effectiveType === 'none' ? 'work' : effectiveType;
                          
                          return (
                              <div 
                                key={d.dateStr} 
                                className={`w-10 flex-shrink-0 border-r border-gray-100 relative p-1 transition-colors ${isReadOnly ? '' : 'hover:bg-gray-100'}`}
                              >
                                  {/* Visual Layer */}
                                  <div className={`w-full h-full rounded-md flex items-center justify-center text-xs font-bold transition-colors pointer-events-none ${getShiftColor(effectiveType)}`}>
                                      {getShiftLabel(effectiveType)}
                                  </div>

                                  {/* Interactive Layer (Hidden Select) */}
                                  <select
                                      disabled={isReadOnly}
                                      className={`absolute inset-0 w-full h-full opacity-0 appearance-none ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                      value={typeVal}
                                      onChange={(e) => handleShiftChange(staff.id, d.dateStr, e.target.value)}
                                      title={`${staff.name} - ${d.dateStr}`}
                                  >
                                      <option value="work">出勤</option>
                                      <option value="holiday">公休</option>
                                      <option value="night1">夜間1</option>
                                      <option value="night2">夜間2</option>
                                      <option value="night1_holiday">夜間1(休)</option>
                                      <option value="night2_holiday">夜間2(休)</option>
                                  </select>
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      </div>

      {/* Copy Confirmation Modal */}
      {showCopyConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center backdrop-blur-[1px] p-4">
              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-sm w-full animate-in zoom-in-95">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Copy className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-gray-800">夜間待機シフトのコピー</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                      前月（{(month === 0 ? year - 1 : year)}年{(month === 0 ? 12 : month)}月）の夜間待機シフトを、現在の月（{year}年{month + 1}月）にコピーしますか？
                  </p>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-6">
                      <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-1">
                          <AlertTriangle className="w-4 h-4" />
                          注意
                      </div>
                      <p className="text-xs text-amber-600">
                          現在の月の夜間待機シフトはすべて上書きされます。公休や通常の出勤情報は変更されません。
                      </p>
                  </div>
                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setShowCopyConfirm(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors"
                      >
                          キャンセル
                      </button>
                      <button 
                          onClick={executeCopyLastMonth}
                          className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-sm transition-colors"
                      >
                          実行する
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
