'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRoleLabel } from '@/lib/constants';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushState,
  type PushState,
} from '@/lib/push';
import { toast } from 'sonner';

const PUSH_HINTS: Record<PushState | 'loading', string> = {
  loading: 'Checking...',
  unsupported: 'Not supported on this browser',
  denied: 'Blocked — allow notifications for this site in your browser settings',
  subscribed: 'You will get notified on this device',
  unsubscribed: 'Get notified even when the app is closed',
};

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [pushState, setPushState] = useState<PushState | 'loading'>('loading');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setPushState);
  }, []);

  const togglePush = async () => {
    if (!user) return;
    setPushBusy(true);
    try {
      if (pushState === 'subscribed') {
        await disablePushNotifications();
        setPushState('unsubscribed');
        toast.success('Push notifications disabled');
      } else {
        await enablePushNotifications(user.id);
        setPushState('subscribed');
        toast.success('Push notifications enabled');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update push notifications');
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your preferences</p>
      </div>

      <Card className="card-hover animate-fade-in-up stagger-1">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">Switch between light and dark mode</p>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card className="card-hover animate-fade-in-up stagger-2">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Browser push notifications</p>
            <p className="text-xs text-muted-foreground">{PUSH_HINTS[pushState]}</p>
            {pushState === 'unsubscribed' && (
              <p className="text-xs text-muted-foreground mt-1">
                On iPhone, add this site to your Home Screen first.
              </p>
            )}
          </div>
          <Button
            variant={pushState === 'subscribed' ? 'outline' : 'default'}
            size="sm"
            disabled={
              pushBusy ||
              pushState === 'loading' ||
              pushState === 'unsupported' ||
              pushState === 'denied'
            }
            onClick={togglePush}
          >
            {pushBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pushState === 'subscribed' ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            <span className="ml-2">{pushState === 'subscribed' ? 'Disable' : 'Enable'}</span>
          </Button>
        </CardContent>
      </Card>

      <Card className="card-hover animate-fade-in-up stagger-3">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors duration-200">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{profile?.email ?? user?.email}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors duration-200">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline" className="text-xs">{getRoleLabel(profile?.role ?? 'viewer')}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
