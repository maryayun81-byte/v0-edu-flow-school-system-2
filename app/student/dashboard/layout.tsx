'use client';

import React from "react";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Use the shared project Supabase client that correctly handles
// cookie-based sessions (crucial for reading the session after login redirect)
const supabase = createClient();

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use getUser() (server-verified) rather than getSession() (local-only cache)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          router.replace('/student/login');
          return;
        }

        // Verify role as a second layer of protection
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role !== 'student') {
          router.replace('/student/login');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/student/login');
      }
    };

    checkAuth();

    // Subscribe to auth state changes to handle sign-out / session expiry
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (!session && event !== 'INITIAL_SESSION') {
        router.replace('/student/login');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
