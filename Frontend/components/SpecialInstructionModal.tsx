"use client";

import React, { useState, useMemo } from 'react';
import { X, Sparkles, Calendar, Clock, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { Staff } from '@/lib/types';

interface SpecialInstructionModalProps {
  defaultDate: string;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultStaffIds: string[];
  patientName: string;
  visitAddress?: string;
  statusId: string;
  memo?: string;
  staffList: Staff[];
  onSubmit: (data: {
    start_date: string;
    start_time: string;
    end_time: string;
    assigned_user_ids: string[];
    patient_name: string;
    visit_address?: string;
    status_id: string;
    memo?: string;
  }) => Promise<number | undefined>;
  onClose: () => void;
}

export const SpecialInstructionModal: React.FC<SpecialInstructionModalProps> = ({
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultStaffIds,
  patientName,
  visitAddress,
  statusId,
  memo,
  staffList,
  onSubmit,
  onClose,
}) => {
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(defaultStaffIds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const DAYS = 14;

  const endDate = useMemo(() => {
    if (!startDate) return '';
    const d = new Date(startDate);
    d.setDate(d.getDate() + DAYS - 1);
    return d.toISOString().split('T')[0];
  }, [startDate]);

  const endDateDisplay = useMemo(() => {
    if (!endDate) return '';
    const d = new Date(endDate);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }, [endDate]);

  const DURATIONS = [30, 40, 60, 90, 120];

  const currentDurationMins = (() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  })();

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (!newStartTime || !endTime) return;
    const [oldH, oldM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let duration = (endH * 60 + endM) - (oldH * 60 + oldM);
    if (duration < 0) duration += 24 * 60;
    const [newH, newM] = newStartTime.split(':').map(Number);
    const newEndMins = newH * 60 + newM + duration;
    const finalH = Math.floor(newEndMins / 60) % 24;
    const finalM = newEndMins % 60;
    setEndTime(`${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`);
  };

  const applyDuration = (mins: number) => {
    if (!startTime) return;
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m + mins;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    setEndTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const handleSubmit = async () => {
    if (!startDate || !startTime || !endTime || selectedStaffIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const count = await onSubmit({
        start_date: startDate,
        start_time: startTime,
        end_time: endTime,
        assigned_user_ids: selectedStaffIds,
        patient_name: patientName,
        visit_address: visitAddress,
        status_id: statusId,
        memo,
      });
      setSuccessCount(count ?? DAYS);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-110 flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-5 border-b bg-linear-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            特別指示期間の一括登録
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {successCount !== null ? (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">一括登録が完了しました</p>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-bold text-indigo-600">{successCount}件</span>の訪問予定を登録しました
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {startDate} 〜 {endDateDisplay}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              閉じる
            </button>
          </div>
        ) : (
        <>
        <div className="p-5 space-y-5">
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-700">
            指定された期間（土日祝含む）に対して、毎日同じ内容の訪問予定を一括作成します。
            <br />
            患者名、住所、メモ等の情報は現在の入力内容がコピーされます。
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                特指示開始日
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                特指示終了日 ({DAYS}日間)
              </label>
              <div className="px-3 py-2 border rounded-lg bg-gray-50 text-sm text-gray-700 font-medium">
                {endDateDisplay || '—'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              訪問時間
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
              />
            </div>
            <div className="flex gap-1.5 mt-2">
              {DURATIONS.map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => applyDuration(mins)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    currentDurationMins === mins
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {mins}分
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              訪問スタッフ
            </label>
            <div className="flex flex-wrap gap-2">
              {staffList.map(staff => {
                const isSelected = selectedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    onClick={() => toggleStaff(staff.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                      style={{ backgroundColor: staff.color || '#6366f1' }}
                    >
                      {staff.name.charAt(0)}
                    </span>
                    {staff.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !startDate || selectedStaffIds.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            この期間で一括生成
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
