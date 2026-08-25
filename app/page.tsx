'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { APP_NAME, APP_LOGO_URL, APP_INITIAL } from '@/lib/app-config';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/app' : '/login');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center auth-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-blue text-primary-foreground text-xl font-bold shadow-card animate-pulse-glow">
          {APP_LOGO_URL ? (
            <img src={APP_LOGO_URL} alt={APP_NAME} className="h-12 w-12 rounded-2xl object-contain" />
          ) : (
            APP_INITIAL
          )}
        </div>
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    </div>
  );
}
