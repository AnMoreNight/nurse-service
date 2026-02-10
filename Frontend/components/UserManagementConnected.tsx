"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { userService, User, UserCreate, UserUpdate, PaginatedResponse } from '@/services';
import { Plus, Pencil, Trash2, X, Save, Mail, Users as UsersIcon } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

interface UserManagementConnectedProps {
  companyId: string;
}

export const UserManagementConnected: React.FC<UserManagementConnectedProps> = ({ companyId }) => {
  const { currentUser } = useApp();
  const { showAlert, showConfirm } = useModal();
  const [users, setUsers] = useState<User[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'NORMAL_USER' as 'COMPANY_ADMIN' | 'NORMAL_USER',
    display_color: '#3B82F6'
  });

  useEffect(() => {
    loadUsers(true);
  }, [companyId, currentPage, pageSize]);

  const loadUsers = async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true);
      else setRefreshing(true);

      const response = await userService.getAllUsers(
        companyId,
        currentPage,
        pageSize
      );

      if ('data' in response) {
        setUsers(response.data);
        setTotalUsers(response.total_count);
        setTotalPages(response.total_pages);
      } else {
        setUsers(response);
        setTotalUsers(response.length);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      await showAlert('ユーザーの読み込みに失敗しました', 'error');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role as any,
        display_color: user.display_color || '#3B82F6'
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'NORMAL_USER',
        display_color: '#3B82F6'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim() || !formData.email.trim()) {
        await showAlert('名前とメールアドレスは必須です', 'error');
        return;
      }

      setSaving(true);

      if (editingUser) {
        // Update existing user
        const updateData: UserUpdate = {
          name: formData.name,
          role: formData.role,
          display_color: formData.display_color || undefined,
        };
        await userService.update(editingUser.user_id, updateData);
      } else {
        // Create new user
        if (!formData.password) {
          await showAlert('新規ユーザーにはパスワードが必要です', 'error');
          return;
        }
        const createData: UserCreate = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          display_color: formData.display_color || undefined,
        };
        await userService.create(createData);
      }

      setIsModalOpen(false);
      await showAlert(editingUser ? 'ユーザーを更新しました' : 'ユーザーを追加しました', 'success');
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      await showAlert(error.message || '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const confirmed = await showConfirm('本当にこのユーザーを削除しますか？');
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      await userService.delete(userId);
      await showAlert('ユーザーを削除しました', 'success');
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      await showAlert(error.message || '削除に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'COMPANY_ADMIN') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">管理者</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">一般ユーザー</span>;
  };

  if (initialLoading) {
    return (
      <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">ユーザーを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
      {/* Subtle refresh overlay — keeps table visible */}
      {refreshing && (
        <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {/* Saving/Delete loading overlay */}
      {saving && (
        <div className="absolute inset-0 bg-white/70 z-30 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-700 font-medium">処理中...</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-purple-600" />
            ユーザー管理
          </h2>
          <p className="text-sm text-gray-500 mt-1">{totalUsers} 人</p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          ユーザー追加
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white border-b sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">名前</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">メール</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">職種</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">権限</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">状態</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.user_id} className="hover:bg-gray-50 group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: user.display_color || '#3B82F6' }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div className="font-bold text-gray-800">{user.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.job_title || '-'}</td>
                <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${user.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                    {user.is_active ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openModal(user)}
                      disabled={saving}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="編集"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.user_id)}
                      disabled={saving}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  ユーザーがいません。「ユーザー追加」ボタンから追加してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalUsers)} / {totalUsers}
            </span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">表示件数:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingUser ? 'ユーザー編集' : '新規ユーザー'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: 山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="例: yamada@example.com"
                    disabled={!!editingUser}
                  />
                </div>
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">※ メールアドレスは変更できません</p>
                )}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="パスワードを入力"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">権限</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                >
                  <option value="NORMAL_USER">一般ユーザー</option>
                  <option value="COMPANY_ADMIN">管理者</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">表示色</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.display_color}
                    onChange={(e) => setFormData({ ...formData, display_color: e.target.value })}
                    className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">{formData.display_color}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
