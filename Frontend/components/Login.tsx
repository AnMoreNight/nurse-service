"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { AuthUser } from '@/lib/types';
import { authService } from '@/services/authService';
import { Lock, Mail, LogIn, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authService.login({ email, password });

      // Store auth data
      authService.storeAuth(response.access_token, response.user);

      // Convert to AuthUser format
      const authUser: AuthUser = {
        user_id: response.user.user_id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER',
        company_id: (response.user as any).company_id || null,
        companyName: (response.user as any).company_name || null,
      };

      onLogin(authUser);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'メールアドレスまたはパスワードが間違っています');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="bg-teal-600 p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-lg border border-white/10 p-2">
              <Image
                src="/image.png"
                alt="comorebi Logo"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              comorebi
            </h1>
            <p className="text-teal-100 text-sm">
              訪問看護スケジュール管理プラットフォーム
            </p>
          </div>

          {/* Background Pattern */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <svg width="100%" height="100%">
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">メールアドレス</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">パスワード</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100">
                <span className="block w-1.5 h-1.5 bg-red-600 rounded-full shrink-0"></span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-200 transition-all active:scale-95 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ログイン中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  ログイン
                </>
              )}
            </button>

            <div className="text-center mt-4">
              <a
                href="/forgot-password"
                className="text-sm text-teal-600 hover:text-teal-700 font-medium hover:underline"
              >
                パスワードをお忘れですか？
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
