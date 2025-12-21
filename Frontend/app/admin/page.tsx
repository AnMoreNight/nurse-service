"use client";

import { SystemAdminDashboard } from '@/Frontend/components/SystemAdminDashboard';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { currentUser, setCurrentUser, dbUsers, setDbUsers, masterCompanies } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (currentUser?.role !== 'system_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const handleImpersonateLogin = (targetCompanyId: string) => {
    const company = masterCompanies.find(c => c.id === targetCompanyId);
    if (company) {
      setCurrentUser({
        id: 'impersonated_admin',
        username: 'admin',
        name: '管理者(代理)',
        role: 'admin',
        companyId: company.id,
        companyName: company.name
      });
      router.push('/dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    router.push('/login');
  };

  if (currentUser?.role !== 'system_admin') return null;

  return (
    <SystemAdminDashboard 
      companies={masterCompanies}
      onLoginAsCompany={handleImpersonateLogin}
      onLogout={handleLogout}
      dbUsers={dbUsers}
      onAddUser={(u) => setDbUsers([...dbUsers, u])}
    />
  );
}
