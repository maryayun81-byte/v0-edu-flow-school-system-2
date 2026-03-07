'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      try {
        // getUser() makes a live server request — more reliable than getSession()
        // which reads from local storage and can be stale right after login.
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace('/teacher/login');
          return;
        }

        setLoading(false);
      } catch {
        router.replace('/teacher/login');
      }
    }

    checkAuth();

    // Only redirect on explicit SIGNED_OUT — don't redirect on token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/teacher/login');
      } else if (session && loading) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return <>{children}</>;
}
