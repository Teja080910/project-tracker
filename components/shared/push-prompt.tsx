'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { BellRing, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { enablePushNotifications, getPushState, isPushSupported } from '@/lib/push';

export function PushPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!user) {
      setVisible(false);
      return;
    }
    if (!isPushSupported()) return;
    if (localStorage.getItem(`push-prompt-dismissed-${user.id}`)) return;

    let cancelled = false;

    (async () => {
      const state = await getPushState();
      if (cancelled || state !== 'unsubscribed') return;

      if (Notification.permission === 'granted') {
        // Permission already granted on this device: subscribe silently.
        try {
          await enablePushNotifications(user.id);
          return;
        } catch (err) {
          console.warn('Silent push subscription failed:', err);
        }
      }
      if (!cancelled) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;
    setEnabling(true);
    try {
      await enablePushNotifications(user.id);
      setVisible(false);
      toast.success('Browser notifications enabled');
    } catch (err) {
      if (Notification.permission === 'denied') {
        setVisible(false);
        toast.error('Notifications are blocked in your browser settings');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not enable notifications');
      }
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    if (user) localStorage.setItem(`push-prompt-dismissed-${user.id}`, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm animate-fade-in">
      <BellRing className="h-5 w-5 text-primary shrink-0" />
      <p className="flex-1 text-sm">
        Turn on browser notifications to get task assignments, comments and mentions instantly.
      </p>
      <Button size="sm" onClick={handleEnable} disabled={enabling}>
        {enabling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Enable
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
