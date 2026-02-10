"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MiniCalendarProps {
  currentDate: string; // ISO YYYY-MM-DD
  onDateSelect: (date: string) => void;
  onClose: () => void;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ currentDate, onDateSelect, onClose }) => {
  // Helper to parse date string strictly as local date components
  const parseDate = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // State for the month being viewed (not necessarily the selected date)
  const [viewDate, setViewDate] = useState(parseDate(currentDate));

  useEffect(() => {
    setViewDate(parseDate(currentDate));
  }, [currentDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  // Navigation
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Calendar Grid Generation
  const getDaysArray = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 0 = Sunday, 1 = Monday...
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    
    const days: (Date | null)[] = [];
    
    // Empty slots for previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const days = getDaysArray();
  const weeks = ['日', '月', '火', '水', '木', '金', '土'];

  // Formatting - compare using local date strings
  const isSelected = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === currentDate;
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && 
           d.getMonth() === today.getMonth() && 
           d.getFullYear() === today.getFullYear();
  };

  const handleSelect = (d: Date) => {
    // Adjust for timezone offset issues when converting simple dates
    // Creating a string YYYY-MM-DD manually to avoid UTC shifts
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    onDateSelect(`${y}-${m}-${day}`);
    onClose();
  };

  return (
    <div className="bg-white p-3 md:p-4 rounded-lg shadow-xl border border-gray-200 w-[280px] md:w-[320px] max-w-[90vw] select-none animate-in fade-in zoom-in-95 duration-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 md:mb-4 px-1">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-gray-800 font-bold text-sm md:text-base">
          {year}年 {month + 1}月
        </span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 mb-1 md:mb-2">
        {weeks.map((w, i) => (
          <div key={i} className="text-center text-[10px] md:text-xs text-gray-500 font-medium py-0.5 md:py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-0.5 md:gap-y-1">
        {days.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className="h-8 md:h-10" />;
          }

          const selected = isSelected(date);
          const today = isToday(date);

          return (
            <button
              key={i}
              onClick={() => handleSelect(date)}
              className={`
                h-8 w-8 md:h-9 md:w-9 mx-auto rounded-full flex items-center justify-center text-xs md:text-sm transition-colors relative
                ${selected 
                  ? 'bg-blue-600 text-white font-bold hover:bg-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
                }
                ${!selected && today ? 'text-blue-600 font-bold bg-blue-50' : ''}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
