'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { GithubIdPrompt } from '@/components/shared/github-id-prompt';
import { PushPrompt } from '@/components/shared/push-prompt';
import { Skeleton } from '@/components/ui/skeleton';
import { APP_NAME } from '@/lib/app-config';
import { ensureServiceWorker } from '@/lib/push';

const PAGE_TITLES: Record<string, string> = {
  projects: 'Projects',
  tasks: 'Task',
  calendar: 'Calendar',
  notifications: 'Notifications',
  users: 'Users',
  profile: 'Profile',
  settings: 'Settings',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const segment = pathname.split('/').filter(Boolean)[1] ?? '';
    const label = PAGE_TITLES[segment] ?? 'Dashboard';
    document.title = `${label} · ${APP_NAME}`;
  }, [pathname]);

  useEffect(() => {
    ensureServiceWorker();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    if (!loading && user && profile?.disabled) {
      router.replace('/login?disabled=true');
    }
  }, [loading, user, profile, router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Skeleton className="w-60 hidden md:block rounded-none" />
        <div className="flex-1 flex flex-col">
          <Skeleton className="h-14 rounded-none" />
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={`h-24`} />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (profile?.disabled) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto dashboard-bg">
          <div className="container max-w-6xl mx-auto px-4 md:px-6 py-6 animate-fade-in">
            <PushPrompt />
            {children}
          </div>
        </main>
      </div>
      <GithubIdPrompt />
    </div>
  );
}
