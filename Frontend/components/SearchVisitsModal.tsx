"use client";

import React, { useState, useMemo } from 'react';
import { VisitWithStaff, Staff, CompanySettings } from '@/lib/types';
import { X, Search, Calendar, User, Clock, MapPin, ArrowRight } from 'lucide-react';
import { checkVisitVisibility, toLocalISOString } from '@/lib/constants';
import { getColorStyles } from '@/lib/utils';

interface SearchVisitsModalProps {
    onClose: () => void;
    allVisits: VisitWithStaff[];
    staffList: Staff[];
    companySettings: CompanySettings;
    onSelectVisit: (visit: VisitWithStaff) => void;
}

export const SearchVisitsModal: React.FC<SearchVisitsModalProps> = ({
    onClose, allVisits, staffList, companySettings, onSelectVisit
}) => {
    // Default range: 1 month before to 3 months ahead
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setMonth(today.getMonth() - 1);
    const defaultEnd = new Date(today);
    defaultEnd.setMonth(today.getMonth() + 3);

    const [startDate, setStartDate] = useState(toLocalISOString(defaultStart));
    const [endDate, setEndDate] = useState(toLocalISOString(defaultEnd));
    const [searchQuery, setSearchQuery] = useState('');

    // Helper to remove all whitespace (half-width, full-width, tabs, etc.)
    const stripSpaces = (str: string) => str.replace(/\s+/g, '');

    // Auto-complete list for patient names
    // Only show suggestions when user has typed something
    const patientSuggestions = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const normalizedQuery = stripSpaces(searchQuery.toLowerCase());
        const names = new Set(
            allVisits
                .map(v => v.patientName)
                .filter(name => name && stripSpaces(name.toLowerCase()).includes(normalizedQuery))
        );
        return Array.from(names).sort();
    }, [allVisits, searchQuery]);

    // Generate Results
    const searchResults = useMemo(() => {
        if (!startDate || !endDate) return [];

        const results: VisitWithStaff[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Remove spaces from the query for matching
        const normalizedQuery = stripSpaces(searchQuery.toLowerCase());

        // Iterate through every day in the range to catch recurring instances
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const currentDateStr = toLocalISOString(d);

            allVisits.forEach(visit => {
                // 1. Check date visibility (Recurrence logic)
                if (checkVisitVisibility(visit, currentDateStr)) {

                    // 2. Check Text Match (if query exists)
                    if (normalizedQuery) {
                        const textData = [
                            visit.patientName || '',
                            visit.address || '',
                            visit.notes || '',
                            visit.status || '',
                            // Staff names
                            staffList.filter(s => visit.staffIds.includes(s.id)).map(s => s.name).join('')
                        ].join(''); // Join without spaces

                        // Normalize target text by removing spaces and converting to lowercase
                        if (!stripSpaces(textData.toLowerCase()).includes(normalizedQuery)) return;
                    }

                    // 3. Create Instance
                    results.push({
                        ...visit,
                        date: currentDateStr, // Important: Overwrite with the specific instance date
                        staffMembers: staffList.filter(s => visit.staffIds.includes(s.id))
                    });
                }
            });
        }

        // Sort by date then time
        return results.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });

    }, [allVisits, startDate, endDate, searchQuery, staffList]);

    const getStatusLabel = (key: string) => {
        return companySettings.visitStatuses.find(s => s.key === key)?.label || key;
    };

    const getStatusColor = (key: string) => {
        return companySettings.visitStatuses.find(s => s.key === key)?.color || 'gray';
    };

    return (
        <div className="fixed inset-0 bg-white/30 z-[100] flex justify-center items-center p-0 md:p-4 backdrop-blur-md">
            <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:max-w-4xl md:h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-3 md:p-5 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Search className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        スケジュール検索
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search Controls */}
                <div className="p-3 md:p-5 bg-white border-b border-gray-100 space-y-3 md:space-y-4 shrink-0">
                    {/* Text Search with Autocomplete */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                        <input
                            type="text"
                            list="patient-suggestions"
                            className="w-full pl-9 md:pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                            placeholder="患者名、住所、メモ、スタッフ名で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <datalist id="patient-suggestions">
                            {patientSuggestions.map(name => (
                                <option key={name} value={name} />
                            ))}
                        </datalist>
                    </div>

                    {/* Date Range */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 bg-gray-50 px-2 md:px-3 py-1.5 rounded-lg border w-full sm:w-auto">
                            <span className="text-gray-500 font-bold text-xs">期間:</span>
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none text-gray-700 font-medium cursor-pointer text-xs md:text-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-gray-400">～</span>
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none text-gray-700 font-medium cursor-pointer text-xs md:text-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="ml-auto text-xs font-bold text-gray-500">
                            {searchResults.length} 件 ヒット
                        </div>
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-2.5 md:p-4">
                    {searchResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Search className="w-10 h-10 md:w-12 md:h-12 mb-2 opacity-20" />
                            <p className="text-sm md:text-base">条件に一致する予定はありません</p>
                        </div>
                    ) : (
                        <div className="space-y-2 md:space-y-3">
                            {searchResults.map((visit, idx) => {
                                const dateObj = new Date(visit.date);
                                const dateLabel = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                                const color = getStatusColor(visit.status);

                                return (
                                    <div
                                        key={`${visit.id}_${visit.date}_${idx}`}
                                        onClick={() => {
                                            onSelectVisit(visit);
                                            onClose();
                                        }}
                                        className="bg-white p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                                    >
                                        <div className="flex flex-wrap justify-between items-start gap-1.5 mb-2">
                                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                                <div className="bg-gray-100 text-gray-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {dateLabel}
                                                </div>
                                                <div className="bg-gray-100 text-gray-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {visit.startTime} - {visit.endTime}
                                                </div>
                                            </div>
                                            <span
                                                className="px-2 py-0.5 rounded text-[10px] font-bold border shrink-0"
                                                style={{
                                                    backgroundColor: getColorStyles(color).bgLight,
                                                    color: getColorStyles(color).text,
                                                    borderColor: getColorStyles(color).borderLight
                                                }}
                                            >
                                                {getStatusLabel(visit.status)}
                                            </span>
                                        </div>

                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                                                    <User className="w-4 h-4 md:w-5 md:h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-gray-800 text-sm md:text-base truncate">{visit.patientName}</h4>
                                                    {visit.address && (
                                                        <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 mt-0.5">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">{visit.address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 md:gap-4 ml-10 md:ml-0">
                                                {/* Staff */}
                                                <div className="flex -space-x-2">
                                                    {visit.staffMembers && visit.staffMembers.map(s => (
                                                        <div
                                                            key={s.id}
                                                            className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] md:text-xs font-bold text-white"
                                                            style={{ backgroundColor: getColorStyles(s.color).bg }}
                                                            title={s.name}
                                                        >
                                                            {s.avatar}
                                                        </div>
                                                    ))}
                                                </div>
                                                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                        {visit.notes && (
                                            <div className="mt-2 md:mt-3 text-[10px] md:text-xs text-gray-500 bg-gray-50 p-1.5 md:p-2 rounded border border-gray-100 truncate">
                                                {visit.notes}
                                            </div>
                                        )}
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
