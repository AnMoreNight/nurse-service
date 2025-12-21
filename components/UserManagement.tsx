
import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { Plus, Edit, Trash2, Key, User, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface UserManagementProps {
  companyId: string;
  users: UserAccount[];
  onAddUser: (user: UserAccount) => void;
  onUpdateUser: (user: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ companyId, users, onAddUser, onUpdateUser, onDeleteUser }) => {
  const companyUsers = users.filter(u => u.companyId === companyId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Password Visibility State for Table
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Password Visibility State for Modal
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');

  const handleOpenModal = (user?: UserAccount) => {
      setShowModalPassword(false); // Reset visibility
      if (user) {
          setEditingUser(user);
          setName(user.name);
          setUsername(user.username);
          setPassword(user.password || ''); // Pre-fill password for viewing/editing
          setRole(user.role);
      } else {
          setEditingUser(null);
          setName('');
          setUsername('');
          setPassword('');
          setRole('user');
      }
      setIsModalOpen(true);
  };

  const toggleTablePassword = (userId: string) => {
      setVisiblePasswords(prev => ({
          ...prev,
          [userId]: !prev[userId]
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name || !username) {
          alert('名前とユーザーIDは必須です');
          return;
      }
      
      if (editingUser) {
          // Update
          onUpdateUser({
              ...editingUser,
              name,
              username,
              password: password, // Update with current input value
              role
          });
      } else {
          // Add
          if (!password) {
              alert('新規ユーザーにはパスワードが必要です');
              return;
          }
          const newUser: UserAccount = {
              id: `u_${Date.now()}`,
              name,
              username,
              password,
              role,
              companyId
          };
          onAddUser(newUser);
      }
      setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if (window.confirm('本当にこのユーザーを削除しますか？')) {
          onDeleteUser(id);
      }
  };

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-purple-600" />
                ユーザー管理
            </h2>
            <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm"
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
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">ログインID</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">パスワード</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">権限</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {companyUsers.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50 group">
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-800">{user.name}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-gray-600">
                                {user.username}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-gray-600 w-24">
                                        {visiblePasswords[user.id] ? user.password : '••••••••'}
                                    </span>
                                    <button 
                                        onClick={() => toggleTablePassword(user.id)}
                                        className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                        title={visiblePasswords[user.id] ? "隠す" : "表示"}
                                    >
                                        {visiblePasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                    {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                    {user.role === 'admin' ? '管理者' : '一般'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => handleOpenModal(user)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="編集"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(user.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                    <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">{editingUser ? 'ユーザー編集' : '新規ユーザー'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <span className="text-2xl">&times;</span>
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">名前</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="例: 鈴木 一郎"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">ログインID</label>
                            <input 
                                type="text" 
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={username} 
                                onChange={e => setUsername(e.target.value)} 
                                placeholder="例: suzuki"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">
                                パスワード
                            </label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                <input 
                                    type={showModalPassword ? "text" : "password"}
                                    className="w-full pl-9 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder={editingUser ? "パスワード" : "パスワード"}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowModalPassword(!showModalPassword)}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                >
                                    {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">権限</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        checked={role === 'user'} 
                                        onChange={() => setRole('user')}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">一般</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="role" 
                                        checked={role === 'admin'} 
                                        onChange={() => setRole('admin')}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">管理者</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold"
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

const UsersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);
