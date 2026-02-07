"use client";

import React, { useState, useRef, useEffect } from 'react';
import { VisitWithStaff, Staff, ShiftAssignment, ShiftType, CompanySettings, RecurrenceScope } from '@/lib/types';
import { Repeat, ChevronLeft, ChevronRight, ChevronDown, Moon, GripVertical, Notebook } from 'lucide-react';
import { MiniCalendar } from './MiniCalendar';
import { RecurrenceScopeModal } from './RecurrenceScopeModal';
import { getEffectiveShiftType } from '@/lib/constants';

interface DashboardProps {
    visits: VisitWithStaff[];
    staffList: Staff[];
    shifts?: ShiftAssignment[];
    currentDate: string;
    onSelectVisit: (visit: VisitWithStaff) => void;
    onMoveVisit: (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope?: RecurrenceScope) => void;
    onAddVisitSlot: (staffId: string, startTime: string) => void;
    onPrevDate: () => void;
    onNextDate: () => void;
    onToday: () => void;
    onDateSelect?: (date: string) => void;
    onUpdateShift: (staffId: string, date: string, type: ShiftType) => void;
    onReorderStaff: (fromIndex: number, toIndex: number) => void;
    monthlyStats: Record<string, number>;
    companySettings: CompanySettings;
    isReadOnly?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_HEIGHT = 50;
const MINUTE_HEIGHT = SLOT_HEIGHT / 60;

const getColorValue = (color: string) => {
    // If it's already a hex color, return it directly
    if (color && color.startsWith('#')) {
        return color;
    }
    const colorMap: Record<string, string> = {
        'blue': '#3b82f6',
        'red': '#ef4444',
        'green': '#10b981',
        'yellow': '#f59e0b',
        'purple': '#a855f7',
        'pink': '#ec4899',
        'indigo': '#6366f1',
        'teal': '#14b8a6',
        'orange': '#f97316',
        'cyan': '#06b6d4',
    };
    return colorMap[color] || colorMap['blue'];
};

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const minutesToTime = (totalMinutes: number) => {
    const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const Dashboard: React.FC<DashboardProps> = ({
    visits, staffList, shifts = [], currentDate, onSelectVisit, onMoveVisit, onAddVisitSlot,
    onPrevDate, onNextDate, onToday, onDateSelect, onUpdateShift, onReorderStaff, monthlyStats, companySettings, isReadOnly = false
}) => {
    const [dragState, setDragState] = useState<{ id: string, sourceStaffId: string, clickOffsetY?: number, visit?: VisitWithStaff } | null>(null);
    const [dropPreview, setDropPreview] = useState<{ staffId: string; time: string; top: number; } | null>(null);
    const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState(new Date());

    const [moveRequest, setMoveRequest] = useState<{
        visitId: string;
        sourceStaffId: string;
        targetStaffId: string;
        newStartTime: string;
    } | null>(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTimeTop = currentMinutes * MINUTE_HEIGHT;

    const [y, m, d] = currentDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const isToday = new Date().toDateString() === dateObj.toDateString();
    const dateDisplay = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        };
        if (isCalendarOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCalendarOpen]);

    const getPosition = (time: string) => timeToMinutes(time) * MINUTE_HEIGHT;
    const getHeight = (start: string, end: string) => {
        let diffMinutes = timeToMinutes(end) - timeToMinutes(start);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        return diffMinutes * MINUTE_HEIGHT;
    };

    const handleDragStart = (e: React.DragEvent, visit: VisitWithStaff, sourceStaffId: string) => {
        if (isReadOnly) return;
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', visit.id);
        e.dataTransfer.setData('type', 'visit');
        e.dataTransfer.effectAllowed = 'move';
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickOffsetY = e.clientY - rect.top;
        setDragState({ id: visit.id, sourceStaffId, clickOffsetY, visit });
        setDropPreview(null);
    };

    const handleDragEnd = () => {
        setDragState(null);
        setDropPreview(null);
    };

    const handleDragOverWithTime = (e: React.DragEvent, targetStaffId: string) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!dragState || !dragState.visit) return;
        
        // Calculate time based on cursor position
        const containerId = `staff-container-${targetStaffId}`;
        const container = document.getElementById(containerId);
        if (!container) return;
        const rect = container.getBoundingClientRect();
        let offsetY = e.clientY - rect.top + (container.scrollTop || 0);
        if (dragState.clickOffsetY) offsetY -= dragState.clickOffsetY;
        
        // Calculate time from position (snap to 15-min intervals)
        const minutes = Math.floor((offsetY / SLOT_HEIGHT) * 60);
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const clampedMinutes = Math.max(0, Math.min(roundedMinutes, 23 * 60 + 45));
        const hour = Math.floor(clampedMinutes / 60);
        const min = clampedMinutes % 60;
        const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const topPosition = (clampedMinutes / 60) * SLOT_HEIGHT;
        
        setDropPreview({ staffId: targetStaffId, time: timeString, top: topPosition });
    };

    const handleContainerDrop = (e: React.DragEvent, targetStaffId: string) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer.getData('type');
        if (type !== 'visit') return;

        // Process the move with the time from preview (or calculate from event)
        if (dragState && dragState.visit) {
            const visitId = dragState.id;
            
            // Use preview time if available, otherwise calculate from drop position
            let newTime = dropPreview?.time;
            if (!newTime) {
                const containerId = `staff-container-${targetStaffId}`;
                const container = document.getElementById(containerId);
                if (container) {
                    const rect = container.getBoundingClientRect();
                    let offsetY = e.clientY - rect.top + (container.scrollTop || 0);
                    if (dragState.clickOffsetY) offsetY -= dragState.clickOffsetY;
                    const minutes = Math.floor((offsetY / SLOT_HEIGHT) * 60);
                    const roundedMinutes = Math.round(minutes / 15) * 15;
                    const clampedMinutes = Math.max(0, Math.min(roundedMinutes, 23 * 60 + 45));
                    const hour = Math.floor(clampedMinutes / 60);
                    const min = clampedMinutes % 60;
                    newTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                } else {
                    newTime = dragState.visit.startTime; // Fallback to original time
                }
            }
            
            if (dragState.visit.recurrence === 'custom' || dragState.visit.recurrenceRule) {
                setMoveRequest({
                    visitId,
                    sourceStaffId: dragState.sourceStaffId,
                    targetStaffId,
                    newStartTime: newTime
                });
            } else {
                onMoveVisit(visitId, dragState.sourceStaffId, targetStaffId, newTime);
            }
        }
        setDragState(null);
        setDropPreview(null);
    };

    const handleColumnDragStart = (e: React.DragEvent, index: number) => {
        if (isReadOnly) return;
        e.dataTransfer.setData('col-index', index.toString());
        e.dataTransfer.setData('type', 'column');
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleColumnDragOver = (e: React.DragEvent, index: number) => {
        if (isReadOnly) return;
        e.preventDefault();
        setDragOverColumnIndex(index);
    };

    const handleColumnDragLeave = (e: React.DragEvent) => {
        if (isReadOnly) return;
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverColumnIndex(null);
    };

    const handleColumnDrop = (e: React.DragEvent, dropIndex: number) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOverColumnIndex(null);
        const type = e.dataTransfer.getData('type');
        if (type !== 'column') return;
        const dragIndexStr = e.dataTransfer.getData('col-index');
        const dragIndex = parseInt(dragIndexStr);
        if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
            onReorderStaff(dragIndex, dropIndex);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            const el = document.getElementById('dashboard-scroll-container');
            if (el) el.scrollTop = 8 * SLOT_HEIGHT;
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    // Calculate side-by-side layout for overlapping visits
    // Returns a map from visit index to {left, width} for positioning
    const calculateVisualLayout = (staffVisits: VisitWithStaff[]) => {
        const layoutMap = new Map<number, { left: string, width: string }>();
        
        if (staffVisits.length === 0) return layoutMap;
        
        // For each visit, find how many visits it overlaps with
        const overlaps: number[][] = staffVisits.map(() => []);
        
        for (let i = 0; i < staffVisits.length; i++) {
            const a = staffVisits[i];
            const aStart = timeToMinutes(a.startTime);
            const aEnd = timeToMinutes(a.endTime);
            
            for (let j = i + 1; j < staffVisits.length; j++) {
                const b = staffVisits[j];
                const bStart = timeToMinutes(b.startTime);
                const bEnd = timeToMinutes(b.endTime);
                
                // Check if they overlap (not just touch)
                if (aStart < bEnd && bStart < aEnd) {
                    overlaps[i].push(j);
                    overlaps[j].push(i);
                }
            }
        }
        
        // Assign columns to each visit using greedy coloring
        const columns: number[] = new Array(staffVisits.length).fill(-1);
        
        // Sort indices by start time for consistent ordering
        const sortedIndices = staffVisits
            .map((_, idx) => idx)
            .sort((a, b) => {
                const diff = timeToMinutes(staffVisits[a].startTime) - timeToMinutes(staffVisits[b].startTime);
                if (diff !== 0) return diff;
                return timeToMinutes(staffVisits[b].endTime) - timeToMinutes(staffVisits[a].endTime);
            });
        
        for (const idx of sortedIndices) {
            // Find the smallest column not used by overlapping visits
            const usedColumns = new Set(overlaps[idx].map(j => columns[j]).filter(c => c >= 0));
            let col = 0;
            while (usedColumns.has(col)) col++;
            columns[idx] = col;
        }
        
        // For each visit, determine max columns needed among its overlap group
        for (let i = 0; i < staffVisits.length; i++) {
            // Get all visits in this overlap cluster (including self)
            const cluster = [i, ...overlaps[i]];
            const maxCol = Math.max(...cluster.map(j => columns[j])) + 1;
            const myCol = columns[i];
            
            layoutMap.set(i, {
                left: `${(myCol / maxCol) * 100}%`,
                width: `${(1 / maxCol) * 100}%`
            });
        }
        
        return layoutMap;
    };

    const getVisitStyles = (visit: VisitWithStaff, isHoliday: boolean) => {
        const config = companySettings.visitStatuses.find(s => s.key === visit.status);
        const colorMap: Record<string, { bg: string; border: string; text: string; hover: string }> = {
            blue: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900', hover: 'hover:bg-blue-200' },
            red: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900', hover: 'hover:bg-red-200' },
            green: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900', hover: 'hover:bg-green-200' },
            emerald: { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-900', hover: 'hover:bg-emerald-200' },
            yellow: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900', hover: 'hover:bg-yellow-200' },
            orange: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900', hover: 'hover:bg-orange-200' },
            purple: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-900', hover: 'hover:bg-purple-200' },
            pink: { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900', hover: 'hover:bg-pink-200' },
            gray: { bg: 'bg-gray-200', border: 'border-gray-400', text: 'text-gray-500', hover: 'hover:bg-gray-300' },
            indigo: { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-900', hover: 'hover:bg-indigo-200' },
            teal: { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900', hover: 'hover:bg-teal-200' },
            cyan: { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-900', hover: 'hover:bg-cyan-200' },
        };

        let colors = colorMap.blue;
        let extraClasses = '';
        let opacity = 'opacity-100 shadow-sm';

        if (config) {
            colors = colorMap[config.color] || colorMap.blue;
            if (visit.status === 'CANCELLED') {
                extraClasses = 'line-through';
                opacity = 'opacity-80';
            }
        }

        if (isHoliday) {
            opacity = 'opacity-90'; // Keep original color on days off, just slightly faded
        }

        const bgClass = `${colors.bg} ${colors.border} ${colors.text} ${colors.hover} ${extraClasses}`;
        return { bgClass, opacity };
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-none md:rounded-xl shadow-none md:shadow-sm border-0 md:border border-gray-200 overflow-hidden">
            <div className="p-2 md:p-4 border-b border-gray-200 flex flex-wrap md:flex-nowrap justify-between items-center bg-white sticky top-0 z-50 shrink-0 shadow-sm gap-2">
                <div className="flex items-center gap-2 md:gap-4 relative w-full md:w-auto">
                    <button onClick={onToday} className="px-2 py-1.5 md:px-3 border border-gray-300 rounded-md text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors text-gray-700">今日</button>
                    <div className="flex items-center gap-1">
                        <button onClick={onPrevDate} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={onNextDate} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="relative flex-1 md:flex-none" ref={calendarRef}>
                        <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors w-full md:w-auto">
                            <h2 className="text-sm md:text-xl font-bold text-gray-800 ml-1 whitespace-nowrap">{dateDisplay}</h2>
                            <ChevronDown className={`w-4 h-4 md:w-5 md:h-5 text-gray-500 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isCalendarOpen && (
                            <div className="absolute top-full left-0 mt-2 z-50">
                                <MiniCalendar currentDate={currentDate} onDateSelect={(d) => { if (onDateSelect) onDateSelect(d); }} onClose={() => setIsCalendarOpen(false)} />
                            </div>
                        )}
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-3 overflow-x-auto max-w-[50%]">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mr-4 whitespace-nowrap">
                        {companySettings.visitStatuses.map(status => {
                            const legendColorMap: Record<string, string> = {
                                blue: 'bg-blue-100 border-blue-500',
                                red: 'bg-red-100 border-red-500',
                                green: 'bg-green-100 border-green-500',
                                emerald: 'bg-emerald-100 border-emerald-500',
                                yellow: 'bg-yellow-100 border-yellow-500',
                                orange: 'bg-orange-100 border-orange-500',
                                purple: 'bg-purple-100 border-purple-500',
                                pink: 'bg-pink-100 border-pink-500',
                                gray: 'bg-gray-200 border-gray-400',
                                indigo: 'bg-indigo-100 border-indigo-500',
                                teal: 'bg-teal-100 border-teal-500',
                                cyan: 'bg-cyan-100 border-cyan-500',
                            };
                            const colorClass = legendColorMap[status.color] || legendColorMap.blue;
                            return (
                                <React.Fragment key={status.key}>
                                    <span className={`w-3 h-3 ${colorClass} border rounded-sm inline-block ml-2 first:ml-0`}></span>
                                    {status.label}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div id="dashboard-scroll-container" className="flex-1 overflow-auto relative overscroll-contain">
                <div className="flex min-w-max">
                    <div className="w-12 md:w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-30">
                        <div className="h-[90px] border-b border-gray-200 bg-gray-50"></div>
                        {HOURS.map(hour => (
                            <div key={hour} className="relative text-xs text-gray-500 text-center font-medium" style={{ height: SLOT_HEIGHT }}>
                                <span className="relative -top-2 bg-gray-50 px-1">{hour > 0 ? hour : ''}</span>
                            </div>
                        ))}
                        {isToday && <div className="absolute right-0 w-2 h-2 rounded-full bg-red-500 translate-x-1/2 z-40" style={{ top: `calc(${currentTimeTop}px + 90px)` }}></div>}
                    </div>

                    {staffList.map((staff, colIndex) => {
                        const effectiveType = getEffectiveShiftType(staff, currentDate, shifts);
                        const isHoliday = effectiveType === 'holiday' || effectiveType === 'night1_holiday' || effectiveType === 'night2_holiday';
                        // Filter visits for this staff AND current date only
                        const staffVisits = visits.filter(v => v.staffIds.includes(staff.id) && v.date === currentDate);
                        const layoutMap = calculateVisualLayout(staffVisits);
                        const visitCount = staffVisits.length;
                        const monthTotal = monthlyStats[staff.id] || 0;
                        const isDragOver = dragOverColumnIndex === colIndex;

                        return (
                            <div key={staff.id} className={`w-[200px] md:w-[220px] flex-shrink-0 border-r relative group ${isHoliday ? 'bg-gray-50' : 'bg-white'} ${isDragOver ? 'border-r-4 border-r-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                                <div
                                    className={`h-auto border-b border-gray-200 bg-white sticky top-0 z-20 flex flex-col justify-center px-3 py-3 gap-2 ${isHoliday ? 'bg-gray-50' : ''} ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                    draggable={!isReadOnly}
                                    onDragStart={(e) => handleColumnDragStart(e, colIndex)}
                                    onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                                    onDragLeave={handleColumnDragLeave}
                                    onDrop={(e) => handleColumnDrop(e, colIndex)}
                                >
                                    <div className="flex items-start justify-between w-full pointer-events-none gap-2">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                            {!isReadOnly && <GripVertical className="w-4 h-4 text-gray-300 shrink-0 mt-1" />}
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md shrink-0"
                                                style={{ backgroundColor: getColorValue(staff.color) }}
                                            >
                                                {staff.avatar}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="line-clamp-1 text-base font-bold text-gray-800" title={staff.name}>{staff.name}</span>
                                                <span className="truncate text-xs text-gray-500 mt-0.5">{staff.jobTitle || '\u00A0'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto mt-1">
                                            <div className="relative flex items-center justify-center">
                                                <select
                                                    disabled={isReadOnly}
                                                    className={`appearance-none w-7 h-7 rounded-md text-xs font-bold text-center border-2 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-400 transition-all ${isReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'} 
                                            ${effectiveType === 'night1' ? 'text-white shadow-sm' : ''} 
                                            ${effectiveType === 'night2' ? 'text-white shadow-sm' : ''} 
                                            ${effectiveType === 'night1_holiday' ? 'text-white ring-2 ring-gray-300 shadow-sm' : ''} 
                                            ${effectiveType === 'night2_holiday' ? 'text-white ring-2 ring-gray-300 shadow-sm' : ''} 
                                            ${effectiveType === 'holiday' ? 'text-white shadow-sm' : ''} 
                                            ${effectiveType === 'none' || effectiveType === 'work' ? 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50' : ''}`}
                                                    style={{
                                                        backgroundColor: effectiveType === 'night1' || effectiveType === 'night1_holiday' ? '#da5597' :
                                                                        effectiveType === 'night2' || effectiveType === 'night2_holiday' ? '#5383ec' :
                                                                        effectiveType === 'holiday' ? '#8f8f8f' : undefined,
                                                        borderColor: effectiveType === 'night1' || effectiveType === 'night1_holiday' ? '#c74485' :
                                                                    effectiveType === 'night2' || effectiveType === 'night2_holiday' ? '#4271d9' :
                                                                    effectiveType === 'holiday' ? '#7a7a7a' : undefined
                                                    }}
                                                    value={effectiveType === 'none' || effectiveType === null ? 'work' : effectiveType}
                                                    onChange={(e) => { e.stopPropagation(); onUpdateShift(staff.id, currentDate, e.target.value as ShiftType); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <option value="work" style={{ backgroundColor: '#ffffff', color: '#4b5563' }}>-</option>
                                                    <option value="holiday" style={{ backgroundColor: '#8f8f8f', color: '#ffffff' }}>休</option>
                                                    <option value="night1" style={{ backgroundColor: '#da5597', color: '#ffffff' }}>1</option>
                                                    <option value="night2" style={{ backgroundColor: '#5383ec', color: '#ffffff' }}>2</option>
                                                    <option value="night1_holiday" style={{ backgroundColor: '#da5597', color: '#ffffff' }}>1(休)</option>
                                                    <option value="night2_holiday" style={{ backgroundColor: '#5383ec', color: '#ffffff' }}>2(休)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-start w-full pointer-events-none">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200" title="訪問件数 (日次 / 月次)">
                                            <Notebook className="w-3.5 h-3.5 text-gray-500" />
                                            <span className="font-medium">日:{visitCount} / 月:{monthTotal}</span>
                                        </div>
                                    </div>
                                </div>

                                {isHoliday && (
                                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-full shadow-md opacity-80 pointer-events-none whitespace-nowrap">
                                        {effectiveType === 'night1_holiday' ? '夜間1(休)' : effectiveType === 'night2_holiday' ? '夜間2(休)' : 'OFF'}
                                    </div>
                                )}

                                <div className="relative w-full h-full" id={`staff-container-${staff.id}`}>
                                    {isToday && <div className="absolute inset-x-0 border-t-2 border-red-500 z-30 pointer-events-none opacity-80" style={{ top: `${currentTimeTop}px` }}></div>}

                                    {dropPreview && dropPreview.staffId === staff.id && dragState?.visit && dropPreview.time && (
                                        (() => {
                                            const visit = dragState.visit;
                                            const { bgClass, opacity } = getVisitStyles(visit, isHoliday);
                                            const startMins = timeToMinutes(visit.startTime);
                                            const endMins = timeToMinutes(visit.endTime);
                                            let duration = endMins - startMins;
                                            if (duration < 0) duration += 24 * 60;
                                            const newStartMins = timeToMinutes(dropPreview.time);
                                            const newEndMins = newStartMins + duration;
                                            const height = duration * MINUTE_HEIGHT;
                                            const endTimeStr = minutesToTime(newEndMins);

                                            return (
                                                <div
                                                    className={`absolute rounded-lg border-l-4 p-2.5 text-xs overflow-hidden z-50 pointer-events-none shadow-lg ${bgClass} ${opacity}`}
                                                    style={{ top: dropPreview.top, height: `${Math.max(height, 30)}px`, left: '4px', width: 'calc(100% - 8px)' }}
                                                >
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="font-bold truncate text-sm leading-tight">{dropPreview.time} {visit.patientName}</span>
                                                        {visit.recurrence === 'custom' && <Repeat className="w-4 h-4 flex-shrink-0 text-gray-600" />}
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    )}

                                    {HOURS.map(hour => (
                                        <div
                                            key={hour}
                                            className={`border-b border-gray-100 relative w-full ${isReadOnly ? '' : 'hover:bg-blue-50/30 transition-colors cursor-pointer'}`}
                                            style={{ height: SLOT_HEIGHT }}
                                            onDragOver={(e) => handleDragOverWithTime(e, staff.id)}
                                            onDrop={(e) => handleContainerDrop(e, staff.id)}
                                            onClick={() => { if (!isReadOnly) onAddVisitSlot(staff.id, `${hour.toString().padStart(2, '0')}:00`); }}
                                        ></div>
                                    ))}

                                    {staffVisits.map((visit, visitIndex) => {
                                        const top = getPosition(visit.startTime);
                                        const height = getHeight(visit.startTime, visit.endTime);
                                        // Get layout for side-by-side display of overlapping schedules
                                        const layout = layoutMap.get(visitIndex) || { left: '0%', width: '100%' };
                                        const { bgClass, opacity } = getVisitStyles(visit, isHoliday);
                                        const isBeingDragged = dragState?.id === visit.id;
                                        const uniqueKey = `${visit.id}-${currentDate}-${staff.id}-${visitIndex}`;

                                        return (
                                            <div
                                                key={uniqueKey}
                                                draggable={!isReadOnly}
                                                onDragStart={(e) => handleDragStart(e, visit, staff.id)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => handleDragOverWithTime(e, staff.id)}
                                                onDrop={(e) => handleContainerDrop(e, staff.id)}
                                                onClick={(e) => { e.stopPropagation(); onSelectVisit(visit); }}
                                                className={`absolute rounded-lg border-l-4 p-2.5 text-xs transition-all select-none overflow-hidden z-10 ${bgClass} ${opacity} ${isBeingDragged ? 'opacity-0' : ''} ${isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${Math.max(height, 30)}px`,
                                                    left: `calc(${layout.left} + 2px)`,
                                                    width: `calc(${layout.width} - 4px)`
                                                }}
                                            >
                                                <div className="flex justify-between items-start gap-1 pointer-events-none">
                                                    <span className="font-bold truncate text-sm leading-snug">{visit.startTime} {visit.patientName}</span>
                                                    {visit.recurrence === 'custom' && <Repeat className="w-4 h-4 flex-shrink-0 text-gray-600" />}
                                                </div>
                                                {visit.staffMembers && visit.staffMembers.length > 1 && (
                                                    <div className="flex -space-x-1 mt-1 pointer-events-none">
                                                        {visit.staffMembers.map(s => (
                                                            <div key={s.id} className="w-5 h-5 rounded-full border border-white text-[9px] flex items-center justify-center text-white" style={{ backgroundColor: getColorValue(s.color) }}>{s.avatar}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {height > 35 && visit.notes && <div className="mt-1 text-[11px] opacity-80 truncate pointer-events-none">{visit.notes}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {moveRequest && (
                <RecurrenceScopeModal
                    mode="update"
                    onSelect={(scope) => {
                        onMoveVisit(moveRequest.visitId, moveRequest.sourceStaffId, moveRequest.targetStaffId, moveRequest.newStartTime, scope);
                        setMoveRequest(null);
                    }}
                    onClose={() => setMoveRequest(null)}
                />
            )}
        </div>
    );
};
