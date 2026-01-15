"use client";

import React, { useState } from 'react';
import { RecurrenceRule, RecurrenceFrequency } from '@/lib/types';
import { X } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

interface CustomRecurrenceModalProps {
    initialRule?: RecurrenceRule;
    startDate: string;
    onSave: (rule: RecurrenceRule) => void;
    onClose: () => void;
}

export const CustomRecurrenceModal: React.FC<CustomRecurrenceModalProps> = ({ initialRule, startDate, onSave, onClose }) => {
    const { showAlert } = useModal();
    // Default to monthly if passed rule is daily or weekly, or undefined.
    // Weekly is now handled only by the main VisitModal dropdown, not custom.
    const [frequency, setFrequency] = useState<RecurrenceFrequency>(
        (initialRule?.frequency === 'daily' || initialRule?.frequency === 'weekly' ? 'monthly' : initialRule?.frequency) || 'monthly'
    );

    const [weekDays, setWeekDays] = useState<number[]>(() => {
        if (initialRule?.weekDays && initialRule.weekDays.length > 0) return initialRule.weekDays;
        return [new Date(startDate).getDay()];
    });

    const [weekNos, setWeekNos] = useState<number[]>(() => {
        if (initialRule?.weekNos && initialRule.weekNos.length > 0) return initialRule.weekNos;
        const d = new Date(startDate);
        const day = d.getDate();
        const nth = Math.floor((day - 1) / 7) + 1;
        return [nth > 5 ? 5 : nth];
    });

    // For monthly: toggle between "Date" (same day) and "DayOfWeek" (e.g. 2nd Monday)
    const [monthlyMode, setMonthlyMode] = useState<'date' | 'weekday'>(
        initialRule?.frequency === 'monthly' && initialRule?.weekNos && initialRule.weekNos.length > 0
            ? 'weekday' : 'date'
    );

    const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const weekNoLabels = [
        { val: 1, label: '第1' },
        { val: 2, label: '第2' },
        { val: 3, label: '第3' },
        { val: 4, label: '第4' },
        { val: 5, label: '最終' },
    ];

    const toggleWeekDay = (dayIndex: number) => {
        // Enforce single selection for monthly weekdays
        setWeekDays([dayIndex]);
    };

    const toggleWeekNo = (no: number) => {
        if (weekNos.includes(no)) {
            setWeekNos(weekNos.filter(n => n !== no));
        } else {
            setWeekNos([...weekNos, no].sort());
        }
    };

    const handleSave = async () => {
        // Basic validation
        let finalWeekDays = weekDays;
        let finalWeekNos = weekNos;
        let finalDayOfMonth: number | undefined = undefined;

        if (frequency === 'monthly') {
            if (monthlyMode === 'date') {
                // Monthly by date mode: extract day from startDate
                const startDay = new Date(startDate).getDate();
                finalDayOfMonth = startDay;
                finalWeekDays = [];
                finalWeekNos = [];
            } else {
                // Monthly by weekday mode: validate selections
                if (finalWeekDays.length === 0) {
                    await showAlert('曜日を選択してください', 'error');
                    return;
                }
                if (finalWeekNos.length === 0) {
                    await showAlert('週（第1〜5）を選択してください', 'error');
                    return;
                }
                finalDayOfMonth = undefined;
            }
        } else {
            // Yearly or others (if any)
            finalWeekDays = [];
            finalWeekNos = [];
            finalDayOfMonth = undefined;
        }

        onSave({
            frequency,
            interval: 1, // Fixed to 1
            weekDays: finalWeekDays,
            weekNos: finalWeekNos,
            dayOfMonth: finalDayOfMonth,
            endType: 'never',
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-white/30 z-[60] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-sm animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-center">
                <div className="p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-2xl flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">カスタムの繰り返し</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Frequency Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">繰り返す頻度:</label>
                        <select
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-gray-50 cursor-pointer"
                            value={frequency}
                            onChange={(e) => {
                                const val = e.target.value as RecurrenceFrequency;
                                setFrequency(val);
                            }}
                        >
                            <option value="monthly">毎月</option>
                            <option value="yearly">毎年</option>
                        </select>
                    </div>

                    {/* Monthly Settings */}
                    {frequency === 'monthly' && (
                        <div className="space-y-4">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${monthlyMode === 'date' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                    onClick={() => setMonthlyMode('date')}
                                >
                                    日付で指定
                                </button>
                                <button
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${monthlyMode === 'weekday' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                    onClick={() => setMonthlyMode('weekday')}
                                >
                                    曜日で指定
                                </button>
                            </div>

                            {monthlyMode === 'date' ? (
                                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">
                                    開始日（{new Date(startDate).getDate()}日）と同じ日付に毎月繰り返します。
                                </p>
                            ) : (
                                <div className="space-y-4 bg-gray-50 p-3 rounded border">
                                    {/* Week Number Select */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">週 (複数選択可):</label>
                                        <div className="flex flex-wrap gap-2">
                                            {weekNoLabels.map((item) => {
                                                const isSelected = weekNos.includes(item.val);
                                                return (
                                                    <button
                                                        key={item.val}
                                                        onClick={() => toggleWeekNo(item.val)}
                                                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${isSelected
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Week Day Select */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">曜日 (1つのみ):</label>
                                        <div className="flex justify-between">
                                            {weekDayLabels.map((label, idx) => {
                                                const isSelected = weekDays.includes(idx);
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => toggleWeekDay(idx)}
                                                        className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${isSelected
                                                            ? 'bg-blue-600 text-white shadow-md'
                                                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-400 mt-2">
                                        例: 「第2」と「月」を選択 → 毎月 第2月曜日に繰り返し
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                <div className="p-5 border-t bg-gray-50 rounded-b-none md:rounded-b-2xl flex justify-end gap-3 mt-auto md:mt-0 pb-safe">
                    <button onClick={onClose} className="px-5 py-2 text-teal-600 hover:bg-teal-50 rounded-lg font-bold transition-colors">
                        キャンセル
                    </button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-md transition-transform active:scale-95">
                        完了
                    </button>
                </div>
            </div>
        </div>
    );
};
