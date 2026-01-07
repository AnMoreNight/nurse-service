"use client";

import { SystemAdminDashboard } from '@/components/SystemAdminDashboard';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { companyService, Company as ApiCompany } from '@/services/companyService';
import { userService, User as ApiUser } from '@/services/userService';
import { Company, UserAccount } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { currentUser, setCurrentUser, isLoading: authLoading } = useApp();
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [dbUsers, setDbUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-system admins
  useEffect(() => {
    if (!authLoading && currentUser?.role !== 'system_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, authLoading, router]);

  // Load companies and users
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [companiesRes, usersRes] = await Promise.allSettled([
        companyService.getAll(),
        userService.getAll(),
      ]);

      // Map API companies to frontend format
      if (companiesRes.status === 'fulfilled') {
        const mappedCompanies: Company[] = companiesRes.value.map(c => ({
          id: c.company_id,
          name: c.name,
          status: 'active' as const,
          contactPerson: '',
          email: '',
          userCount: 0,
          createdAt: c.created_at,
          settings: DEFAULT_SETTINGS,
        }));
        setCompanies(mappedCompanies);
      }

      // Map API users to frontend format
      if (usersRes.status === 'fulfilled') {
        const mappedUsers: UserAccount[] = usersRes.value.map(u => ({
          id: u.user_id,
          username: u.email,
          name: u.name,
          role: u.role === 'SUPER_ADMIN' ? 'system_admin' : u.role === 'COMPANY_ADMIN' ? 'admin' : 'user',
          companyId: u.company_id,
          companyName: '',
        }));
        setDbUsers(mappedUsers);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'system_admin') {
      loadData();
    }
  }, [currentUser, loadData]);

  const handleAddCompany = async (company: Company) => {
    try {
      const created = await companyService.create({ name: company.name });
      setCompanies([...companies, {
        ...company,
        id: created.company_id,
        createdAt: created.created_at,
      }]);
    } catch (err) {
      console.error('Failed to add company:', err);
    }
  };

  const handleUpdateCompany = (company: Company) => {
    // Update locally (API update would go here if available)
    setCompanies(companies.map(c => c.id === company.id ? company : c));
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await companyService.delete(id);
      setCompanies(companies.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete company:', err);
    }
  };

  const handleImpersonate = (company: Company) => {
    setCurrentUser({
      id: 'impersonated_admin',
      username: 'admin',
      name: '管理者(代理)',
      role: 'admin',
      companyId: company.id,
      companyName: company.name
    });
    router.push('/dashboard');
  };

  const handleAddDbUser = async (user: UserAccount) => {
    try {
      await userService.create({
        email: user.username,
        password: 'temppass123',
        role: user.role === 'system_admin' ? 'SUPER_ADMIN' : user.role === 'admin' ? 'COMPANY_ADMIN' : 'NORMAL_USER',
        name: user.name,
      });
      setDbUsers([...dbUsers, user]);
    } catch (err) {
      console.error('Failed to add user:', err);
    }
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (currentUser?.role !== 'system_admin') {
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <SystemAdminDashboard
      companies={companies}
      onAddCompany={handleAddCompany}
      onUpdateCompany={handleUpdateCompany}
      onDeleteCompany={handleDeleteCompany}
      onImpersonate={handleImpersonate}
      dbUsers={dbUsers}
      onAddDbUser={handleAddDbUser}
    />
  );
}
