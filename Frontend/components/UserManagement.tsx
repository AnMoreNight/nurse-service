"use client";

import React, { useState } from 'react';
import { User } from '@/services';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

interface UserManagementProps {
    companyId: string;
    users: User[];
    onAddUser: (user: User) => void;
    onUpdateUser: (user: User) => void;
    onDeleteUser: (id: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
    companyId,
    users,
    onAddUser,
    onUpdateUser,
    onDeleteUser
}) => {
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'NORMAL_USER' as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER'
    });

    const handleSave = () => {
        if (editingUser) {
            onUpdateUser({ ...editingUser, ...formData });
            setEditingUser(null);
        } else {
            const newUserData = {
                user_id: `new_${Date.now()}`,
                company_id: companyId,
                name: formData.name,
                email: formData.email,
                role: formData.role,
                is_active: true,
                sort_order: users.length,
            };
            onAddUser(newUserData as any); // Type will be validated by API
            setIsAdding(false);
        }
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            role: 'NORMAL_USER'
        });
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER'
        });
    };

    const handleCancel = () => {
        setEditingUser(null);
        setIsAdding(false);
        resetForm();
    };

    return (
        <div className="p-3 md:p-6 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4 gap-2">
                <h2 className="text-lg md:text-2xl font-bold text-gray-800">ユーザー管理</h2>
                {!isAdding && !editingUser && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm shrink-0"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">ユーザー追加</span>
                        <span className="sm:hidden">追加</span>
                    </button>
                )}
            </div>

            {(isAdding || editingUser) && (
                <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">
                        {editingUser ? 'ユーザー編集' : '新規ユーザー'}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        <input
                            type="text"
                            placeholder="名前"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        />
                        <input
                            type="email"
                            placeholder="メール"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        />
                        <input
                            type="password"
                            placeholder="パスワード"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        />
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                            className="px-3 py-2 border rounded-lg"
                        >
                            <option value="NORMAL_USER">一般ユーザー</option>
                            <option value="COMPANY_ADMIN">管理者</option>
                        </select>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                        >
                            <Save size={18} />
                            保存
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center gap-2"
                        >
                            <X size={18} />
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto -mx-3 md:mx-0">
                <table className="w-full text-sm min-w-[480px]">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">名前</th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm hidden sm:table-cell">メール</th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm hidden md:table-cell">職種</th>
                            <th className="text-left py-2 px-2 md:px-4 text-xs md:text-sm">権限</th>
                            <th className="text-right py-2 px-2 md:px-4 text-xs md:text-sm">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.user_id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-2 md:px-4 text-xs md:text-sm">{user.name}</td>
                                <td className="py-2 px-2 md:px-4 text-xs md:text-sm hidden sm:table-cell truncate max-w-[150px]">{user.email}</td>
                                <td className="py-2 px-2 md:px-4 text-xs md:text-sm hidden md:table-cell">{user.job_title || '-'}</td>
                                <td className="py-2 px-2 md:px-4">
                                    <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs ${user.role === 'COMPANY_ADMIN' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {user.role === 'COMPANY_ADMIN' ? '管理者' : '一般'}
                                    </span>
                                </td>
                                <td className="py-2 px-2 md:px-4 text-right">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-800 mr-2 md:mr-3"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => onDeleteUser(user.user_id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
