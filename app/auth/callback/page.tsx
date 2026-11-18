'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { platform } from '@/lib/platform/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CallbackContent />
    </Suspense>
  );
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  useEffect(() => {
    platform.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: { user } } = await platform.auth.getUser();
        if (user) {
          const { data: profile } = await platform.from('profiles').select('disabled').eq('id', user.id).maybeSingle();
          if (profile?.disabled) {
            await platform.auth.signOut();
            router.replace('/login?disabled=true');
            return;
          }
        }
        router.push(redirectTo || '/app');
      }
    });
  }, [router, redirectTo]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
