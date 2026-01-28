"use client";

import React, { useState, useEffect } from 'react';
import { Staff, VisitWithStaff, ScheduleSuggestion } from '@/lib/types';
import { X, Sparkles, MapPin, Clock, Calendar, Check, AlertCircle } from 'lucide-react';
import { suggestSchedule } from '@/services/geminiService';
import { toLocalISOString } from '@/lib/constants';
import { getColorStyles } from '@/lib/utils';

interface ScheduleSuggestionModalProps {
    onClose: () => void;
    staffList: Staff[];
    allVisits: VisitWithStaff[];
    onApply: (suggestion: ScheduleSuggestion, patientName: string, address: string) => void;
    initialValues?: {
        patientName?: string;
        address?: string;
        date?: string;
        staffIds?: string[];
    };
}

export const ScheduleSuggestionModal: React.FC<ScheduleSuggestionModalProps> = ({ onClose, staffList, allVisits, onApply, initialValues }) => {
    // Input States
    const [patientName, setPatientName] = useState('');
    const [address, setAddress] = useState('');
    const [startDate, setStartDate] = useState(toLocalISOString(new Date()));
    const [duration, setDuration] = useState(60);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('18:00');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

    // Processing States
    const [isProcessing, setIsProcessing] = useState(false);
    const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialValues) {
            if (initialValues.patientName) setPatientName(initialValues.patientName);
            if (initialValues.address) setAddress(initialValues.address);
            if (initialValues.date) {
                setStartDate(initialValues.date);
            }
            if (initialValues.staffIds && initialValues.staffIds.length > 0) {
                setSelectedStaffIds(initialValues.staffIds);
            } else {
                setSelectedStaffIds([]);
            }
        } else {
            // Default selection if no initial values
            setSelectedStaffIds([]);
        }
    }, [initialValues, staffList]);

    // Automatically update selectedDays when startDate changes
    useEffect(() => {
        if (startDate) {
            const day = new Date(startDate).getDay();
            setSelectedDays([day]);
        }
    }, [startDate]);

    const toggleStaff = (id: string) => {
        setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const handleAnalyze = async () => {
        if (!patientName.trim() || !address.trim()) {
            setError("患者名と住所は必須です。");
            return;
        }
        // selectedDays is auto-set by useEffect, so just check if valid
        if (selectedDays.length === 0 || selectedStaffIds.length === 0) {
            setError("候補スタッフを選択してください。");
            return;
        }

        setIsProcessing(true);
        setError('');
        setSuggestions([]);

        try {
            // Filter relevant staff
            const candidateStaff = staffList.filter(s => selectedStaffIds.includes(s.id));

            // --- PERFORMANCE OPTIMIZATION ---
            // Only send visits for the target date
            const relevantVisits = allVisits.filter(v => {
                // 1. Must match selected staff
                const isStaffMatch = v.staffIds.some(id => selectedStaffIds.includes(id));
                if (!isStaffMatch) return false;

                // 2. Must be exactly the date
                return v.date === startDate;
            });

            const result = await suggestSchedule({
                patientName,
                patientAddress: address,
                durationMinutes: duration,
                timeRangeStart: startTime,
                timeRangeEnd: endTime,
                startDate: startDate,
                targetDays: selectedDays,
                candidateStaff,
                existingVisits: relevantVisits
            });

            setSuggestions(result);
            if (result.length === 0) {
                setError("条件に合う空き枠が見つかりませんでした。条件を緩和して再度お試しください。");
            }
        } catch (e: unknown) {
            console.error("Analysis Error:", e);
            // Show specific error if available
            const msg = e instanceof Error ? e.message : "AI分析中にエラーが発生しました。";
            if (msg.includes("API key")) {
                setError("APIキー設定エラー: 環境変数を確認してください。");
            } else {
                setError(msg);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white/30 z-[100] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:max-w-2xl md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-5 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            AIスケジュール提案
                        </h3>
                        <p className="text-xs text-indigo-700 mt-1">住所と動線を考慮して最適な枠を提案します</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors">
                        <X className="w-5 h-5 text-indigo-900" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {/* Input Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">患者名 <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="例: 佐藤 太郎"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">住所 (動線分析用) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="例: 東京都新宿区..."
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">訪問日 <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">所要時間 (分)</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                />
                            </div>

                            <div className="col-span-2 md:col-span-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">希望時間帯</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                    <span className="text-gray-400">〜</span>
                                    <input
                                        type="time"
                                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">候補スタッフ (複数選択可) <span className="text-red-500">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {staffList.map(staff => (
                                    <button
                                        key={staff.id}
                                        onClick={() => toggleStaff(staff.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${selectedStaffIds.includes(staff.id)
                                                ? 'ring-2 ring-offset-1'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        style={selectedStaffIds.includes(staff.id) ? {
                                            backgroundColor: getColorStyles(staff.color).bgLight,
                                            borderColor: getColorStyles(staff.color).border,
                                            color: getColorStyles(staff.color).text,
                                            '--tw-ring-color': getColorStyles(staff.color).bg
                                        } as React.CSSProperties : undefined}
                                    >
                                        <div
                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white"
                                            style={{ backgroundColor: getColorStyles(staff.color).bg }}
                                        >
                                            {staff.avatar}
                                        </div>
                                        {staff.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={handleAnalyze}
                                disabled={isProcessing}
                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        分析中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        スケジュールを提案する
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Results Section */}
                    {suggestions.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h4 className="text-sm font-bold text-gray-700 ml-1">AIによる提案結果</h4>
                            {suggestions.map((suggestion, index) => {
                                const staff = staffList.find(s => s.id === suggestion.staffId);
                                if (!staff) return null;

                                return (
                                    <div key={index} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                                        <div className="flex justify-between items-center gap-4">
                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded text-sm font-bold text-gray-700">
                                                        <Calendar className="w-4 h-4 text-gray-500" />
                                                        {suggestion.date}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded text-sm font-bold text-gray-700">
                                                        <Clock className="w-4 h-4 text-gray-500" />
                                                        {suggestion.startTime} - {suggestion.endTime}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                                                        style={{ backgroundColor: getColorStyles(staff.color).bg }}
                                                    >
                                                        {staff.avatar}
                                                    </div>
                                                    <span className="font-bold text-gray-800 text-sm">{staff.name}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => onApply(suggestion, patientName, address)}
                                                className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
                                            >
                                                <Check className="w-4 h-4" />
                                                決定
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
