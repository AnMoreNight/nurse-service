"use client";

import React, { useState, useEffect } from 'react';
import { Staff } from '@/lib/types';
import { X, Save, Calendar, Briefcase } from 'lucide-react';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, jobTitle: string, defaultHolidays: number[], joinedDate: string) => void;
  initialStaff?: Staff;
  currentDate: string;
  jobTitles: string[]; // Provided from settings
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen, onClose, onSave, initialStaff, currentDate, jobTitles
}) => {
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [defaultHolidays, setDefaultHolidays] = useState<number[]>([]);
  const [joinedDate, setJoinedDate] = useState('');
  const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  useEffect(() => {
    if (isOpen) {
      if (initialStaff) {
        setName(initialStaff.name);
        setJobTitle(initialStaff.jobTitle || '');
        setDefaultHolidays(initialStaff.defaultHolidayWeekDays || []);
        setJoinedDate(initialStaff.joinedDate);
      } else {
        setName('');
        setJobTitle(jobTitles[0] || '');
        setDefaultHolidays([]);
        setJoinedDate(currentDate);
      }
    }
  }, [isOpen, initialStaff, currentDate, jobTitles]);

  if (!isOpen) return null;

  const handleToggleHoliday = (dayIndex: number) => {
    setDefaultHolidays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (!joinedDate) {
      alert("入職日を入力してください");
      return;
    }
    onSave(name, jobTitle, defaultHolidays, joinedDate);
    onClose();
  };

  const isEdit = !!initialStaff;

  return (
    <div className="fixed inset-0 bg-white/30 z-[90] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
      <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-center">
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">
            {isEdit ? 'スタッフ編集' : 'スタッフ追加'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">名前</label>
            <input
              type="text"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              placeholder="例: 看護師C (山田)"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">職種</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <select
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white appearance-none cursor-pointer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              >
                <option value="">選択なし</option>
                {jobTitles.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">入職日 (表示開始日)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">※この日付より前のスケジュールには表示されません。</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">固定休み（デフォルト公休）</label>
            <div className="flex justify-between">
              {weekDayLabels.map((label, idx) => {
                const isSelected = defaultHolidays.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => handleToggleHoliday(idx)}
                    className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${isSelected ? 'bg-gray-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 mt-auto md:mt-0 pb-safe">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium">キャンセル</button>
          <button onClick={handleSave} disabled={!name.trim()} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-md flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" />
            {isEdit ? '更新' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
};
