'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Notification } from '@/lib/types';

export function Topbar() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    projects: { id: string; name: string }[];
    tasks: { id: string; number: number; title: string }[];
    users: { id: string; full_name: string | null; email: string }[];
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [profile]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      const [projectsRes, tasksRes, usersRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name')
          .ilike('name', `%${searchQuery}%`)
          .limit(5),
        supabase
          .from('tasks')
          .select('id, number, title')
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(5),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(5),
      ]);
      setSearchResults({
        projects: projectsRes.data ?? [],
        tasks: tasksRes.data ?? [],
        users: usersRes.data ?? [],
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    fetchNotifications();
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="flex items-center gap-2 h-14 px-4 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-blue text-primary-foreground text-sm font-bold">
                T
              </div>
              Trackflow
            </SheetTitle>
          </SheetHeader>
          <MobileNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search projects, tasks, users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          className="pl-9 h-9 bg-secondary/40 border-transparent focus-visible:bg-card transition-colors duration-200"
        />
        {searchOpen && searchResults && (searchResults.projects.length || searchResults.tasks.length || searchResults.users.length) > 0 && (
          <div className="absolute top-full mt-1.5 w-full rounded-lg border border-border bg-popover shadow-elevated z-50 max-h-80 overflow-y-auto animate-fade-in-scale">
            {searchResults.projects.length > 0 && (
              <div className="p-1">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Projects</p>
                {searchResults.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/app/projects/${p.id}`}
                    className="block px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors duration-150"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
            {searchResults.tasks.length > 0 && (
              <div className="p-1 border-t">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Tasks</p>
                {searchResults.tasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/app/tasks/${t.id}`}
                    className="block px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors duration-150"
                  >
                    <span className="text-muted-foreground">#{t.number}</span> {t.title}
                  </Link>
                ))}
              </div>
            )}
            {searchResults.users.length > 0 && (
              <div className="p-1 border-t">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Users</p>
                {searchResults.users.map((u) => (
                  <div key={u.id} className="px-2 py-1.5 text-sm">
                    {u.full_name ?? u.email}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative transition-transform duration-200 hover:scale-105">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse-glow" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 shadow-elevated animate-fade-in-scale">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? '#'}
                  className="block px-2 py-2 rounded-md hover:bg-accent transition-colors duration-150"
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0 animate-pulse-glow" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 transition-transform duration-200 hover:scale-105">
              <UserAvatar profile={profile} className="h-7 w-7" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-elevated animate-fade-in-scale">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{profile?.full_name ?? 'User'}</span>
                <span className="text-xs text-muted-foreground">{profile?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const items = [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/projects', label: 'Projects' },
    { href: '/app/notifications', label: 'Notifications' },
    ...(isSuperAdmin ? [{ href: '/app/users', label: 'Users' }] : []),
    { href: '/app/profile', label: 'Profile' },
    { href: '/app/settings', label: 'Settings' },
  ];
  return (
    <nav className="flex flex-col p-2 gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
