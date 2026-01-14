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

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const minutesToTime = (totalMinutes: number) => {
    let minutes = Math.round(totalMinutes);
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    if (h >= 24) h = h % 24;
    if (h < 0) h = 0;
    if (m < 0) m = 0;
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
        // Clear drag state and preview when drag ends (even without drop)
        setDragState(null);
        setDropPreview(null);
    };

    const handleDragOverWithTime = (e: React.DragEvent, targetStaffId: string) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!dragState) return;
        const containerId = `staff-container-${targetStaffId}`;
        const container = document.getElementById(containerId);
        if (!container) return;
        const rect = container.getBoundingClientRect();
        let offsetY = e.clientY - rect.top + (container.scrollTop || 0);
        if (dragState.clickOffsetY) offsetY -= dragState.clickOffsetY;
        const minutes = Math.floor((offsetY / SLOT_HEIGHT) * 60);
        const roundedMinutes = Math.round(minutes / 15) * 15;
        let finalHour = Math.floor(roundedMinutes / 60);
        let finalMinutes = roundedMinutes % 60;
        if (finalHour >= 24) finalHour = 0;
        if (finalHour < 0) finalHour = 0;
        if (finalMinutes < 0) finalMinutes = 0;
        const timeString = `${finalHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
        const topPosition = (roundedMinutes / 60) * SLOT_HEIGHT;
        setDropPreview({ staffId: targetStaffId, time: timeString, top: topPosition });
    };

    const handleContainerDrop = (e: React.DragEvent, targetStaffId: string) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer.getData('type');
        if (type !== 'visit') return;
        const visitId = e.dataTransfer.getData('text/plain');

        if (dragState && dragState.id === visitId && dropPreview && dropPreview.staffId === targetStaffId) {
            if (dragState.visit && dragState.visit.recurrence === 'custom') {
                setMoveRequest({
                    visitId,
                    sourceStaffId: dragState.sourceStaffId,
                    targetStaffId,
                    newStartTime: dropPreview.time
                });
            } else {
                onMoveVisit(visitId, dragState.sourceStaffId, targetStaffId, dropPreview.time);
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

    const calculateVisualLayout = (staffVisits: VisitWithStaff[]) => {
        const sorted = [...staffVisits].sort((a, b) => {
            const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            if (startDiff !== 0) return startDiff;
            return timeToMinutes(b.endTime) - timeToMinutes(a.endTime);
        });
        const lanes: VisitWithStaff[][] = [];
        sorted.forEach(visit => {
            let placed = false;
            for (const lane of lanes) {
                const lastInLane = lane[lane.length - 1];
                const visitStart = timeToMinutes(visit.startTime);
                const lastEnd = timeToMinutes(lastInLane.endTime);
                if (visitStart >= lastEnd) {
                    lane.push(visit);
                    placed = true;
                    break;
                }
            }
            if (!placed) lanes.push([visit]);
        });
        const layoutMap = new Map<string, { left: string, width: string }>();
        const totalLanes = lanes.length;
        lanes.forEach((lane, laneIndex) => {
            lane.forEach(visit => {
                layoutMap.set(visit.id, {
                    left: `${(laneIndex / totalLanes) * 100}%`,
                    width: `${(1 / totalLanes) * 100}%`
                });
            });
        });
        return layoutMap;
    };

    const getVisitStyles = (visit: VisitWithStaff, isHoliday: boolean) => {
        const config = companySettings.visitStatuses.find(s => s.key === visit.status);
        let bgClass = 'bg-blue-100 border-blue-500 text-blue-900 hover:bg-blue-200';
        let opacity = 'opacity-100 shadow-sm';

        if (config) {
            const color = config.color;
            if (visit.status === 'CANCELLED') {
                bgClass = `bg-${color}-200 border-${color}-400 text-${color}-500 line-through hover:bg-${color}-300`;
                opacity = 'opacity-80';
            } else {
                bgClass = `bg-${color}-100 border-${color}-500 text-${color}-900 hover:bg-${color}-200`;
            }
        }

        if (isHoliday) {
            opacity = 'opacity-50 grayscale';
        }
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
                        {companySettings.visitStatuses.map(status => (
                            <React.Fragment key={status.key}>
                                <span className={`w-3 h-3 bg-${status.color}-100 border border-${status.color}-500 rounded-sm inline-block ml-2 first:ml-0`}></span>
                                {status.label}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            <div id="dashboard-scroll-container" className="flex-1 overflow-auto relative overscroll-contain">
                <div className="flex min-w-max">
                    <div className="w-9 md:w-16 flex-shrink-0 border-r border-gray-100 bg-white sticky left-0 z-30">
                        <div className="h-[72px] md:h-[68px] border-b border-gray-100 bg-white"></div>
                        {HOURS.map(hour => (
                            <div key={hour} className="relative text-[10px] md:text-xs text-gray-400 text-center" style={{ height: SLOT_HEIGHT }}>
                                <span className="relative -top-2 bg-white px-1">{hour > 0 ? hour : ''}</span>
                            </div>
                        ))}
                        {isToday && <div className="absolute right-0 w-2 h-2 rounded-full bg-red-500 translate-x-1/2 z-40" style={{ top: `calc(${currentTimeTop}px + 72px)` }}></div>}
                    </div>

                    {staffList.map((staff, colIndex) => {
                        const effectiveType = getEffectiveShiftType(staff, currentDate, shifts);
                        const isHoliday = effectiveType === 'holiday' || effectiveType === 'night1_holiday' || effectiveType === 'night2_holiday';
                        const staffVisits = visits.filter(v => v.staffIds.includes(staff.id));
                        const layoutMap = calculateVisualLayout(staffVisits);
                        const visitCount = staffVisits.length;
                        const monthTotal = monthlyStats[staff.id] || 0;
                        const isDragOver = dragOverColumnIndex === colIndex;

                        return (
                            <div key={staff.id} className={`w-[30vw] min-w-[100px] md:w-[200px] flex-shrink-0 border-r relative group ${isHoliday ? 'bg-slate-50' : 'bg-white'} ${isDragOver ? 'border-r-4 border-r-blue-500 bg-blue-50' : 'border-gray-100'}`}>
                                <div
                                    className={`h-auto border-b border-gray-100 bg-white sticky top-0 z-20 flex flex-col justify-center px-1 md:px-2 py-2 gap-1 font-medium text-gray-700 shadow-sm ${isHoliday ? 'bg-slate-100' : ''} ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                    draggable={!isReadOnly}
                                    onDragStart={(e) => handleColumnDragStart(e, colIndex)}
                                    onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                                    onDragLeave={handleColumnDragLeave}
                                    onDrop={(e) => handleColumnDrop(e, colIndex)}
                                >
                                    <div className="flex items-center justify-between w-full pointer-events-none">
                                        <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                                            {!isReadOnly && <GripVertical className="w-3 h-3 md:w-4 md:h-4 text-gray-300 shrink-0" />}
                                            <div className={`w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-white bg-${staff.color}-500 shadow-sm shrink-0`}>
                                                {staff.avatar}
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="line-clamp-1 text-[10px] md:text-sm font-semibold" title={staff.name}>{staff.name}</span>
                                                <span className="truncate text-[8px] md:text-[10px] text-gray-400 h-3">{staff.jobTitle || '\u00A0'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                                            <div className="relative">
                                                <select
                                                    disabled={isReadOnly}
                                                    className={`appearance-none w-4 h-4 md:w-6 md:h-6 rounded-full text-[10px] font-bold text-center border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400 ${isReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'} 
                                            ${effectiveType === 'night1' ? 'bg-indigo-500 text-white border-indigo-600' : ''} 
                                            ${effectiveType === 'night2' ? 'bg-pink-500 text-white border-pink-600' : ''} 
                                            ${effectiveType === 'night1_holiday' ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-gray-300' : ''} 
                                            ${effectiveType === 'night2_holiday' ? 'bg-pink-500 text-white border-pink-600 ring-2 ring-gray-300' : ''} 
                                            ${effectiveType === 'holiday' ? 'bg-gray-500 text-white border-gray-600' : ''} 
                                            ${effectiveType === 'none' || effectiveType === 'work' ? 'bg-gray-100 text-gray-400 border-gray-300 hover:border-gray-400' : ''}`}
                                                    value={effectiveType === 'none' || effectiveType === null ? 'work' : effectiveType}
                                                    onChange={(e) => { e.stopPropagation(); onUpdateShift(staff.id, currentDate, e.target.value as ShiftType); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    <option value="work">出勤</option>
                                                    <option value="holiday">休</option>
                                                    <option value="night1">1</option>
                                                    <option value="night2">2</option>
                                                    <option value="night1_holiday">1(休)</option>
                                                    <option value="night2_holiday">2(休)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center mt-0.5 px-0.5 w-full pointer-events-none">
                                        <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-gray-500 font-bold" title="訪問件数 (日次 / 月次)">
                                            <Notebook className="w-3 h-3 text-gray-400" />
                                            <span>日:{visitCount} / 月:{monthTotal}</span>
                                        </div>
                                    </div>
                                </div>

                                {isHoliday && (
                                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 px-2 md:px-3 py-0.5 md:py-1 bg-gray-500 text-white text-[10px] md:text-xs font-bold rounded-full shadow opacity-80 pointer-events-none whitespace-nowrap">
                                        {effectiveType === 'night1_holiday' ? '夜間1(休)' : effectiveType === 'night2_holiday' ? '夜間2(休)' : 'OFF'}
                                    </div>
                                )}

                                <div className="relative w-full h-full" id={`staff-container-${staff.id}`}>
                                    {isToday && <div className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none opacity-80" style={{ top: `${currentTimeTop}px` }}></div>}

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
                                                    className={`absolute rounded-sm md:rounded-md border-l-3 md:border-l-4 p-1.5 md:p-2.5 text-xs overflow-hidden z-50 pointer-events-none shadow-lg ${bgClass} ${opacity}`}
                                                    style={{ top: dropPreview.top, height: `${Math.max(height, 30)}px`, left: '2px', width: 'calc(100% - 4px)' }}
                                                >
                                                    <div className="flex justify-between items-start gap-1">
                                                        <span className="font-bold truncate text-[11px] md:text-[13px] leading-tight">{dropPreview.time} - {endTimeStr} {visit.patientName}</span>
                                                        {visit.recurrence === 'custom' && <Repeat className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0 text-gray-600" />}
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    )}

                                    {HOURS.map(hour => (
                                        <div
                                            key={hour}
                                            className={`border-b border-gray-100 relative w-full ${isReadOnly ? '' : 'hover:bg-gray-50 transition-colors cursor-pointer'}`}
                                            style={{ height: SLOT_HEIGHT }}
                                            onDragOver={(e) => handleDragOverWithTime(e, staff.id)}
                                            onDrop={(e) => handleContainerDrop(e, staff.id)}
                                            onClick={() => { if (!isReadOnly) onAddVisitSlot(staff.id, `${hour.toString().padStart(2, '0')}:00`); }}
                                        ></div>
                                    ))}

                                    {staffVisits.map((visit, visitIndex) => {
                                        const top = getPosition(visit.startTime);
                                        const height = getHeight(visit.startTime, visit.endTime);
                                        const layout = layoutMap.get(visit.id) || { left: '0%', width: '100%' };
                                        const { bgClass, opacity } = getVisitStyles(visit, isHoliday);
                                        const isBeingDragged = dragState?.id === visit.id;
                                        // Create unique key with index to prevent duplicates
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
                                                className={`absolute rounded-sm md:rounded-md border-l-3 md:border-l-4 p-1.5 md:p-2.5 text-xs transition-all select-none overflow-hidden z-10 ${bgClass} ${opacity} ${isBeingDragged ? 'opacity-0' : ''} ${isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                                                style={{ top: `${top}px`, height: `${Math.max(height, 30)}px`, left: layout.left, width: `calc(${layout.width} - 2px)`, marginLeft: '1px' }}
                                            >
                                                <div className="flex justify-between items-start gap-1 pointer-events-none">
                                                    <span className="font-bold truncate text-[11px] md:text-[13px] leading-snug">{visit.startTime} {visit.patientName}</span>
                                                    {visit.recurrence === 'custom' && <Repeat className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 text-gray-600" />}
                                                </div>
                                                {visit.staffMembers && visit.staffMembers.length > 1 && (
                                                    <div className="flex -space-x-1 mt-1 pointer-events-none">
                                                        {visit.staffMembers.map(s => (
                                                            <div key={s.id} className={`w-4 h-4 md:w-5 md:h-5 rounded-full border border-white text-[8px] md:text-[9px] flex items-center justify-center text-white bg-${s.color}-500`}>{s.avatar}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {height > 35 && visit.notes && <div className="mt-1 text-[10px] md:text-[11px] opacity-80 truncate pointer-events-none">{visit.notes}</div>}
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
