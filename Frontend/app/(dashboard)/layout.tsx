"use client";

import Image from 'next/image';
import { useApp } from '@/lib/context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Notebook, Users, Settings, LogOut, Menu, X, User, Download, Search, Sparkles } from 'lucide-react';
import { useState, Suspense } from 'react';

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${active ? 'bg-teal-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
  >
    {icon}
    <span className="block">{label}</span>
  </button>
);

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, isImpersonating, setImpersonating, isPollingActive } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'schedule';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect SUPER_ADMIN to admin page
  if (currentUser?.role === 'SUPER_ADMIN') {
    router.push('/admin');
    return null;
  }

  const handleLogout = () => {
    setCurrentUser(null);
    router.push('/login');
  };

  const handleBackToAdmin = () => {
    setImpersonating(null, false);
    router.push('/admin');
  };

  const setView = (newView: string) => {
    router.push(`/dashboard?view=${newView}`);
    setIsMobileMenuOpen(false);
  };

  const isActive = (viewName: string) => view === viewName;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden h-14 bg-slate-900 text-white flex items-center justify-between px-4 shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <Image src="/image.png" alt="Logo" width={32} height={32} className="object-contain" />
          </div>
          comorebi
          {isPollingActive && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="リアルタイム更新中" />
          )}
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300 hover:text-white rounded-lg active:bg-slate-800 cursor-pointer">
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

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-transform duration-300 ease-out shadow-2xl
        md:static md:translate-x-0 md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <Image src="/image.png" alt="Logo" width={32} height={32} className="object-contain" />
            </div>
            <span className="font-bold text-white text-lg">comorebi</span>
            {isPollingActive && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="リアルタイム更新中" />
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 cursor-pointer">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
          <NavButton active={isActive('schedule')} onClick={() => setView('schedule')} icon={<Calendar size={20} />} label="スケジュール" />
          <NavButton active={isActive('shifts')} onClick={() => setView('shifts')} icon={<Notebook size={20} />} label="シフト管理" />

          <div className="hidden md:block">
            <NavButton active={isActive('search')} onClick={() => setView('search')} icon={<Search size={20} />} label="検索" />
          </div>

          <div className="hidden md:block">
            <NavButton active={isActive('export')} onClick={() => setView('export')} icon={<Download size={20} />} label="データ出力" />
          </div>

          {/* Admin-only navigation items */}
          {(currentUser?.role === 'COMPANY_ADMIN') && (
            <>
              <div className="my-2 border-t border-slate-800 mx-4 opacity-50"></div>
              <NavButton active={isActive('users')} onClick={() => setView('users')} icon={<Users size={20} />} label="ユーザー管理" />
              <NavButton active={isActive('settings')} onClick={() => setView('settings')} icon={<Settings size={20} />} label="設定" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">          {/* Show "Back to Admin" button when impersonating */}
          {isImpersonating && (
            <button
              onClick={handleBackToAdmin}
              className="w-full mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-95 font-bold cursor-pointer"
            >
              <LogOut size={18} className="rotate-180" />
              <span>管理画面に戻る</span>
            </button>
          )}
          {/* {currentUser?.role !== 'user' && (
            <button
              onClick={() => setView('ai')}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-2 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-95 mb-4 group"
            >
              <Sparkles size={18} />
              <span className="font-bold">AI提案</span>
            </button>
          )} */}

          <div className="flex items-center gap-3 px-2 mb-4 overflow-hidden cursor-pointer"
            onClick={() => router.push('/profile')}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <User size={16} />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white truncate">{currentUser?.name}</div>
              <div className="text-xs text-slate-500 truncate">{currentUser?.companyName}</div>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <button onClick={handleLogout} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer" title="ログアウト">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
