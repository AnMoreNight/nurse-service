"use client";

import React, { useState, useEffect, useRef } from 'react';
import { VisitWithStaff, Staff, RecurrenceRule, RecurrenceScope, CompanySettings } from '@/lib/types';
import { X, Save, User, Trash2, FileText, Repeat, Users, Check, MapPin, ExternalLink, Copy, Calendar, Sparkles, AlertTriangle, ClipboardList } from 'lucide-react';
import { RecurrenceScopeModal } from './RecurrenceScopeModal';
import { useModal } from '@/contexts/ModalContext';
import { getColorStyles } from '@/lib/utils';

interface VisitModalProps {
    visit: VisitWithStaff;
    staffList: Staff[];
    statuses: { status_id: string; name: string; color: string; }[];
    companySettings: CompanySettings;
    onClose: () => void;
    onUpdate: (updatedVisit: VisitWithStaff, scope?: RecurrenceScope, occurrenceDate?: string) => void | Promise<void>;
    onDelete: (visitId: string, scope?: RecurrenceScope, occurrenceDate?: string) => void;
    onDuplicate?: (visit: VisitWithStaff) => void;
    onAiQuery?: (data: { patientName: string; address: string; date: string; staffIds: string[] }) => void;
    onSpecialInstruction?: (data: { date: string; startTime: string; endTime: string; staffIds: string[]; patientName: string; visitAddress?: string; statusId: string; memo?: string }) => void;
    isReadOnly?: boolean;
}

export const VisitModal: React.FC<VisitModalProps> = ({
    visit,
    staffList,
    statuses,
    companySettings,
    onClose,
    onUpdate,
    onDelete,
    onDuplicate,
    onAiQuery,
    onSpecialInstruction,
    isReadOnly = false
}) => {
    const isNew = visit.id.startsWith('new_') || visit.id.startsWith('ai_') || visit.id.startsWith('dup_');
    const isRecurring = visit.recurrence === 'custom' || !!visit.recurrenceRule;
    const { showAlert, showConfirm } = useModal();

    const [date, setDate] = useState(visit.date);
    const [patientName, setPatientName] = useState(visit.patientName);
    const [address, setAddress] = useState(visit.address || '');
    const [staffIds, setStaffIds] = useState<string[]>(visit.staffIds);
    const [startTime, setStartTime] = useState(visit.startTime);
    const [endTime, setEndTime] = useState(visit.endTime);
    const [recurrence, setRecurrence] = useState<'none' | 'custom'>(visit.recurrence);
    const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | undefined>(visit.recurrenceRule);

    const [notes, setNotes] = useState(visit.notes);
    const [status, setStatus] = useState(visit.status);

    const [showScopeModal, setShowScopeModal] = useState<'update' | 'delete' | null>(null);
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const weekDayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const weekNoLabels = [
        { val: 1, label: '第1' },
        { val: 2, label: '第2' },
        { val: 3, label: '第3' },
        { val: 4, label: '第4' },
        { val: 5, label: '最終' },
    ];

    useEffect(() => {
        setDate(visit.date);
        setPatientName(visit.patientName);
        setAddress(visit.address || '');
        setStaffIds(visit.staffIds);
        setStartTime(visit.startTime);
        setEndTime(visit.endTime);
        setRecurrence(visit.recurrence);
        setRecurrenceRule(visit.recurrenceRule);
        setNotes(visit.notes);
        setStatus(visit.status);
    }, [visit]);

    // Click outside to close staff dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsStaffDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync recurrence weekday if date changes for simple weekly recurrence
    useEffect(() => {
        if (recurrence === 'custom' && recurrenceRule?.frequency === 'weekly' && recurrenceRule.weekDays.length === 1) {
            const [y, m, d] = date.split('-').map(Number);
            const currentDayIndex = new Date(y, m - 1, d).getDay();

            if (recurrenceRule.weekDays[0] !== currentDayIndex) {
                setRecurrenceRule({
                    ...recurrenceRule,
                    weekDays: [currentDayIndex]
                });
            }
        }
    }, [date, recurrence, recurrenceRule]);

    // Check for unsaved changes
    const hasChanges = () => {
        // For new visits, only check if meaningful data is entered
        if (isNew) {
            return (
                patientName.trim() !== '' ||
                address.trim() !== '' ||
                notes.trim() !== '' ||
                staffIds.length > 0 ||
                date !== new Date().toISOString().split('T')[0] ||
                (startTime !== '09:00' || endTime !== '10:00') ||
                status !== 'REGULAR_NURSE'
            );
        }

        // For existing visits, check all changes
        if (
            date !== visit.date ||
            startTime !== visit.startTime ||
            endTime !== visit.endTime ||
            patientName !== visit.patientName ||
            address !== (visit.address || '') ||
            status !== visit.status ||
            notes !== (visit.notes || '') ||
            recurrence !== visit.recurrence
        ) return true;

        const currentStaffIds = [...staffIds].sort();
        const originalStaffIds = [...visit.staffIds].sort();
        if (currentStaffIds.length !== originalStaffIds.length) return true;
        if (currentStaffIds.some((id, i) => id !== originalStaffIds[i])) return true;

        if (recurrence === 'custom') {
            return JSON.stringify(recurrenceRule) !== JSON.stringify(visit.recurrenceRule);
        }

        return false;
    };

    const handleCloseAttempt = () => {
        if (hasChanges()) {
            setShowUnsavedConfirm(true);
        } else {
            onClose();
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        
        if (!date || !startTime || !endTime) {
            await showAlert('日付と時間は必須です', 'error');
            return;
        }

        if (staffIds.length === 0) {
            await showAlert('担当スタッフを選択してください', 'error');
            return;
        }

        // Check if this is an independent schedule (was recurring but now set to none)
        const wasRecurring = visit.recurrence === 'custom' || !!visit.recurrenceRule;
        const isNowIndependent = recurrence === 'none' && wasRecurring;

        // If editing an existing recurring schedule that's still recurring, show scope modal
        if (!isNew && isRecurring && !isNowIndependent) {
            setShowScopeModal('update');
        } else {
            await executeSave('this');
        }
    };

    const executeSave = async (scope: RecurrenceScope) => {
        if (isSaving) return; // Prevent double submission
        setIsSaving(true);

        const updatedVisit: VisitWithStaff = {
            ...visit,
            date,
            patientName,
            address,
            staffIds,
            startTime,
            endTime,
            recurrence,
            recurrenceRule: recurrence === 'custom' ? recurrenceRule : undefined,
            notes,
            status,
        };

        // Close modal immediately for responsive UI — API call continues in background
        onClose();

        try {
            // Pass the occurrence's original date (before this edit) so scope="this"
            // edits that move a recurring occurrence to a different date can exclude
            // the original date instead of leaving a duplicate behind.
            await onUpdate(updatedVisit, scope, visit.date);
        } catch (err) {
            console.error('Failed to save:', err);
        }
    };

    const handleDelete = async () => {
        if (!isNew && isRecurring) {
            setShowScopeModal('delete');
        } else {
            const confirmed = await showConfirm('この予定を削除しますか？');
            if (confirmed) {
                onDelete(visit.id, 'this', visit.date);
                onClose();
            }
        }
    };

    const executeDelete = (scope: RecurrenceScope) => {
        onDelete(visit.id, scope, visit.date);
        onClose();
    };

    const toggleStaff = (id: string) => {
        if (isReadOnly) return;
        setStaffIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const openGoogleMaps = () => {
        if (!address) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const selectedStaffNames = staffList
        .filter(s => staffIds.includes(s.id))
        .map(s => s.name)
        .join(', ');

    const getStatusColor = (statusId: string) => {
        const s = statuses.find(s => s.status_id === statusId);
        return s ? s.color : 'gray';
    };

    const getRecurrenceMode = () => {
        if (recurrence === 'none') return 'none';
        if (recurrence === 'custom' && recurrenceRule) {
            // Biweekly is stored as weekly with interval 2
            if (recurrenceRule.frequency === 'weekly' && recurrenceRule.interval === 2) return 'biweekly';
            return recurrenceRule.frequency;
        }
        return 'none';
    };

    const getDayOfWeekLabel = () => {
        if (!date) return '';
        const [y, m, d] = date.split('-').map(Number);
        const dayIndex = new Date(y, m - 1, d).getDay();
        return weekDayLabels[dayIndex];
    };

    const handleRecurrenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const mode = e.target.value;
        if (mode === 'none') {
            setRecurrence('none');
            setRecurrenceRule(undefined);
        } else {
            setRecurrence('custom');
            const [y, m, d] = date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay();
            const dayOfMonth = dateObj.getDate();
            const isBiweekly = mode === 'biweekly';
            const frequency = (isBiweekly ? 'weekly' : mode) as 'daily' | 'weekly' | 'monthly' | 'yearly';

            setRecurrenceRule({
                frequency,
                interval: isBiweekly ? 2 : 1,
                weekDays: frequency === 'weekly' ? [dayOfWeek] : [],
                endType: 'never',
                weekNos: [],
                // For monthly, default to "by date" mode
                dayOfMonth: mode === 'monthly' ? dayOfMonth : undefined
            });
        }
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStartTime = e.target.value;

        if (startTime && endTime && newStartTime) {
            const [oldH, oldM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            const [newH, newM] = newStartTime.split(':').map(Number);

            const oldStartMins = oldH * 60 + oldM;
            const oldEndMins = endH * 60 + endM;

            let duration = oldEndMins - oldStartMins;
            if (duration < 0) duration += 24 * 60;

            const newStartMins = newH * 60 + newM;
            const newEndMins = newStartMins + duration;

            let finalEndH = Math.floor(newEndMins / 60);
            const finalEndM = newEndMins % 60;

            if (finalEndH >= 24) finalEndH %= 24;

            const newEndTime = `${String(finalEndH).padStart(2, '0')}:${String(finalEndM).padStart(2, '0')}`;

            setEndTime(newEndTime);
        }

        setStartTime(newStartTime);
    };

    return (
        <div className="fixed inset-0 bg-white/30 z-[100] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">

                {/* Header */}
                <div className="p-4 md:p-5 border-b bg-gray-50 flex justify-between items-center rounded-t-none md:rounded-t-2xl shrink-0 safe-top">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {isNew ? <Sparkles className="w-5 h-5 text-indigo-500" /> : <FileText className="w-5 h-5 text-gray-600" />}
                        {isNew ? '新規訪問予定' : '訪問詳細'}
                    </h3>
                    <div className="flex items-center gap-1">
                        {!isReadOnly && onSpecialInstruction && (
                            <button
                                onClick={() => onSpecialInstruction({
                                    date, startTime, endTime, staffIds,
                                    patientName, visitAddress: address, statusId: status, memo: notes,
                                })}
                                className="px-2.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1"
                                title="特別指示期間の一括登録"
                            >
                                <ClipboardList className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">特指示</span>
                            </button>
                        )}
                        {!isNew && !isReadOnly && onDuplicate && (
                            <button
                                onClick={() => onDuplicate(visit)}
                                className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors hidden md:block"
                                title="複製"
                            >
                                <Copy className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={handleCloseAttempt} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">

                    {/* Date & Time Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">日付</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    disabled={isReadOnly}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">時間</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    disabled={isReadOnly}
                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
                                    value={startTime}
                                    onChange={handleStartTimeChange}
                                />
                                <span className="text-gray-400">～</span>
                                <input
                                    type="time"
                                    disabled={isReadOnly}
                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                            {!isReadOnly && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {[30, 40, 60, 90, 120].map(mins => {
                                        const currentDuration = (() => {
                                            if (!startTime || !endTime) return 0;
                                            const [sh, sm] = startTime.split(':').map(Number);
                                            const [eh, em] = endTime.split(':').map(Number);
                                            let diff = (eh * 60 + em) - (sh * 60 + sm);
                                            if (diff < 0) diff += 24 * 60;
                                            return diff;
                                        })();
                                        const isActive = currentDuration === mins;
                                        return (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => {
                                                    if (!startTime) return;
                                                    const [h, m] = startTime.split(':').map(Number);
                                                    const totalMins = h * 60 + m + mins;
                                                    const newH = Math.floor(totalMins / 60) % 24;
                                                    const newM = totalMins % 60;
                                                    setEndTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
                                                }}
                                                className={`px-2 py-1 text-xs rounded-md border transition-colors ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                            >
                                                {mins}分
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Patient & Address */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">患者名</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    disabled={isReadOnly}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
                                    placeholder="患者名を入力"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">場所 (住所)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        disabled={isReadOnly}
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
                                        placeholder="住所を入力"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                    />
                                </div>
                                {address && (
                                    <button
                                        onClick={openGoogleMaps}
                                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                                        title="Google Mapを開く"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Staff & Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                                担当スタッフ <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                disabled={isReadOnly}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-left flex items-center justify-between disabled:bg-gray-100 ${staffIds.length === 0 ? 'border-red-300 bg-red-50' : ''}`}
                                onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                            >
                                <span className={`block truncate ${staffIds.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {staffIds.length === 0 ? 'スタッフを選択' : selectedStaffNames}
                                </span>
                                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                            </button>

                            {isStaffDropdownOpen && !isReadOnly && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                    {staffList.map(staff => (
                                        <div
                                            key={staff.id}
                                            className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => toggleStaff(staff.id)}
                                        >
                                            <div className={`w-5 h-5 border rounded flex items-center justify-center mr-3 transition-colors ${staffIds.includes(staff.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                {staffIds.includes(staff.id) && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <div
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white mr-2"
                                                style={{ backgroundColor: getColorStyles(staff.color).bg }}
                                            >
                                                {staff.avatar}
                                            </div>
                                            <span className="text-sm text-gray-700">{staff.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ステータス</label>
                            <select
                                disabled={isReadOnly}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 cursor-pointer font-bold"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                style={{
                                    backgroundColor: getColorStyles(getStatusColor(status)).bgLight,
                                    color: getColorStyles(getStatusColor(status)).text,
                                    borderColor: getColorStyles(getStatusColor(status)).border
                                }}
                            >
                                {statuses.map(s => {
                                    const styles = getColorStyles(s.color);
                                    return (
                                        <option
                                            key={s.status_id}
                                            value={s.status_id}
                                            className="py-2 font-bold"
                                            style={{
                                                backgroundColor: styles.bgLight,
                                                color: styles.text
                                            }}
                                        >
                                            {s.name}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Recurrence */}
                    {isReadOnly && recurrence === 'custom' && recurrenceRule && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">繰り返し設定</label>
                            <div className="relative">
                                <Repeat className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <div className="w-full pl-9 pr-3 py-2 border rounded-lg bg-gray-100 text-gray-700 text-sm">
                                    {recurrenceRule.frequency === 'weekly' && `${recurrenceRule.interval === 2 ? '隔週' : '毎週'} (${weekDayLabels[recurrenceRule.weekDays?.[0]] || ''}曜日)`}
                                    {recurrenceRule.frequency === 'monthly' && '毎月'}
                                    {recurrenceRule.frequency === 'yearly' && '毎年'}
                                    {recurrenceRule.frequency === 'daily' && '毎日'}
                                </div>
                            </div>
                        </div>
                    )}
                    {!isReadOnly && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">繰り返し設定</label>
                            <div className="relative">
                                <Repeat className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <select
                                    disabled={isReadOnly}
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100 appearance-none cursor-pointer"
                                    value={getRecurrenceMode()}
                                    onChange={handleRecurrenceChange}
                                >
                                    <option value="none">しない</option>
                                    <option value="weekly">毎週{date ? ` (${getDayOfWeekLabel()}曜日)` : ''}</option>
                                    <option value="biweekly">隔週（2週間ごと）{date ? ` (${getDayOfWeekLabel()}曜日)` : ''}</option>
                                    <option value="monthly">毎月</option>
                                    <option value="yearly">毎年</option>
                                </select>
                            </div>

                            {/* Monthly Recurrence Details */}
                            {getRecurrenceMode() === 'monthly' && recurrenceRule && (
                                <div className="mt-2 ml-0 md:ml-9 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm animate-in fade-in slide-in-from-top-1">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="monthlyType"
                                                className="text-blue-600 focus:ring-blue-500"
                                                checked={(!recurrenceRule.weekNos || recurrenceRule.weekNos.length === 0)}
                                                onChange={() => {
                                                    const [y, m, d] = date.split('-').map(Number);
                                                    const dateObj = new Date(y, m - 1, d);
                                                    setRecurrenceRule({
                                                        ...recurrenceRule,
                                                        weekNos: [],
                                                        weekDays: [],
                                                        dayOfMonth: dateObj.getDate()
                                                    });
                                                }}
                                            />
                                            <span className="text-gray-700">日付で指定 ({new Date(date).getDate()}日)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="monthlyType"
                                                className="text-blue-600 focus:ring-blue-500"
                                                checked={!!(recurrenceRule.weekNos && recurrenceRule.weekNos.length > 0)}
                                                onChange={() => {
                                                    const [y, m, d] = date.split('-').map(Number);
                                                    const dateObj = new Date(y, m - 1, d);
                                                    const day = dateObj.getDate();
                                                    const nth = Math.floor((day - 1) / 7) + 1;
                                                    setRecurrenceRule({
                                                        ...recurrenceRule,
                                                        weekNos: [nth > 5 ? 5 : nth],
                                                        weekDays: [dateObj.getDay()],
                                                        dayOfMonth: undefined
                                                    });
                                                }}
                                            />
                                            <span className="text-gray-700">曜日で指定</span>
                                        </label>
                                    </div>

                                    {recurrenceRule.weekNos && recurrenceRule.weekNos.length > 0 && (
                                        <div className="space-y-3 pl-1">
                                            <div>
                                                <span className="text-xs font-bold text-gray-500 block mb-1">週 (複数選択可)</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {weekNoLabels.map(w => {
                                                        const isSelected = recurrenceRule.weekNos?.includes(w.val);
                                                        return (
                                                            <button
                                                                key={w.val}
                                                                onClick={() => {
                                                                    const current = recurrenceRule.weekNos || [];
                                                                    const newNos = current.includes(w.val)
                                                                        ? current.filter(n => n !== w.val)
                                                                        : [...current, w.val].sort();
                                                                    if (newNos.length === 0) return;
                                                                    setRecurrenceRule({ ...recurrenceRule, weekNos: newNos });
                                                                }}
                                                                className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {w.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-500 block mb-1">曜日</span>
                                                <div className="flex gap-1">
                                                    {weekDayLabels.map((label, idx) => {
                                                        const isSelected = recurrenceRule.weekDays.includes(idx);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setRecurrenceRule({ ...recurrenceRule, weekDays: [idx] });
                                                                }}
                                                                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">メモ</label>
                        <textarea
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white min-h-[100px] resize-none disabled:bg-gray-100"
                            placeholder="情報を入力..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    {/* {onAiQuery && !isReadOnly && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => onAiQuery({ patientName, address, date, staffIds })}
                                className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline"
                                title="AI提案を開く"
                            >
                                <Sparkles className="w-3 h-3" />
                                この条件でAI提案を使用
                            </button>
                        </div>
                    )} */}
                </div>

                {/* Footer */}
                <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-between items-center rounded-b-none md:rounded-b-2xl shrink-0 pb-safe fixed md:relative bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto shadow-lg md:shadow-none z-10">
                    <div className="flex gap-2">
                        {!isNew && !isReadOnly && (
                            <button
                                onClick={handleDelete}
                                className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors flex items-center gap-2 group"
                                title="削除"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span className="text-xs font-bold hidden md:inline group-hover:inline">削除</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCloseAttempt}
                            className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm font-bold"
                        >
                            {isReadOnly ? '閉じる' : 'キャンセル'}
                        </button>
                        {!isReadOnly && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md flex items-center gap-2 text-sm font-bold"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        保存中...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        保存
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Unsaved Changes Confirmation Overlay */}
                {showUnsavedConfirm && (
                    <div className="absolute inset-0 bg-white/60 z-[110] flex items-center justify-center p-4 rounded-none md:rounded-2xl backdrop-blur-[2px]">
                        <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-200 max-w-sm w-full animate-in zoom-in-95 ring-1 ring-gray-100">
                            <div className="flex items-center gap-3 mb-3 text-amber-600">
                                <AlertTriangle className="w-6 h-6" />
                                <h4 className="text-lg font-bold text-gray-800">未保存の変更があります</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                {isNew ? '入力内容' : '変更'}を保存せずに閉じますか？<br />入力した内容は失われます。
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowUnsavedConfirm(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={() => { setShowUnsavedConfirm(false); onClose(); }}
                                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-bold shadow-sm transition-colors"
                                >
                                    {isNew ? '入力を破棄' : '変更を破棄'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showScopeModal && (
                <RecurrenceScopeModal
                    mode={showScopeModal}
                    onSelect={(scope) => {
                        const mode = showScopeModal;
                        setShowScopeModal(null);
                        if (mode === 'update') executeSave(scope);
                        if (mode === 'delete') executeDelete(scope);
                    }}
                    onClose={() => setShowScopeModal(null)}
                />
            )}

        </div>
    );
};
