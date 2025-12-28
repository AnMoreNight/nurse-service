"use client";

import React, { useState } from 'react';
import { X, Save, Key, Lock } from 'lucide-react';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSave: (newPassword: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSave }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!newPassword) {
      setError('新しいパスワードを入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('確認用パスワードが一致しません');
      return;
    }
    onSave(newPassword);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white/30 z-[90] flex justify-center items-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-600" />
            パスワード変更
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="password"
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新しいパスワード"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード (確認)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="password"
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-bold">{error}</p>
          )}
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-md flex items-center gap-2 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            変更する
          </button>
        </div>
      </div>
    </div>
  );
};
