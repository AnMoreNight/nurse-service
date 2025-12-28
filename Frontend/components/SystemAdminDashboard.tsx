"use client";

import React, { useState } from 'react';
import { Company, UserAccount } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { Building2, Plus, Search, Edit, Trash2, Users, Calendar, CheckCircle, XCircle, LogIn } from 'lucide-react';

interface SystemAdminDashboardProps {
  companies: Company[];
  onAddCompany: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
  onImpersonate: (company: Company) => void;
  dbUsers: UserAccount[];
  onAddDbUser: (user: UserAccount) => void;
}

export const SystemAdminDashboard: React.FC<SystemAdminDashboardProps> = ({
  companies, onAddCompany, onUpdateCompany, onDeleteCompany, onImpersonate, dbUsers, onAddDbUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setName(company.name);
      setContactPerson(company.contactPerson);
      setEmail(company.email);
    } else {
      setEditingCompany(null);
      setName('');
      setContactPerson('');
      setEmail('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contactPerson || !email) {
      alert('すべての項目を入力してください');
      return;
    }

    if (editingCompany) {
      onUpdateCompany({
        ...editingCompany,
        name,
        contactPerson,
        email
      });
    } else {
      const newCompanyId = `c_${Date.now()}`;
      const newCompany: Company = {
        id: newCompanyId,
        name,
        status: 'active',
        contactPerson,
        email,
        userCount: 1, // We'll create an admin user
        createdAt: new Date().toISOString().split('T')[0],
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
      };
      onAddCompany(newCompany);

      // Also create a default admin user for this company
      const adminUser: UserAccount = {
        id: `u_${Date.now()}`,
        username: email.split('@')[0], // Use email prefix as username
        password: 'password123', // Default password
        name: contactPerson,
        role: 'admin',
        companyId: newCompanyId,
        companyName: name
      };
      onAddDbUser(adminUser);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('この企業を削除しますか？関連するすべてのデータも削除されます。')) {
      onDeleteCompany(id);
    }
  };

  const toggleStatus = (company: Company) => {
    onUpdateCompany({
      ...company,
      status: company.status === 'active' ? 'suspended' : 'active'
    });
  };

  // Stats
  const activeCount = companies.filter(c => c.status === 'active').length;
  const totalUsers = companies.reduce((sum, c) => sum + c.userCount, 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Building2 className="w-5 h-5" />
            </div>
            企業管理コンソール
          </h1>
          <p className="text-slate-500 mt-2 pl-13">システム管理者ダッシュボード</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{companies.length}</div>
                <div className="text-sm text-slate-500">登録企業数</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{activeCount}</div>
                <div className="text-sm text-slate-500">アクティブ企業</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{totalUsers}</div>
                <div className="text-sm text-slate-500">総ユーザー数</div>
              </div>
            </div>
          </div>
        </div>

        {/* Company List Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* List Header */}
          <div className="p-4 md:p-6 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="企業名、担当者名、メールで検索..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              新規企業登録
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">企業名</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">担当者</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">メール</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">ユーザー数</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">ステータス</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">登録日</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map(company => (
                  <tr key={company.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{company.name}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{company.contactPerson}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{company.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <Users className="w-4 h-4" />
                        {company.userCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleStatus(company)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${company.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {company.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {company.status === 'active' ? 'アクティブ' : '停止中'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {company.createdAt}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onImpersonate(company)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="この企業としてログイン"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(company)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
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
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/30 z-50 flex justify-center items-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{editingCompany ? '企業情報編集' : '新規企業登録'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">企業名</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: ABCケアサービス"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">担当者名</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  placeholder="例: 山田 太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">メールアドレス</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="例: admin@abc-care.jp"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
