"use client";

import { Login } from '@/components/Login';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { AuthUser } from '@/lib/types';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser, currentUser, isLoading } = useApp();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && currentUser) {
      // SUPER_ADMIN goes to admin page
      if (currentUser.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        // Everyone else goes to dashboard
        router.push('/dashboard');
      }
    }
  }, [currentUser, isLoading, router]);

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);

    // Route based on role
    if (user.role === 'SUPER_ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't show login if already authenticated
  if (currentUser) {
    return null;
  }

  return <Login onLogin={handleLogin} />;
}
