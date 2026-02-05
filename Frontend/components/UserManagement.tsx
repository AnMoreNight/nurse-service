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
        role: 'NORMAL_USER' as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER',
        profession: ''
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
                profession: formData.profession || undefined,
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
            role: 'NORMAL_USER',
            profession: ''
        });
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role as 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'NORMAL_USER',
            profession: user.profession || ''
        });
    };

    const handleCancel = () => {
        setEditingUser(null);
        setIsAdding(false);
        resetForm();
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">ユーザー管理</h2>
                {!isAdding && !editingUser && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                    >
                        <Plus size={20} />
                        ユーザー追加
                    </button>
                )}
            </div>

            {(isAdding || editingUser) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">
                        {editingUser ? 'ユーザー編集' : '新規ユーザー'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
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
                        <input
                            type="text"
                            placeholder="職種"
                            value={formData.profession}
                            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                            className="px-3 py-2 border rounded-lg"
                        />
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

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2 px-4">名前</th>
                            <th className="text-left py-2 px-4">メール</th>
                            <th className="text-left py-2 px-4">職種</th>
                            <th className="text-left py-2 px-4">権限</th>
                            <th className="text-right py-2 px-4">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.user_id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-4">{user.name}</td>
                                <td className="py-2 px-4">{user.email}</td>
                                <td className="py-2 px-4">{user.profession || '-'}</td>
                                <td className="py-2 px-4">
                                    <span className={`px-2 py-1 rounded text-xs ${user.role === 'COMPANY_ADMIN' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {user.role === 'COMPANY_ADMIN' ? '管理者' : '一般'}
                                    </span>
                                </td>
                                <td className="py-2 px-4 text-right">
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-800 mr-3"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => onDeleteUser(user.user_id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 size={18} />
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
