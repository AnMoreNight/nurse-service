"use client";

import React, { useState } from 'react';
import { X, RefreshCw, Calendar, Clock, MapPin, User, Users, FileText, Loader2 } from 'lucide-react';
import { getColorStyles } from '@/lib/utils';
import { Staff, CompanySettings } from '@/lib/types';

interface BulkRecurringModalProps {
  currentDate: string;
  staffList: Staff[];
  statuses: { status_id: string; name: string; color: string }[];
  companySettings: CompanySettings;
  onSubmit: (data: {
    patient_name: string;
    visit_address?: string;
    start_date: string;
    start_time: string;
    end_time: string;
    day_of_week: number[];
    status_id: string;
    memo?: string;
    assigned_user_ids: string[];
  }) => Promise<void>;
  onClose: () => void;
}

// JS convention: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const WEEKDAYS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
];

export const BulkRecurringModal: React.FC<BulkRecurringModalProps> = ({
  currentDate,
  staffList,
  statuses,
  onSubmit,
  onClose,
}) => {
  const [patientName, setPatientName] = useState('');
  const [visitAddress, setVisitAddress] = useState('');
  const [startDate, setStartDate] = useState(currentDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [statusId, setStatusId] = useState(statuses[0]?.status_id || '');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!patientName.trim() || selectedDays.length === 0 || selectedStaffIds.length === 0 || !statusId) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        patient_name: patientName,
        visit_address: visitAddress || undefined,
        start_date: startDate,
        start_time: startTime,
        end_time: endTime,
        day_of_week: selectedDays,
        status_id: statusId,
        memo: memo || undefined,
        assigned_user_ids: selectedStaffIds,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-110 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-5 border-b bg-linear-to-r from-teal-50 to-emerald-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-500" />
              定期訪問の一括登録
            </h3>
            <p className="text-xs text-teal-600 mt-0.5">指定した曜日で毎週繰り返す予定を作成します</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              患者名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="患者名を入力"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              住所
            </label>
            <input
              type="text"
              value={visitAddress}
              onChange={(e) => setVisitAddress(e.target.value)}
              placeholder="住所を入力"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                時間
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
                />
                <span className="text-gray-400 text-xs">〜</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              訪問曜日（複数選択可） <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {WEEKDAYS.map(day => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-teal-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              担当スタッフ <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm cursor-pointer flex items-center justify-between min-h-[38px]"
                onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
              >
                {selectedStaffIds.length > 0 ? (
                  <span className="text-gray-700">
                    {selectedStaffIds.map(id => staffList.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                  </span>
                ) : (
                  <span className="text-gray-400">選択してください</span>
                )}
                <Users className="w-4 h-4 text-gray-400" />
              </div>
              {isStaffDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="スタッフを検索..."
                      className="w-full px-2 py-1.5 border rounded text-sm outline-none focus:ring-1 focus:ring-teal-500"
                      autoFocus
                    />
                  </div>
                  {filteredStaff.map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => toggleStaff(staff.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                        selectedStaffIds.includes(staff.id) ? 'bg-teal-50 text-teal-700' : ''
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0"
                        style={{ backgroundColor: staff.color || '#14b8a6' }}
                      >
                        {staff.name.charAt(0)}
                      </span>
                      <span>{staff.name}</span>
                      {selectedStaffIds.includes(staff.id) && (
                        <span className="ml-auto text-teal-500 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">ステータス</label>
            {(() => {
              const selected = statuses.find(s => s.status_id === statusId);
              const styles = selected ? getColorStyles(selected.color) : null;
              return (
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm font-bold cursor-pointer"
                  style={styles ? {
                    backgroundColor: styles.bgLight,
                    color: styles.text,
                    borderColor: styles.border,
                  } : undefined}
                >
                  {statuses.map(s => {
                    const st = getColorStyles(s.color);
                    return (
                      <option
                        key={s.status_id}
                        value={s.status_id}
                        style={{ backgroundColor: st.bgLight, color: st.text }}
                      >
                        {s.name}
                      </option>
                    );
                  })}
                </select>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              メモ
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモ..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white text-sm resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !patientName.trim() || selectedDays.length === 0 || selectedStaffIds.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            登録
          </button>
        </div>
      </div>
    </div>
  );
};
