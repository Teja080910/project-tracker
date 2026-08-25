'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2, FolderKanban, Sparkles, MessageSquare, UserPlus, Tag, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { PriorityBadge } from '@/components/shared/badges';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Notification } from '@/lib/types';

const TYPE_META: Record<string, { icon: typeof Bell; color: string }> = {
  welcome: { icon: Sparkles, color: 'text-violet-500 bg-violet-500/10' },
  mention: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10' },
  comment_added: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10' },
  task_assigned: { icon: Tag, color: 'text-amber-500 bg-amber-500/10' },
  status_changed: { icon: AlertCircle, color: 'text-green-500 bg-green-500/10' },
  member_added: { icon: UserPlus, color: 'text-emerald-500 bg-emerald-500/10' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(*), project:projects(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setNotifications((data as unknown as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: new notifications appear instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const n = payload.new as Notification;
          const { data: actor } = await supabase.from('profiles').select('*').eq('id', n.actor_id ?? '').maybeSingle();
          const { data: project } = await supabase.from('projects').select('*').eq('id', n.project_id ?? '').maybeSingle();
          setNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [{ ...n, actor: (actor as never) ?? null, project: (project as never) ?? null }, ...prev];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    await fetchNotifications();
    toast.success('All marked as read');
  };

  const markRead = async (id: string) => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id);
    fetchNotifications();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await deleteNotification(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
  };

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = notifications.filter((n) => {
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const priorityOptions = ['all', 'low', 'medium', 'high', 'critical'];
  const typeOptions = ['all', 'mention', 'comment_added', 'task_assigned', 'status_changed', 'member_added', 'welcome'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="hover:shadow-soft transition-all duration-200">
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up">
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p === 'all' ? 'All priorities' : p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t === 'all' ? 'All types' : t.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(priorityFilter !== 'all' || typeFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setPriorityFilter('all'); setTypeFilter('all'); }}>
            Clear filters
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pageItems.map((n, i) => {
            const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-muted-foreground bg-secondary' };
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-all duration-200 hover:shadow-soft animate-fade-in-up stagger-${Math.min(i + 1, 7)} ${
                  n.read ? 'border-border bg-transparent hover:bg-secondary/30' : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0 animate-pulse-glow" />}
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.priority && (
                      <PriorityBadge priority={n.priority} className="text-[10px] px-1.5 py-0" />
                    )}
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                    {n.actor && (
                      <span className="flex items-center gap-1 min-w-0">
                        <UserAvatar profile={n.actor} className="h-4 w-4" />
                        <span className="truncate">{n.actor.full_name ?? n.actor.email}</span>
                      </span>
                    )}
                    {n.project && (
                      <span className="flex items-center gap-1 min-w-0">
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{n.project.name}</span>
                      </span>
                    )}
                    <span>{formatRelativeTime(n.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => {
                        if (!n.read) markRead(n.id);
                      }}
                    >
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        View
                      </Button>
                    </Link>
                  )}
                  {!n.read && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markRead(n.id)}>
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(n)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />

      {/* Delete notification confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Notification"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText={deleteTarget?.title ?? ''}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
