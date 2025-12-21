
import React, { useState } from 'react';
import { Company, UserAccount } from '../types';
import { MOCK_COMPANIES, DEFAULT_SETTINGS } from '../constants';
import { Building2, Users, Search, Plus, LogIn, Trash2, Edit, Key, User } from 'lucide-react';

interface SystemAdminDashboardProps {
  onLoginAsCompany: (companyId: string) => void;
  onLogout: () => void;
  dbUsers: UserAccount[];
  onAddUser: (user: UserAccount) => void;
}

export const SystemAdminDashboard: React.FC<SystemAdminDashboardProps> = ({ onLoginAsCompany, onLogout, dbUsers, onAddUser }) => {
  const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  // Admin User Creation (Only for new companies)
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const filteredCompanies = companies.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total users belonging to companies (exclude system admins)
  const totalUsers = dbUsers.filter(u => u.companyId).length;

  const handleOpenModal = (company?: Company) => {
      if (company) {
          setEditingCompany(company);
          setFormName(company.name);
          setFormContact(company.contactPerson);
          setFormEmail(company.email);
          setAdminId('');
          setAdminPassword('');
      } else {
          setEditingCompany(null);
          setFormName('');
          setFormContact('');
          setFormEmail('');
          setAdminId('');
          setAdminPassword('');
      }
      setShowModal(true);
  };

  const handleSave = () => {
      if (!formName || !formContact) {
          alert('会社名と担当者名は必須です');
          return;
      }

      if (editingCompany) {
          setCompanies(prev => prev.map(c => c.id === editingCompany.id ? {
              ...c,
              name: formName,
              contactPerson: formContact,
              email: formEmail,
          } : c));
      } else {
          // New Company
          if (!adminId || !adminPassword) {
              alert('初期管理者のIDとパスワードを設定してください');
              return;
          }

          const newCompanyId = `c${Date.now()}`;
          const newCompany: Company = {
              id: newCompanyId,
              name: formName,
              contactPerson: formContact,
              email: formEmail,
              status: 'active',
              userCount: 1,
              createdAt: new Date().toISOString().split('T')[0],
              settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
          };
          setCompanies([...companies, newCompany]);

          // Create initial admin user
          const newAdmin: UserAccount = {
              id: `u_${Date.now()}`,
              username: adminId,
              password: adminPassword,
              name: formContact, // Use contact person name as admin name
              role: 'admin',
              companyId: newCompanyId,
              companyName: formName
          };
          onAddUser(newAdmin);
      }
      setShowModal(false);
  };

  const handleDelete = (id: string) => {
      if (window.confirm('本当にこの会社を削除しますか？')) {
          setCompanies(prev => prev.filter(c => c.id !== id));
      }
  };

  const getUserCount = (companyId: string) => {
      return dbUsers.filter(u => u.companyId === companyId).length;
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
        {/* Header */}
        <header className="bg-slate-900 text-white h-16 px-6 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                    SA
                </div>
                <h1 className="text-lg font-bold">SaaS管理コンソール</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <div className="text-xs text-slate-400">System Admin</div>
                    <div className="text-sm font-bold">root</div>
                </div>
                <button 
                    onClick={onLogout}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors"
                >
                    ログアウト
                </button>
            </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold">契約社数</div>
                        <div className="text-2xl font-bold">{companies.length}</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-bold">総ユーザー数</div>
                        <div className="text-2xl font-bold">{totalUsers}</div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="会社名、メールアドレスで検索..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold w-full md:w-auto justify-center"
                >
                    <Plus className="w-4 h-4" />
                    新規会社登録
                </button>
            </div>

            {/* Companies Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">会社名 / ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">連絡先</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ユーザー</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredCompanies.map(company => (
                            <tr key={company.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{company.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">{company.id}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium">{company.contactPerson}</div>
                                    <div className="text-xs text-slate-500">{company.email}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    {getUserCount(company.id)}名
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => onLoginAsCompany(company.id)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                            title="この会社の管理者としてログイン"
                                        >
                                            <LogIn className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleOpenModal(company)}
                                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(company.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>

        {/* Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h2 className="text-xl font-bold mb-4">{editingCompany ? '会社情報の編集' : '新規会社登録'}</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">会社名</label>
                            <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formName} onChange={e => setFormName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">担当者名</label>
                            <input type="text" className="w-full px-3 py-2 border rounded-lg" value={formContact} onChange={e => setFormContact(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">メールアドレス</label>
                            <input type="email" className="w-full px-3 py-2 border rounded-lg" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                        </div>

                        {/* Admin Account Creation - Only for New Companies */}
                        {!editingCompany && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-3">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Key className="w-4 h-4" />
                                    初期管理者アカウント
                                </h4>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">ログインID</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text" 
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white" 
                                            value={adminId} 
                                            onChange={e => setAdminId(e.target.value)} 
                                            placeholder="admin_company"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">パスワード</label>
                                    <input 
                                        type="password" 
                                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white" 
                                        value={adminPassword} 
                                        onChange={e => setAdminPassword(e.target.value)} 
                                        placeholder="初期パスワード"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">保存</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};