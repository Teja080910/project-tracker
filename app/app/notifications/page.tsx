'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { supabase } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    toast.success('All marked as read');
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    fetchNotifications();
  };

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

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-all duration-200 hover:shadow-soft animate-fade-in-up stagger-${Math.min(i + 1, 7)} ${
                n.read ? 'border-border bg-transparent hover:bg-secondary/30' : 'border-border bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0 animate-pulse-glow" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                {n.link && (
                  <Link href={n.link}>
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
                  onClick={() => deleteNotification(n.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
