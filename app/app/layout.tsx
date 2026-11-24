'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { GithubIdPrompt } from '@/components/shared/github-id-prompt';
import { PushPrompt } from '@/components/shared/push-prompt';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/app-config';
import { ensureServiceWorker } from '@/lib/push';

const PAGE_TITLES: Record<string, string> = {
  teams: 'Teams',
  projects: 'Projects',
  tasks: 'Task',
  guide: 'Guide',
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
    const segment = (pathname ?? '').split('/').filter(Boolean)[1] ?? '';
    const label = PAGE_TITLES[segment] ?? 'Dashboard';
    document.title = `${label} · ${APP_NAME}`;
  }, [pathname]);

  useEffect(() => {
    ensureServiceWorker();
  }, []);

  useEffect(() => {
    if (!loading && user && profile?.disabled) {
      router.replace('/login?disabled=true');
      return;
    }
    if (!loading && (!user || !profile)) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, profile, router, pathname]);

  // Task detail page is a dense chat + properties layout: give it the full
  // available width instead of squeezing it into a fixed max-w-6xl box.
  const isTaskDetail = useMemo(
    () => /\/app\/tasks\/[^/]+/.test(pathname ?? ''),
    [pathname]
  );

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
          <div
            className={cn(
              'mx-auto px-4 md:px-6 py-6 animate-fade-in',
              isTaskDetail
                ? 'w-full max-w-[1600px] xl:flex xl:h-full xl:min-h-0 xl:flex-col'
                : 'container max-w-6xl'
            )}
          >
            <PushPrompt />
            {children}
          </div>
        </main>
      </div>
      <GithubIdPrompt />
    </div>
  );
}
