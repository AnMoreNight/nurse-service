"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useApp } from '@/lib/context';
import { companyService, userService, Company, User, UserCreate, UserUpdate, UserCreateByAdmin } from '@/services';
import {
  Building2, Users, Plus, Pencil, Trash2, X, Save,
  Mail, Phone, MapPin, UserPlus, Shield, LogOut, Key, Eye, EyeOff
} from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useApp();
  const { showAlert, showConfirm } = useModal();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'companies' | 'users'>('companies');

  // Company modal state
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    create_admin: false,
    admin_email: '',
    admin_password: '',
    admin_name: ''
  });

  // Company admin management modal
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyAdmins, setCompanyAdmins] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // User modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'COMPANY_ADMIN' as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER',
    company_id: '',
    profession: '',
    job_title: ''
  });

  // Redirect non-super-admins
  useEffect(() => {
    if (!isLoading && currentUser) {
      if (currentUser.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
      }
    } else if (!isLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, isLoading, router]);

  useEffect(() => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      loadData();
    }
  }, [currentUser?.user_id]);

  const loadCompanies = async () => {
    if (companies.length > 0) return; // Already loaded
    try {
      setLoading(true);
      const companiesData = await companyService.getAll();
      setCompanies(companiesData);
    } catch (error) {
      console.error('Failed to load companies:', error);
      await showAlert('会社データの読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (users.length > 0) return; // Already loaded
    try {
      setLoading(true);
      const usersData = await userService.getAll();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
      await showAlert('ユーザーデータの読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, usersData] = await Promise.all([
        companyService.getAll(),
        userService.getAll()
      ]);
      setCompanies(companiesData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
      // Don't show error alert if user is not authenticated (e.g., during logout)
      const token = localStorage.getItem('token');
      if (token) {
        await showAlert('データの読み込みに失敗しました', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Company handlers
  const openCompanyModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setCompanyForm({
        name: company.name,
        create_admin: false,
        admin_email: '',
        admin_password: '',
        admin_name: ''
      });
    } else {
      setEditingCompany(null);
      setCompanyForm({
        name: '',
        create_admin: false,
        admin_email: '',
        admin_password: '',
        admin_name: ''
      });
    }
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async () => {
    try {
      if (!companyForm.name.trim()) {
        await showAlert('会社名は必須です', 'error');
        return;
      }

      setSaving(true);

      if (editingCompany) {
        await companyService.update(editingCompany.company_id, {
          name: companyForm.name,
        });
      } else {
        // Create company
        const newCompany = await companyService.create({
          name: companyForm.name,
        });

        // Create admin user for this company if requested
        if (companyForm.create_admin) {
          if (!companyForm.admin_email || !companyForm.admin_password || !companyForm.admin_name) {
            await showAlert('管理者を作成する場合は、名前、メール、パスワードが必要です', 'error');
            return;
          }

          // Use admin endpoint with company_id
          await userService.createByAdmin({
            company_id: newCompany.company_id,
            email: companyForm.admin_email,
            password: companyForm.admin_password,
            name: companyForm.admin_name,
            role: 'COMPANY_ADMIN',
          });
        }
      }

      await loadData();
      setIsCompanyModalOpen(false);
      await showAlert(editingCompany ? '会社を更新しました' : '会社を作成しました', 'success');
    } catch (error: any) {
      console.error('Failed to save company:', error);
      await showAlert(error.message || '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    const confirmed = await showConfirm('本当にこの会社を削除しますか？関連するすべてのデータが削除されます。');
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      await companyService.delete(companyId);
      await loadData();
      await showAlert('会社を削除しました', 'success');
    } catch (error: any) {
      console.error('Failed to delete company:', error);
      await showAlert(error.message || '削除に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  // User handlers
  const openUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role as any,
        company_id: user.company_id || '',
        profession: user.profession || '',
        job_title: user.job_title || ''
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'COMPANY_ADMIN',
        company_id: companies[0]?.company_id || '',
        profession: '',
        job_title: ''
      });
    }
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      if (!userForm.name.trim() || !userForm.email.trim()) {
        await showAlert('名前とメールアドレスは必須です', 'error');
        return;
      }

      // Validate company for non-SUPER_ADMIN users
      if (!editingUser && userForm.role !== 'SUPER_ADMIN' && !userForm.company_id) {
        await showAlert('会社を選択してください', 'error');
        return;
      }

      setSaving(true);

      if (editingUser) {
        // Update existing user
        const updateData: UserUpdate = {
          name: userForm.name,
          role: userForm.role,
          profession: userForm.profession || undefined,
          job_title: userForm.job_title || undefined,
        };
        await userService.update(editingUser.user_id, updateData);
        await showAlert('ユーザーを更新しました', 'success');
      } else {
        // Create new user
        if (!userForm.password) {
          await showAlert('新規ユーザーにはパスワードが必要です', 'error');
          return;
        }

        // Use admin endpoint with company_id
        const createData: UserCreateByAdmin = {
          company_id: userForm.company_id,
          email: userForm.email,
          password: userForm.password,
          name: userForm.name,
          role: userForm.role,
          profession: userForm.profession || undefined,
          job_title: userForm.job_title || undefined,
        };
        await userService.createByAdmin(createData);
        await showAlert('ユーザーを作成しました', 'success');
      }

      await loadData();
      setIsUserModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save user:', error);
      await showAlert(error.message || '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await showConfirm('本当にこのユーザーを削除しますか？');
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      await userService.delete(userId);
      await loadData();
      await showAlert('ユーザーを削除しました', 'success');
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      await showAlert(error.message || '削除に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Company admin management handlers
  const openAdminModal = async (company: Company) => {
    try {
      setSelectedCompany(company);
      setLoading(true);

      // Load company admins and all users
      const [admins, allUsers] = await Promise.all([
        userService.getCompanyAdmins(company.company_id),
        userService.getAll()
      ]);

      setCompanyAdmins(admins);
      // Filter available users (exclude existing admins and super admins)
      const adminIds = new Set(admins.map(a => a.user_id));
      setAvailableUsers(
        allUsers.filter(u =>
          !adminIds.has(u.user_id) &&
          u.role !== 'SUPER_ADMIN' &&
          u.company_id === company.company_id
        )
      );
      setSelectedUserId('');
      setIsAdminModalOpen(true);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      await showAlert('管理者データの読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedUserId || !selectedCompany) return;

    try {
      await userService.assignCompanyAdmin({
        company_id: selectedCompany.company_id,
        user_id: selectedUserId
      });

      // Reload admin list
      await openAdminModal(selectedCompany);
      await loadData(); // Refresh main data
      await showAlert('管理者を割り当てました', 'success');
    } catch (error: any) {
      console.error('Failed to assign admin:', error);
      await showAlert(error.message || '管理者の割り当てに失敗しました', 'error');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const confirmed = await showConfirm('この管理者権限を削除しますか？ユーザーは一般ユーザーになります。');
    if (!confirmed) {
      return;
    }

    try {
      await userService.removeCompanyAdmin({ user_id: userId });

      // Reload admin list
      if (selectedCompany) {
        await openAdminModal(selectedCompany);
      }
      await loadData(); // Refresh main data
      await showAlert('管理者権限を削除しました', 'success');
    } catch (error: any) {
      console.error('Failed to remove admin:', error);
      await showAlert(error.message || '管理者権限の削除に失敗しました', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return null;
  }

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'N/A';
    return companies.find(c => c.company_id === companyId)?.name || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Image src="/image.png" alt="Logo" width={28} height={28} className="object-contain" />
                システム管理
              </h1>
              <p className="text-gray-600 text-sm mt-1">会社とユーザーの管理</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <LogOut size={18} />
              ログアウト
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-6 py-3 font-semibold transition-colors relative ${activeTab === 'companies'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <Building2 size={20} />
                会社 ({companies.length})
              </div>
              {activeTab === 'companies' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-semibold transition-colors relative ${activeTab === 'users'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users size={20} />
                ユーザー ({users.length})
              </div>
              {activeTab === 'users' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'companies' ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">会社一覧</h2>
              <button
                onClick={() => openCompanyModal()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <Plus size={20} />
                会社を追加
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((company) => (
                <div
                  key={company.company_id}
                  className="bg-white rounded-lg p-6 hover:shadow-md transition-shadow border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{company.name}</h3>
                        <p className="text-xs text-gray-500">
                          {users.filter(u => u.company_id === company.company_id).length} ユーザー
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => openCompanyModal(company)}
                      className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Pencil size={16} />
                      編集
                    </button>
                    <button
                      onClick={() => openAdminModal(company)}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Shield size={16} />
                      管理者
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.company_id)}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 size={16} />
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">全ユーザー</h2>
              <button
                onClick={() => openUserModal()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <UserPlus size={20} />
                ユーザーを追加
              </button>
            </div>

            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">名前</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">メール</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">権限</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">会社</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">職種</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">状態</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{user.name}</td>
                      <td className="py-3 px-4 text-gray-600">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'COMPANY_ADMIN' ? 'bg-teal-100 text-teal-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                          {user.role === 'SUPER_ADMIN' ? 'システム管理者' :
                            user.role === 'COMPANY_ADMIN' ? '会社管理者' : '一般ユーザー'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{getCompanyName(user.company_id)}</td>
                      <td className="py-3 px-4 text-gray-600">{user.profession || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {user.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openUserModal(user)}
                            className="p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.user_id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Company Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">
                {editingCompany ? '会社を編集' : '新しい会社を追加'}
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  会社名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: さくら訪問看護ステーション"
                />
              </div>

              {!editingCompany && (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companyForm.create_admin}
                        onChange={(e) => setCompanyForm({ ...companyForm, create_admin: e.target.checked })}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">管理者ユーザーも作成する</span>
                    </label>
                  </div>

                  {companyForm.create_admin && (
                    <div className="pl-6 space-y-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          管理者名 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={companyForm.admin_name}
                          onChange={(e) => setCompanyForm({ ...companyForm, admin_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                          placeholder="例: 山田 太郎"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          管理者メール <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={companyForm.admin_email}
                          onChange={(e) => setCompanyForm({ ...companyForm, admin_email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                          placeholder="例: admin@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          パスワード <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={companyForm.admin_password}
                          onChange={(e) => setCompanyForm({ ...companyForm, admin_password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                          placeholder="パスワードを入力"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                キャンセル
              </button>
              <button
                onClick={handleSaveCompany}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">
                {editingUser ? 'ユーザーを編集' : '新しいユーザーを追加'}
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: 山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: yamada@example.com"
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">※ メールアドレスは変更できません</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  パスワード {!editingUser && <span className="text-red-500">*</span>}
                  {editingUser && <span className="text-gray-500 text-xs">(変更する場合のみ)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder={editingUser ? "変更しない場合は空欄" : "パスワードを入力"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">権限</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  disabled={!!editingUser && editingUser.role === 'SUPER_ADMIN'}
                >
                  <option value="NORMAL_USER">一般ユーザー</option>
                  <option value="COMPANY_ADMIN">会社管理者</option>
                  {editingUser && editingUser.role === 'SUPER_ADMIN' && (
                    <option value="SUPER_ADMIN">システム管理者</option>
                  )}
                </select>
                {!editingUser && (
                  <p className="text-xs text-gray-500 mt-1">※ システム管理者は作成できません</p>
                )}
                {editingUser && editingUser.role === 'SUPER_ADMIN' && (
                  <p className="text-xs text-gray-500 mt-1">※ システム管理者の権限は変更できません</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  会社 <span className="text-red-500">*</span>
                </label>
                <select
                  value={userForm.company_id}
                  onChange={(e) => setUserForm({ ...userForm, company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  disabled={editingUser?.role === 'SUPER_ADMIN'}
                >
                  <option value="">会社を選択</option>
                  {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {editingUser?.role === 'SUPER_ADMIN' && (
                  <p className="text-xs text-gray-500 mt-1">※ システム管理者は会社に所属しません</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">職種</label>
                <input
                  type="text"
                  value={userForm.profession}
                  onChange={(e) => setUserForm({ ...userForm, profession: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: 看護師"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">役職</label>
                <input
                  type="text"
                  value={userForm.job_title}
                  onChange={(e) => setUserForm({ ...userForm, job_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: 主任"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                キャンセル
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Admin Management Modal */}
      {isAdminModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedCompany.name} - 管理者管理
              </h3>
              <p className="text-sm text-gray-600 mt-1">会社管理者の追加・削除</p>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Current admins */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3">現在の管理者</h4>
                {companyAdmins.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                    管理者が設定されていません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {companyAdmins.map((admin) => (
                      <div
                        key={admin.user_id}
                        className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {admin.name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{admin.name}</div>
                            <div className="text-sm text-gray-600">{admin.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAdmin(admin.user_id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <X size={14} />
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign new admin */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-bold text-gray-700 mb-3">新しい管理者を割り当て</h4>
                {availableUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                    割り当て可能なユーザーがいません
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    >
                      <option value="">ユーザーを選択...</option>
                      {availableUsers.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignAdmin}
                      disabled={!selectedUserId}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Shield size={18} />
                      割り当て
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
