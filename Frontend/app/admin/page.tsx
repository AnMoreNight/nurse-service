"use client";

import { SystemAdminDashboard } from '@/components/SystemAdminDashboard';
import { useApp } from '@/lib/context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { currentUser, setCurrentUser, dbUsers, setDbUsers, masterCompanies, setMasterCompanies } = useApp();
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
      onAddCompany={(c) => setMasterCompanies([...masterCompanies, c])}
      onUpdateCompany={(c) => setMasterCompanies(masterCompanies.map(comp => comp.id === c.id ? c : comp))}
      onDeleteCompany={(id) => setMasterCompanies(masterCompanies.filter(c => c.id !== id))}
      onImpersonate={(c) => handleImpersonateLogin(c.id)}
      dbUsers={dbUsers}
      onAddDbUser={(u) => setDbUsers([...dbUsers, u])}
    />
  );
}
