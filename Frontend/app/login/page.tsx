"use client";

import { LoginConnected } from '@/components/LoginConnected';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { UserRole } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useApp();

  const handleLogin = (token: string, user: any) => {
    // Map backend roles to frontend roles
    const backendRole = user.role;
    let role: UserRole = 'user';
    if (backendRole === 'SUPER_ADMIN' || backendRole === 'SystemAdmin') {
      role = 'system_admin';
    } else if (backendRole === 'CompanyAdmin' || backendRole === 'COMPANY_ADMIN') {
      role = 'admin';
    }
    const authUser = {
      id: user.user_id,
      username: user.email,
      name: user.name,
      role,
      companyId: user.company_id,
      companyName: user.company_name || '',
    };

    setCurrentUser(authUser);

    if (authUser.role === 'system_admin') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return <LoginConnected onLogin={handleLogin} />;
}
