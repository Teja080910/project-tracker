'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRoleLabel } from '@/lib/constants';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default function SettingsPage() {
  const { user, profile } = useAuth();

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
