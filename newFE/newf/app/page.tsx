"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const parsed = JSON.parse(user);
      if (parsed.role === 'system_admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return null;
}
