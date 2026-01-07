"use client";

import React, { useState, useMemo } from 'react';
import {
    MOCK_VISITS, MOCK_STAFF, MOCK_SHIFTS, toLocalISOString, formatDateForCSV,
    getEffectiveShiftType, MOCK_COMPANIES, MOCK_DB_USERS, checkVisitVisibility
} from '@/lib/constants';
import {
    VisitWithStaff, Staff, RecurrenceScope, Visit, ShiftAssignment, ShiftType,
    AuthUser, UserAccount, ScheduleSuggestion, Company, CompanySettings
} from '@/lib/types';
import { Dashboard } from '@/components/Dashboard';
import { ShiftManager } from '@/components/ShiftManager';
import { VisitModal } from '@/components/VisitModal';
import { ExportModal } from '@/components/ExportModal';
import { StaffFormModal } from '@/components/StaffFormModal';
import { LegacyLogin } from '@/components/LegacyLogin';
import { SystemAdminDashboard } from '@/components/SystemAdminDashboard';
import { UserManagement } from '@/components/UserManagement';
import { ScheduleSuggestionModal } from '@/components/ScheduleSuggestionModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { CompanySettingsView } from '@/components/CompanySettings';
import { SearchVisitsModal } from '@/components/SearchVisitsModal';
import { Toast } from '@/components/Toast';
import {
    Calendar, Notebook, LogOut, X, AlertTriangle, Download,
    Sparkles, Search, Users, Key, Settings, User, Menu
} from 'lucide-react';

// NavButton Component
const NavButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-teal-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
    >
        {icon}
        <span className="block">{label}</span>
    </button>
);

export default function NurseApp() {
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [dbUsers, setDbUsers] = useState<UserAccount[]>(MOCK_DB_USERS);

    const [view, setView] = useState<'schedule' | 'shifts' | 'users' | 'settings'>('schedule');

    const [masterCompanies, setMasterCompanies] = useState<Company[]>(MOCK_COMPANIES);
    const [masterStaff, setMasterStaff] = useState<Staff[]>(MOCK_STAFF);
    const [masterVisits, setMasterVisits] = useState<Visit[]>(MOCK_VISITS);
    const [masterShifts, setMasterShifts] = useState<ShiftAssignment[]>(MOCK_SHIFTS);

    const [currentDate, setCurrentDate] = useState<string>(toLocalISOString(new Date()));
    const [selectedVisit, setSelectedVisit] = useState<VisitWithStaff | null>(null);

    const [staffFormState, setStaffFormState] = useState<{ isOpen: boolean, initialStaff?: Staff }>({ isOpen: false });
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [suggestionState, setSuggestionState] = useState<{
        isOpen: boolean;
        initialValues?: { patientName?: string; address?: string; date?: string; staffIds?: string[] };
    }>({ isOpen: false });

    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const [isSettingsDirty, setIsSettingsDirty] = useState(false);
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const companyId = currentUser?.companyId;
    const isReadOnly = useMemo(() => currentUser?.role === 'user', [currentUser]);

    const currentCompany = useMemo(() => {
        return masterCompanies.find(c => c.id === companyId);
    }, [masterCompanies, companyId]);

    const companySettings = currentCompany?.settings || MOCK_COMPANIES[0].settings;

    const staffList = useMemo(() => {
        if (!companyId) return [];
        return masterStaff.filter(s => s.companyId === companyId);
    }, [masterStaff, companyId]);

    const companyVisits = useMemo(() => {
        if (!companyId) return [];
        return masterVisits.filter(v => v.companyId === companyId);
    }, [masterVisits, companyId]);

    const companyShifts = useMemo(() => {
        if (!companyId) return [];
        return masterShifts.filter(s => s.companyId === companyId);
    }, [masterShifts, companyId]);

    const allVisits: VisitWithStaff[] = useMemo(() => {
        return companyVisits.map(visit => ({
            ...visit,
            staffMembers: staffList.filter(s => visit.staffIds.includes(s.id))
        }));
    }, [companyVisits, staffList]);

    const handleLogin = (user: AuthUser) => {
        setCurrentUser(user);
    };

    const executeWithUnsavedCheck = (action: () => void) => {
        if (view === 'settings' && isSettingsDirty) {
            setPendingAction(() => action);
            setShowUnsavedConfirm(true);
        } else {
            action();
        }
    };

    const handleLogout = () => executeWithUnsavedCheck(() => {
        setCurrentUser(null);
        setView('schedule');
        setIsSettingsDirty(false);
    });

    const handleImpersonateLogin = (targetCompanyId: string) => {
        const company = masterCompanies.find(c => c.id === targetCompanyId);
        if (company) {
            setCurrentUser({
                id: 'impersonated_admin',
                username: 'admin',
                name: '管理者(代理)',
                role: 'admin',
                companyId: company.id,
                companyName: company.name
            });
        }
    };

    const currentVisits = useMemo(() => {
        return allVisits
            .filter(v => checkVisitVisibility(v, currentDate))
            .map(v => ({ ...v, date: currentDate }));
    }, [allVisits, currentDate]);

    const monthlyStats = useMemo(() => {
        const stats: Record<string, number> = {};
        if (!currentDate) return stats;

        const currentD = new Date(currentDate);
        const year = currentD.getFullYear();
        const month = currentD.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const checkDate = new Date(year, month, day);
            const checkDateStr = toLocalISOString(checkDate);

            allVisits.forEach(visit => {
                if (checkVisitVisibility(visit, checkDateStr)) {
                    visit.staffIds.forEach(staffId => {
                        stats[staffId] = (stats[staffId] || 0) + 1;
                    });
                }
            });
        }
        return stats;
    }, [allVisits, currentDate]);

    const handlePrevDate = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 1);
        setCurrentDate(toLocalISOString(d));
    };

    const handleNextDate = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 1);
        setCurrentDate(toLocalISOString(d));
    };

    const handleToday = () => setCurrentDate(toLocalISOString(new Date()));

    const handleAddVisitSlot = (staffId: string, startTime: string) => {
        if (isReadOnly) return;
        const [h, m] = startTime.split(':').map(Number);
        const endH = h + 1;
        const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const newVisit: VisitWithStaff = {
            id: `new_${Date.now()}`,
            companyId: companyId!,
            staffIds: [staffId],
            patientName: '',
            date: currentDate,
            startTime,
            endTime,
            status: 'REGULAR_NURSE',
            recurrence: 'none',
            notes: '',
            staffMembers: staffList.filter(s => s.id === staffId)
        };
        setSelectedVisit(newVisit);
    };

    const handleUpdateVisit = (updated: VisitWithStaff, scope: RecurrenceScope = 'this') => {
        setMasterVisits(prev => {
            if (updated.id.startsWith('new_') || updated.id.startsWith('ai_') || updated.id.startsWith('dup_')) {
                const { staffMembers, ...visitData } = updated;
                const newId = `v_${Date.now()}`;
                return [...prev, { ...visitData, id: newId }];
            }

            const original = prev.find(v => v.id === updated.id);
            if (!original) return prev;

            const wasRecurring = original.recurrence === 'custom';
            const isNowRecurring = updated.recurrence === 'custom';

            if (!wasRecurring && isNowRecurring) {
                return prev.map(v => v.id === updated.id ? { ...updated, staffMembers: undefined } : v);
            }

            if (updated.recurrence === 'custom' && scope !== 'all') {
                if (scope === 'this') {
                    const updatedOriginal = {
                        ...original,
                        excludeDates: [...(original.excludeDates || []), updated.date]
                    };

                    const { staffMembers, ...visitData } = updated;
                    const exceptionVisit = {
                        ...visitData,
                        id: `exc_${Date.now()}`,
                        recurrence: 'none' as const,
                        recurrenceRule: undefined
                    };

                    return prev.map(v => v.id === updated.id ? updatedOriginal : v).concat(exceptionVisit);

                } else if (scope === 'following') {
                    const endDate = new Date(updated.date);
                    endDate.setDate(endDate.getDate() - 1);

                    const updatedOriginal = {
                        ...original,
                        recurrenceEndDate: toLocalISOString(endDate)
                    };

                    const { staffMembers, ...visitData } = updated;
                    const newSeries = {
                        ...visitData,
                        id: `ser_${Date.now()}`
                    };

                    return prev.map(v => v.id === updated.id ? updatedOriginal : v).concat(newSeries);
                }
            }

            return prev.map(v => v.id === updated.id ? { ...updated, staffMembers: undefined } : v);
        });
        setToastMessage('保存しました');
    };

    const handleDeleteVisit = (visitId: string, scope: RecurrenceScope = 'this') => {
        if (isReadOnly) return;
        setMasterVisits(prev => {
            const target = prev.find(v => v.id === visitId);
            if (!target) return prev;

            if (target.recurrence === 'custom' && scope !== 'all') {
                if (scope === 'this') {
                    return prev.map(v => v.id === visitId ? {
                        ...v,
                        excludeDates: [...(v.excludeDates || []), currentDate]
                    } : v);
                } else if (scope === 'following') {
                    const endDate = new Date(currentDate);
                    endDate.setDate(endDate.getDate() - 1);
                    return prev.map(v => v.id === visitId ? {
                        ...v,
                        recurrenceEndDate: toLocalISOString(endDate)
                    } : v);
                }
            }

            return prev.filter(v => v.id !== visitId);
        });
        setToastMessage('スケジュールを削除しました');
    };

    const handleDuplicateVisit = (visit: VisitWithStaff) => {
        if (isReadOnly) return;
        const dup: VisitWithStaff = {
            id: `dup_${Date.now()}`,
            companyId: visit.companyId,
            patientName: visit.patientName,
            address: visit.address,
            status: visit.status,
            notes: visit.notes,
            date: '',
            startTime: '',
            endTime: '',
            staffIds: [],
            staffMembers: [],
            recurrence: 'none',
            recurrenceRule: undefined,
            excludeDates: [],
            recurrenceEndDate: undefined
        };
        setSelectedVisit(dup);
        setToastMessage('複製しました');
    };

    const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const minutesToTime = (tm: number) => {
        let m = tm % 60; let h = Math.floor(tm / 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const calculateEndTime = (newStart: string, oldStart: string, oldEnd: string) => {
        const startMins = timeToMinutes(oldStart);
        const endMins = timeToMinutes(oldEnd);
        const duration = endMins - startMins;
        const newStartMins = timeToMinutes(newStart);
        return minutesToTime(newStartMins + duration);
    };

    const handleMoveVisit = (visitId: string, sourceStaffId: string, targetStaffId: string, newStartTime: string, scope: RecurrenceScope = 'this') => {
        if (isReadOnly) return;
        setMasterVisits(prev => {
            const targetVisit = prev.find(v => v.id === visitId);
            if (!targetVisit) return prev;

            const newEndTime = calculateEndTime(newStartTime, targetVisit.startTime, targetVisit.endTime);

            const updatedFields = {
                staffIds: targetVisit.staffIds.filter(id => id !== sourceStaffId).concat([targetStaffId]).filter((id, i, self) => self.indexOf(id) === i),
                startTime: newStartTime,
                endTime: newEndTime
            };

            if (targetVisit.recurrence === 'custom' && scope !== 'all') {
                if (scope === 'this') {
                    const updatedOriginal = {
                        ...targetVisit,
                        excludeDates: [...(targetVisit.excludeDates || []), currentDate]
                    };
                    const exception: Visit = {
                        ...targetVisit,
                        id: `exc_${Date.now()}`,
                        date: currentDate,
                        recurrence: 'none',
                        recurrenceRule: undefined,
                        ...updatedFields
                    };
                    return prev.map(v => v.id === visitId ? updatedOriginal : v).concat(exception);

                } else if (scope === 'following') {
                    const endDate = new Date(currentDate);
                    endDate.setDate(endDate.getDate() - 1);
                    const updatedOriginal = {
                        ...targetVisit,
                        recurrenceEndDate: toLocalISOString(endDate)
                    };
                    const newSeries: Visit = {
                        ...targetVisit,
                        id: `ser_${Date.now()}`,
                        date: currentDate,
                        ...updatedFields
                    };
                    return prev.map(v => v.id === visitId ? updatedOriginal : v).concat(newSeries);
                }
            }

            return prev.map(v => {
                if (v.id === visitId) {
                    return { ...v, ...updatedFields };
                }
                return v;
            });
        });
        setToastMessage('スケジュールを移動しました');
    };

    const handleUpdateShift = (staffId: string, date: string, type: ShiftType) => {
        if (isReadOnly) return;
        setMasterShifts(prev => {
            const night1Types = ['night1', 'night1_holiday'];
            const night2Types = ['night2', 'night2_holiday'];

            let conflictingTypes: string[] = [];
            if (night1Types.includes(type || '')) {
                conflictingTypes = night1Types;
            } else if (night2Types.includes(type || '')) {
                conflictingTypes = night2Types;
            }

            const filtered = prev.filter(s => {
                if (s.staffId === staffId && s.date === date) return false;
                if (conflictingTypes.length > 0) {
                    if (s.date === date && s.type && conflictingTypes.includes(s.type)) {
                        return false;
                    }
                }
                return true;
            });

            return [...filtered, {
                id: `sh_${Date.now()}`,
                companyId: companyId!,
                staffId,
                date,
                type
            }];
        });
    };

    const handleReorderStaff = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;

        const newStaffList = [...staffList];
        if (fromIndex < 0 || fromIndex >= newStaffList.length || toIndex < 0 || toIndex >= newStaffList.length) return;

        const [movedStaff] = newStaffList.splice(fromIndex, 1);
        newStaffList.splice(toIndex, 0, movedStaff);

        setMasterStaff(prev => {
            const otherStaff = prev.filter(s => s.companyId !== companyId);
            return [...otherStaff, ...newStaffList];
        });
    };

    const handleSaveStaff = (name: string, jobTitle: string, defaultHolidays: number[], joinedDate: string) => {
        if (staffFormState.initialStaff) {
            setMasterStaff(prev => prev.map(s => s.id === staffFormState.initialStaff!.id ? {
                ...s, name, jobTitle, defaultHolidayWeekDays: defaultHolidays, joinedDate
            } : s));
        } else {
            const newStaff: Staff = {
                id: `s_${Date.now()}`,
                companyId: companyId!,
                name,
                jobTitle,
                color: 'blue',
                avatar: name.slice(0, 2),
                joinedDate,
                defaultHolidayWeekDays: defaultHolidays
            };
            setMasterStaff(prev => [...prev, newStaff]);
        }
        setStaffFormState({ isOpen: false });
    };

    const handleDeleteStaff = (staffId: string) => {
        if (window.confirm('このスタッフを削除（退職処理）しますか？\n過去のデータは残りますが、本システム上では表示されなくなります。')) {
            setMasterStaff(prev => prev.map(s => s.id === staffId ? { ...s, leftDate: toLocalISOString(new Date()) } : s));
        }
    };

    const handleExport = (type: 'visits' | 'shifts', start: string, end: string) => {
        const BOM = '\uFEFF';
        let csvContent = '';

        if (type === 'visits') {
            csvContent = "日付,開始時間,終了時間,患者名,担当者,ステータス,メモ\n";

            const targetVisits = companyVisits
                .filter(v => v.date >= start && v.date <= end)
                .sort((a, b) => {
                    const dateDiff = a.date.localeCompare(b.date);
                    if (dateDiff !== 0) return dateDiff;
                    return a.startTime.localeCompare(b.startTime);
                });

            targetVisits.forEach(v => {
                const staffNames = staffList.filter(s => v.staffIds.includes(s.id)).map(s => s.name).join('/');
                const dateStr = formatDateForCSV(v.date);
                const statusLabel = companySettings.visitStatuses.find(s => s.key === v.status)?.label || v.status;
                const notes = (v.notes || '').replace(/\n/g, ' ');

                csvContent += `${dateStr},${v.startTime},${v.endTime},${v.patientName},${staffNames},${statusLabel},${notes}\n`;
            });
        } else {
            csvContent = "日付,スタッフ,シフトタイプ\n";

            const [sy, sm, sd] = start.split('-').map(Number);
            const [ey, em, ed] = end.split('-').map(Number);
            const curr = new Date(sy, sm - 1, sd);
            const last = new Date(ey, em - 1, ed);

            while (curr <= last) {
                const dateStr = toLocalISOString(curr);
                const dateFormatted = formatDateForCSV(dateStr);

                staffList.forEach(staff => {
                    const effectiveType = getEffectiveShiftType(staff, dateStr, companyShifts);

                    let typeLabel = '';
                    switch (effectiveType) {
                        case 'night1': typeLabel = '夜間待機1'; break;
                        case 'night2': typeLabel = '夜間待機2'; break;
                        case 'night1_holiday': typeLabel = '夜間待機1(休)'; break;
                        case 'night2_holiday': typeLabel = '夜間待機2(休)'; break;
                        case 'holiday': typeLabel = '公休'; break;
                        case 'work': typeLabel = '出勤'; break;
                        case 'none': typeLabel = '出勤'; break;
                        default: typeLabel = effectiveType || '';
                    }

                    csvContent += `${dateFormatted},${staff.name},${typeLabel}\n`;
                });

                curr.setDate(curr.getDate() + 1);
            }
        }

        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `export_${type}_${start}_${end}.csv`;
        link.click();
    };

    const handleApplySuggestion = (suggestion: ScheduleSuggestion, pName: string, addr: string) => {
        const newVisit: VisitWithStaff = {
            id: `ai_${Date.now()}`,
            companyId: companyId!,
            staffIds: [suggestion.staffId],
            patientName: pName,
            address: addr,
            date: suggestion.date,
            startTime: suggestion.startTime,
            endTime: suggestion.endTime,
            status: 'REGULAR_NURSE',
            recurrence: 'none',
            notes: 'AI提案により作成',
            staffMembers: staffList.filter(s => s.id === suggestion.staffId)
        };
        setSuggestionState({ isOpen: false });
        setSelectedVisit(newVisit);
    };

    const handleNavClick = (viewName: 'schedule' | 'shifts' | 'users' | 'settings') => executeWithUnsavedCheck(() => {
        setView(viewName);
        setIsMobileMenuOpen(false);
    });

    const handleExportClick = () => {
        setIsExportModalOpen(true);
        setIsMobileMenuOpen(false);
    };

    const handleSearchClick = () => {
        setIsSearchModalOpen(true);
        setIsMobileMenuOpen(false);
    };

    const handleConfirmNavigation = () => {
        if (pendingAction) pendingAction();
        setShowUnsavedConfirm(false);
        setIsSettingsDirty(false);
        setPendingAction(null);
    };

    // Render logic
    if (!currentUser) {
        return <LegacyLogin onLogin={handleLogin} dbUsers={dbUsers} />;
    }

    if (currentUser.role === 'system_admin') {
        return (
            <SystemAdminDashboard
                companies={masterCompanies}
                onAddCompany={(c) => setMasterCompanies([...masterCompanies, c])}
                onUpdateCompany={(c) => setMasterCompanies(masterCompanies.map(comp => comp.id === c.id ? c : comp))}
                onDeleteCompany={(id) => setMasterCompanies(masterCompanies.filter(c => c.id !== id))}
                onImpersonate={(c) => handleImpersonateLogin(c.id)}
                dbUsers={dbUsers}
                onAddDbUser={(u) => setDbUsers([...dbUsers, u])}
            />
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden flex-col md:flex-row">

            {/* Mobile Header */}
            <div className="md:hidden h-14 bg-slate-900 text-white flex items-center justify-between px-4 shrink-0 z-40 shadow-md">
                <div className="flex items-center gap-2 font-bold text-lg">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">N</div>
                    NurseAssist
                </div>
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300 hover:text-white rounded-lg active:bg-slate-800">
                    <Menu size={24} />
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-white/30 z-[55] md:hidden backdrop-blur-md transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
          fixed inset-y-0 left-0 z-[60] w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-transform duration-300 ease-out shadow-2xl
          md:static md:translate-x-0 md:shadow-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
                            N
                        </div>
                        <span className="font-bold text-white text-lg">NurseAssist</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
                    <NavButton active={view === 'schedule'} onClick={() => handleNavClick('schedule')} icon={<Calendar size={20} />} label="スケジュール" />
                    <NavButton active={view === 'shifts'} onClick={() => handleNavClick('shifts')} icon={<Notebook size={20} />} label="シフト管理" />

                    <div className="hidden md:block">
                        <NavButton active={false} onClick={handleSearchClick} icon={<Search size={20} />} label="検索" />
                    </div>

                    <div className="hidden md:block">
                        <NavButton active={false} onClick={handleExportClick} icon={<Download size={20} />} label="データ出力" />
                    </div>

                    {currentUser.role === 'admin' && (
                        <>
                            <div className="my-2 border-t border-slate-800 mx-4 opacity-50"></div>
                            <NavButton active={view === 'users'} onClick={() => handleNavClick('users')} icon={<Users size={20} />} label="ユーザー管理" />
                            <NavButton active={view === 'settings'} onClick={() => handleNavClick('settings')} icon={<Settings size={20} />} label="設定" />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    {!isReadOnly && (
                        <button
                            onClick={() => {
                                setSuggestionState({ isOpen: true });
                                setIsMobileMenuOpen(false);
                            }}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-2 md:py-2 md:px-4 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-95 mb-4 group"
                            title="AI提案"
                        >
                            <Sparkles size={18} />
                            <span className="font-bold">AI提案</span>
                        </button>
                    )}

                    <div className="flex items-center gap-3 px-2 mb-4 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <User size={16} />
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                            <div className="text-xs text-slate-500 truncate">{currentUser.companyName}</div>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-center">
                        <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="ログアウト">
                            <LogOut size={18} />
                        </button>
                        <button onClick={() => { setIsChangePasswordModalOpen(true); setIsMobileMenuOpen(false); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="パスワード変更">
                            <Key size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
                {view === 'schedule' && (
                    <>
                        <div className="flex-1 overflow-hidden p-2 md:p-4">
                            <Dashboard
                                visits={currentVisits}
                                staffList={staffList}
                                shifts={companyShifts}
                                currentDate={currentDate}
                                onSelectVisit={setSelectedVisit}
                                onMoveVisit={handleMoveVisit}
                                onAddVisitSlot={handleAddVisitSlot}
                                onPrevDate={handlePrevDate}
                                onNextDate={handleNextDate}
                                onToday={handleToday}
                                onDateSelect={(d) => setCurrentDate(d)}
                                onUpdateShift={handleUpdateShift}
                                onReorderStaff={handleReorderStaff}
                                monthlyStats={monthlyStats}
                                companySettings={companySettings}
                                isReadOnly={isReadOnly}
                            />
                        </div>
                    </>
                )}

                {view === 'shifts' && (
                    <div className="flex-1 overflow-hidden p-2 md:p-4">
                        <ShiftManager
                            staff={staffList}
                            shifts={companyShifts}
                            currentDate={currentDate}
                            companySettings={companySettings}
                            onUpdateShift={handleUpdateShift}
                            onOpenStaffForm={(s) => setStaffFormState({ isOpen: true, initialStaff: s })}
                            onDeleteStaff={handleDeleteStaff}
                            isReadOnly={isReadOnly}
                        />
                    </div>
                )}

                {view === 'users' && currentUser.role === 'admin' && (
                    <div className="flex-1 overflow-hidden p-2 md:p-4">
                        <UserManagement
                            companyId={companyId!}
                            users={dbUsers}
                            onAddUser={(u) => setDbUsers([...dbUsers, u])}
                            onUpdateUser={(u) => setDbUsers(dbUsers.map(user => user.id === u.id ? u : user))}
                            onDeleteUser={(id) => setDbUsers(dbUsers.filter(u => u.id !== id))}
                        />
                    </div>
                )}

                {view === 'settings' && currentUser.role === 'admin' && (
                    <div className="flex-1 overflow-hidden p-2 md:p-4">
                        <CompanySettingsView
                            settings={companySettings}
                            onSave={(newSettings) => {
                                setMasterCompanies(prev => prev.map(c => c.id === companyId ? { ...c, settings: newSettings } : c));
                                setToastMessage('保存しました');
                                setIsSettingsDirty(false);
                            }}
                            onDirtyChange={setIsSettingsDirty}
                        />
                    </div>
                )}
            </main>

            {/* Unsaved Changes Confirmation Overlay */}
            {showUnsavedConfirm && (
                <div className="fixed inset-0 bg-white/30 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-200 max-w-sm w-full animate-in zoom-in-95 ring-1 ring-gray-100">
                        <div className="flex items-center gap-3 mb-3 text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                            <h4 className="text-lg font-bold text-gray-800">変更が保存されていません</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            編集を中断しますか？<br />保存されていない変更はすべて破棄されます。
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowUnsavedConfirm(false);
                                    setPendingAction(null);
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleConfirmNavigation}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-bold shadow-sm transition-colors"
                            >
                                保存せず終了する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedVisit && (
                <VisitModal
                    visit={selectedVisit}
                    staffList={staffList}
                    companySettings={companySettings}
                    onClose={() => setSelectedVisit(null)}
                    onUpdate={handleUpdateVisit}
                    onDelete={handleDeleteVisit}
                    onDuplicate={handleDuplicateVisit}
                    onAiQuery={!isReadOnly ? (data) => {
                        setSelectedVisit(null);
                        setSuggestionState({
                            isOpen: true,
                            initialValues: { patientName: data.patientName, address: data.address, date: data.date, staffIds: data.staffIds }
                        });
                    } : undefined}
                    isReadOnly={isReadOnly}
                />
            )}

            {staffFormState.isOpen && (
                <StaffFormModal
                    isOpen={true}
                    onClose={() => setStaffFormState({ isOpen: false })}
                    onSave={handleSaveStaff}
                    initialStaff={staffFormState.initialStaff}
                    currentDate={currentDate}
                    jobTitles={companySettings.jobTitles}
                />
            )}

            {isExportModalOpen && (
                <ExportModal onClose={() => setIsExportModalOpen(false)} onExport={handleExport} />
            )}

            {isSearchModalOpen && (
                <SearchVisitsModal
                    onClose={() => setIsSearchModalOpen(false)}
                    allVisits={allVisits}
                    staffList={staffList}
                    companySettings={companySettings}
                    onSelectVisit={(visit) => {
                        setCurrentDate(visit.date);
                        setSelectedVisit(visit);
                    }}
                />
            )}

            {suggestionState.isOpen && (
                <ScheduleSuggestionModal
                    onClose={() => setSuggestionState({ isOpen: false })}
                    staffList={staffList}
                    allVisits={allVisits}
                    onApply={handleApplySuggestion}
                    initialValues={suggestionState.initialValues}
                />
            )}

            {isChangePasswordModalOpen && (
                <ChangePasswordModal
                    onClose={() => setIsChangePasswordModalOpen(false)}
                    onSave={(pw) => {
                        setDbUsers(dbUsers.map(u => u.id === currentUser.id ? { ...u, password: pw } : u));
                        setToastMessage('パスワードを変更しました');
                    }}
                />
            )}

            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
        </div>
    );
}
