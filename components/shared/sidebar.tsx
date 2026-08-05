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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getRoleLabel } from '@/lib/constants';

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
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card/60 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-blue text-primary-foreground text-sm font-bold shadow-soft">
          T
        </div>
        <span className="font-semibold text-sm tracking-tight">Trackflow</span>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-1">
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
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-out relative group',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
                )}
                <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isActive ? 'scale-110' : 'group-hover:scale-110')} />
                {item.label}
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-border p-2.5 space-y-1">
        <Link
          href="/app/profile"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-out',
            pathname === '/app/profile'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          )}
        >
          <User className="h-4 w-4 shrink-0" />
          Profile
        </Link>
        <Link
          href="/app/settings"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-out',
            pathname === '/app/settings'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
        <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/40">
          <UserAvatar profile={profile} className="h-7 w-7" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{profile?.full_name ?? profile?.email}</span>
            <span className="text-[10px] text-muted-foreground">{getRoleLabel(profile?.role ?? 'viewer')}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
