"use client";

import { Login } from '@/Frontend/components/Login';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser, dbUsers } = useApp();

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    
    if (user.role === 'system_admin') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return <Login onLogin={handleLogin} dbUsers={dbUsers} />;
}
