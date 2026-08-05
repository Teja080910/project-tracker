'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Skeleton className="w-60 hidden md:block" />
        <div className="flex-1 flex flex-col">
          <Skeleton className="h-14" />
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-48 animate-fade-in-up" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={`h-24 animate-fade-in-up stagger-${i + 1}`} />
              ))}
            </div>
            <Skeleton className="h-64 animate-fade-in-up stagger-5" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-6xl mx-auto px-4 py-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
