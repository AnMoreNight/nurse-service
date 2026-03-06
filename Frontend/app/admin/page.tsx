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

  // Pagination state for users table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Company modal state
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    create_admin: false,
    admin_login_id: '',
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
    login_id: '',
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

  const loadUsers = async (page: number = currentPage, size: number = pageSize) => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers(undefined, page, size, false);

      // Handle paginated response
      if (response && typeof response === 'object' && 'data' in response) {
        setUsers(response.data);
        setTotalPages(response.total_pages);
        setTotalUsers(response.total_count);
        setCurrentPage(response.page);
      } else {
        // Fallback for non-paginated response (shouldn't happen with new API)
        setUsers(Array.isArray(response) ? response : []);
      }
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
      const [companiesData, usersResponse] = await Promise.all([
        companyService.getAll(),
        userService.getAllUsers(undefined, currentPage, pageSize, false)
      ]);
      setCompanies(companiesData);

      // Handle paginated users response
      if (usersResponse && typeof usersResponse === 'object' && 'data' in usersResponse) {
        setUsers(usersResponse.data);
        setTotalPages(usersResponse.total_pages);
        setTotalUsers(usersResponse.total_count);
        setCurrentPage(usersResponse.page);
      } else {
        setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      }
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
        admin_login_id: '',
        admin_password: '',
        admin_name: ''
      });
    } else {
      setEditingCompany(null);
      setCompanyForm({
        name: '',
        create_admin: false,
        admin_login_id: '',
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
          if (!companyForm.admin_login_id || !companyForm.admin_password || !companyForm.admin_name) {
            await showAlert('管理者を作成する場合は、名前、ログインID、パスワードが必要です', 'error');
            return;
          }

          await userService.createByAdmin({
            company_id: newCompany.company_id,
            login_id: companyForm.admin_login_id,
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
        login_id: user.login_id,
        password: user.password_plain || '',
        role: user.role as any,
        company_id: user.company_id || '',
        profession: user.profession || '',
        job_title: user.job_title || ''
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        login_id: '',
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
      if (!userForm.name.trim() || !userForm.login_id.trim()) {
        await showAlert('名前とログインIDは必須です', 'error');
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
        // If password provided, reset it
        if (userForm.password.trim()) {
          await userService.resetPassword(editingUser.user_id, userForm.password);
        }
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
          login_id: userForm.login_id,
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
      setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const confirmed = await showConfirm('この管理者権限を削除しますか？ユーザーは一般ユーザーになります。');
    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
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
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-slate-50 relative">
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-white/70 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-700 font-medium">処理中...</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                <Image src="/image.png" alt="Logo" width={24} height={24} className="object-contain md:w-7 md:h-7" />
                システム管理
              </h1>
              <p className="text-gray-600 text-xs md:text-sm mt-0.5 md:mt-1">会社とユーザーの管理</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-1.5 md:gap-2 shadow-sm text-xs md:text-sm"
            >
              <LogOut size={16} className="md:w-4.5 md:h-4.5" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-3 md:px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-3 md:px-6 py-2.5 md:py-3 font-semibold transition-colors relative text-sm md:text-base ${activeTab === 'companies'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <Building2 size={18} className="md:w-5 md:h-5" />
                会社 ({companies.length})
              </div>
              {activeTab === 'companies' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 md:px-6 py-2.5 md:py-3 font-semibold transition-colors relative text-sm md:text-base ${activeTab === 'users'
                ? 'text-teal-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <Users size={18} className="md:w-5 md:h-5" />
                ユーザー ({totalUsers})
              </div>
              {activeTab === 'users' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        {activeTab === 'companies' ? (
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className="text-base md:text-xl font-bold text-gray-900">会社一覧</h2>
              <button
                onClick={() => openCompanyModal()}
                disabled={saving}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1.5 md:gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
              >
                <Plus size={16} className="md:w-5 md:h-5" />
                会社を追加
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {companies.map((company) => (
                <div
                  key={company.company_id}
                  className="bg-white rounded-lg p-4 md:p-6 hover:shadow-md transition-shadow border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-3 md:mb-4">
                    <div className="flex items-center gap-2.5 md:gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base md:text-lg text-gray-900 truncate">{company.name}</h3>
                        <p className="text-xs text-gray-500">
                          {company.user_count ?? 0} ユーザー
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 md:gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
                    <button
                      onClick={() => openCompanyModal(company)}
                      disabled={saving}
                      className="flex-1 px-2 md:px-3 py-1.5 md:py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Pencil size={14} className="md:w-4 md:h-4" />
                      編集
                    </button>
                    <button
                      onClick={() => openAdminModal(company)}
                      disabled={saving}
                      className="flex-1 px-2 md:px-3 py-1.5 md:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Shield size={14} className="md:w-4 md:h-4" />
                      管理者
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(company.company_id)}
                      disabled={saving}
                      className="flex-1 px-2 md:px-3 py-1.5 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} className="md:w-4 md:h-4" />
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className="text-base md:text-xl font-bold text-gray-900">全ユーザー ({totalUsers})
              </h2>
              <button
                onClick={() => openUserModal()}
                disabled={saving}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1.5 md:gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
              >
                <UserPlus size={16} className="md:w-5 md:h-5" />
                <span className="hidden sm:inline">ユーザーを</span>追加
              </button>
            </div>

            <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full min-w-[540px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700">名前</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700 hidden sm:table-cell">ログインID</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700 hidden sm:table-cell">パスワード</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700">権限</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700 hidden md:table-cell">会社</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700 hidden lg:table-cell">職種</th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700 hidden sm:table-cell">状態</th>
                    <th className="text-right py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-900 text-xs md:text-sm">{user.name}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-600 text-xs md:text-sm hidden sm:table-cell max-w-[180px] truncate">{user.login_id}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-600 text-xs md:text-sm hidden sm:table-cell max-w-[120px] truncate">{user.password_plain || '-'}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-medium whitespace-nowrap ${user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'COMPANY_ADMIN' ? 'bg-teal-100 text-teal-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                          {user.role === 'SUPER_ADMIN' ? 'システム管理者' :
                            user.role === 'COMPANY_ADMIN' ? '会社管理者' : '一般ユーザー'}
                        </span>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-600 text-xs md:text-sm hidden md:table-cell">{getCompanyName(user.company_id)}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-gray-600 text-xs md:text-sm hidden lg:table-cell">{user.profession || '-'}</td>
                      <td className="py-2 md:py-3 px-2 md:px-4 hidden sm:table-cell">
                        <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {user.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-right">
                        <div className="flex justify-end gap-1 md:gap-2">
                          <button
                            onClick={() => openUserModal(user)}
                            disabled={saving}
                            className="p-1.5 md:p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Pencil size={14} className="md:w-4 md:h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.user_id)}
                            disabled={saving}
                            className="p-1.5 md:p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} className="md:w-4 md:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-3 md:mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <div className="text-xs md:text-sm text-gray-600">
                  {users.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0}-{Math.min(currentPage * pageSize, totalUsers)} / {totalUsers}件
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <label className="text-xs md:text-sm text-gray-600">件数:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      setCurrentPage(1);
                      loadUsers(1, newSize);
                    }}
                    className="px-2 md:px-3 py-1 border border-gray-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2">
                <button
                  onClick={() => {
                    if (currentPage > 1) {
                      const newPage = currentPage - 1;
                      setCurrentPage(newPage);
                      loadUsers(newPage, pageSize);
                    }
                  }}
                  disabled={currentPage <= 1}
                  className="px-2.5 md:px-3 py-1 border border-gray-300 rounded-lg text-xs md:text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  前へ
                </button>

                <span className="text-xs md:text-sm text-gray-600">
                  {currentPage}/{totalPages}
                </span>

                <button
                  onClick={() => {
                    if (currentPage < totalPages) {
                      const newPage = currentPage + 1;
                      setCurrentPage(newPage);
                      loadUsers(newPage, pageSize);
                    }
                  }}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 md:px-3 py-1 border border-gray-300 rounded-lg text-xs md:text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  次へ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                {editingCompany ? '会社を編集' : '新しい会社を追加'}
              </h3>
            </div>

            <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
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
                    <div className="pl-4 md:pl-6 space-y-4 bg-gray-50 p-3 md:p-4 rounded-lg">
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
                          管理者ログインID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={companyForm.admin_login_id}
                          onChange={(e) => setCompanyForm({ ...companyForm, admin_login_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
                          placeholder="例: t.yamada.companyname"
                        />
                        <p className="text-xs text-gray-500 mt-1">他社のユーザーIDとの重複を防ぐため、IDの末尾に会社名等を付けてください。</p>
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

            <div className="p-4 md:p-6 border-t border-gray-200 flex gap-3 shrink-0">
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={18} />
                キャンセル
              </button>
              <button
                onClick={handleSaveCompany}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 shrink-0">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                {editingUser ? 'ユーザーを編集' : '新しいユーザーを追加'}
              </h3>
            </div>

            <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
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
                  ログインID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.login_id}
                  onChange={(e) => setUserForm({ ...userForm, login_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="例: t.yamada.companyname"
                  disabled={!!editingUser}
                />
                {!editingUser && (
                  <p className="text-xs text-gray-500 mt-1">他社のユーザーIDとの重複を防ぐため、IDの末尾に会社名等を付けてください。</p>
                )}
                {editingUser && (
                  <p className="text-xs text-gray-500 mt-1">※ ログインIDは変更できません</p>
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

            <div className="p-4 md:p-6 border-t border-gray-200 flex gap-3 shrink-0">
              <button
                onClick={() => setIsUserModalOpen(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={18} />
                キャンセル
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 shrink-0">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                {selectedCompany.name} - 管理者管理
              </h3>
              <p className="text-xs md:text-sm text-gray-600 mt-1">会社管理者の追加・削除</p>
            </div>

            <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1">
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
                        className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-2.5 md:p-3"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base shrink-0">
                            {admin.name.substring(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm md:text-base truncate">{admin.name}</div>
                            <div className="text-xs md:text-sm text-gray-600 truncate">{admin.login_id}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAdmin(admin.user_id)}
                          disabled={saving}
                          className="px-2 md:px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs md:text-sm transition-colors flex items-center gap-1 shrink-0 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="border-t border-gray-200 pt-4 md:pt-6">
                <h4 className="text-sm font-bold text-gray-700 mb-3">新しい管理者を割り当て</h4>
                {availableUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                    割り当て可能なユーザーがいません
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm md:text-base"
                    >
                      <option value="">ユーザーを選択...</option>
                      {availableUsers.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.name} ({user.login_id})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignAdmin}
                      disabled={!selectedUserId || saving}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Shield size={18} />
                      割り当て
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-gray-200 shrink-0">
              <button
                onClick={() => setIsAdminModalOpen(false)}
                disabled={saving}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
