'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Bell,
  Settings,
  User,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getRoleLabel } from '@/lib/constants';
import { APP_NAME, APP_LOGO_URL, APP_INITIAL } from '@/lib/app-config';

const navItems = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/projects', label: 'Projects', icon: FolderKanban },
  { href: '/app/notifications', label: 'Notifications', icon: Bell },
  { href: '/app/users', label: 'Users', icon: Users, superAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <aside className="hidden md:flex flex-col w-60 sidebar-bg shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border">
        {APP_LOGO_URL ? (
          <img src={APP_LOGO_URL} alt={APP_NAME} className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-blue text-primary-foreground text-sm font-bold shadow-soft relative overflow-hidden">
            <div className="absolute inset-0 bg-white/20 rounded-lg animate-breathe" />
            <span className="relative">{APP_INITIAL}</span>
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight">{APP_NAME}</span>
          <span className="text-[10px] text-muted-foreground -mt-0.5">Project Management</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems
          .filter((item) => !item.superAdminOnly || isSuperAdmin)
          .map((item) => {
            const isActive =
              item.href === '/app'
                ? pathname === '/app'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 relative group',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium shadow-xs'
                    : 'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted'
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary shadow-glow" />
                )}
                <Icon className={cn('h-4 w-4 shrink-0 transition-all duration-200', isActive ? 'scale-110' : 'group-hover:scale-110')} />
                <span>{item.label}</span>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary/60" />
                )}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5 space-y-0.5">
        <Link
          href="/app/profile"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200',
            pathname === '/app/profile'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted'
          )}
        >
          <User className="h-4 w-4 shrink-0" />
          Profile
        </Link>
        <Link
          href="/app/settings"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200',
            pathname === '/app/settings'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
        <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-muted/50 border border-sidebar-border/50">
          <div className="relative">
            <UserAvatar profile={profile} className="h-8 w-8" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-sidebar" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{profile?.full_name ?? profile?.email}</span>
            <span className="text-[10px] text-sidebar-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              {getRoleLabel(profile?.role ?? 'viewer')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
