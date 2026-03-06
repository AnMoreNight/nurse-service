"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services';
import { User, Lock, Save, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Toast } from './Toast';

interface ProfileData {
  user_id: string;
  login_id: string;
  name: string;
  role: string;
  company_id: string | null;
  profession: string | null;
  job_title: string | null;
  display_color: string | null;
  avatar_url: string | null;
  join_date: string | null;
  left_date: string | null;
  created_at: string | null;
}

export default function ProfilePageConnected() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await authService.getProfile() as ProfileData;
      setProfile(data);
      setName(data.name || '');
      setLoginId(data.login_id || '');
    } catch (error: any) {
      setToastMessage(error.message || 'プロフィールの読み込みに失敗しました');
      // Don't redirect, just show error
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setToastMessage('名前を入力してください');
      return;
    }
    
    if (!loginId.trim()) {
      setToastMessage('ログインIDを入力してください');
      return;
    }

    try {
      setSaving(true);
      await authService.updateProfile({ name, login_id: loginId });
      
      const currentUser = authService.getStoredUser();
      if (currentUser) {
        authService.setStoredUser({ ...currentUser, name, login_id: loginId });
      }
      
      setToastMessage('プロフィールを更新しました');
      await loadProfile();
    } catch (error: any) {
      setToastMessage(error.message || 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword) {
      setToastMessage('現在のパスワードを入力してください');
      return;
    }
    
    if (!newPassword) {
      setToastMessage('新しいパスワードを入力してください');
      return;
    }
    
    if (newPassword.length < 6) {
      setToastMessage('新しいパスワードは6文字以上にしてください');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setToastMessage('新しいパスワードが一致しません');
      return;
    }

    try {
      setSaving(true);
      await authService.changePassword({ current_password: currentPassword, new_password: newPassword });
      setToastMessage('パスワードを変更しました');
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setToastMessage(error.message || 'パスワードの変更に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-lg shadow-sm p-6 max-w-md">
          <p className="text-slate-900 font-medium mb-4">プロフィールの読み込みに失敗しました</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-4 md:py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-3 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ダッシュボードに戻る</span>
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">プロフィール設定</h1>
          <p className="text-xs md:text-sm text-slate-600 mt-1">アカウント情報を管理します</p>
        </div>

        <div className="grid gap-4 md:gap-6">
          {/* Profile Information Card */}
          <div className="bg-white rounded-lg md:rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900">基本情報</h2>
                <p className="text-xs text-slate-600">名前とログインIDを変更できます</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5">
                  名前
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 md:px-4 md:py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  placeholder="山田 太郎"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5">
                  ログインID
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 md:px-4 md:py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  placeholder="t.yamada.companyname"
                />
              </div>

              {profile && (
                <div className="grid grid-cols-2 gap-3 md:gap-4 pt-3 md:pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600">役割</p>
                    <p className="text-sm text-slate-900 font-medium mt-0.5">
                      {profile.role === 'SUPER_ADMIN' && 'システム管理者'}
                      {profile.role === 'COMPANY_ADMIN' && '事業所管理者'}
                      {profile.role === 'NORMAL_USER' && '一般ユーザー'}
                    </p>
                  </div>
                  {profile.profession && (
                    <div>
                      <p className="text-xs text-slate-600">職種</p>
                      <p className="text-sm text-slate-900 font-medium mt-0.5">{profile.profession}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : 'プロフィールを保存'}
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-lg md:rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900">パスワード変更</h2>
                <p className="text-xs text-slate-600">セキュリティのため定期的な変更を推奨します</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5">
                  現在のパスワード
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pr-10 md:px-4 md:py-2.5 md:pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    placeholder="現在のパスワードを入力"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5">
                  新しいパスワード
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pr-10 md:px-4 md:py-2.5 md:pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    placeholder="6文字以上"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5">
                  新しいパスワード（確認）
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pr-10 md:px-4 md:py-2.5 md:pr-12 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    placeholder="もう一度入力"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                {saving ? '変更中...' : 'パスワードを変更'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
