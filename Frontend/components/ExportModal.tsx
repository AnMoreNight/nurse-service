"use client";

import React, { useState } from 'react';
import { X, Download, Calendar, Notebook } from 'lucide-react';
import { toLocalISOString } from '@/lib/constants';
import { useModal } from '@/contexts/ModalContext';

interface ExportModalProps {
  onClose: () => void;
  onExport: (type: 'visits' | 'shifts', startDate: string, endDate: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport }) => {
  const { showAlert } = useModal();
  const today = toLocalISOString(new Date());
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = toLocalISOString(nextMonth);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextMonthStr);
  const [exportType, setExportType] = useState<'visits' | 'shifts'>('visits');

  const handleExport = async () => {
    if (startDate > endDate) {
      await showAlert('終了日は開始日より後の日付を指定してください。', 'error');
      return;
    }
    onExport(exportType, startDate, endDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white/30 z-[80] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
      <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-center">

        <div className="p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-2xl flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            データのエクスポート
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Export Type Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-3">出力するデータ</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`
                border rounded-xl p-4 cursor-pointer transition-all flex flex-col items-center gap-2
                ${exportType === 'visits' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}
              `}>
                <input
                  type="radio"
                  className="hidden"
                  checked={exportType === 'visits'}
                  onChange={() => setExportType('visits')}
                />
                <Calendar className="w-6 h-6" />
                <span className="font-bold text-sm">スケジュール</span>
              </label>

              <label className={`
                border rounded-xl p-4 cursor-pointer transition-all flex flex-col items-center gap-2
                ${exportType === 'shifts' ? 'border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}
              `}>
                <input
                  type="radio"
                  className="hidden"
                  checked={exportType === 'shifts'}
                  onChange={() => setExportType('shifts')}
                />
                <Notebook className="w-6 h-6" />
                <span className="font-bold text-sm">シフト・夜間待機</span>
              </label>
            </div>
          </div>

          {/* Date Range Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-3">期間指定</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">開始日</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-gray-700"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <span className="text-gray-400 mt-4">～</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">終了日</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-gray-700"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        <div className="p-5 border-t bg-gray-50 rounded-b-none md:rounded-b-2xl flex justify-end gap-3 mt-auto md:mt-0 pb-safe">
          <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-bold transition-colors text-sm">
            キャンセル
          </button>
          <button onClick={handleExport} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-transform active:scale-95 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>

      </div>
    </div>
  );
};
