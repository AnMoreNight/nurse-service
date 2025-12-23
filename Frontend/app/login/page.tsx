"use client";

import { LoginConnected } from '@/components/LoginConnected';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useApp();

  const handleLogin = (token: string, user: any) => {
    const authUser = {
      id: user.user_id,
      username: user.email,
      name: user.name,
      role: user.role === 'SystemAdmin' ? 'system_admin' : user.role === 'CompanyAdmin' ? 'admin' : 'user',
      companyId: user.company_id,
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
