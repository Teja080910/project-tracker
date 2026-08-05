'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getRoleLabel } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq('id', user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated');
      refreshProfile();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information</p>
      </div>

      <Card className="card-hover animate-fade-in-up stagger-1">
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="transition-transform duration-200 hover:scale-105">
              <UserAvatar profile={profile} className="h-16 w-16" />
            </div>
            <div>
              <p className="font-medium">{profile?.full_name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <Badge variant="outline" className="mt-1 text-xs">{getRoleLabel(profile?.role ?? 'viewer')}</Badge>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? ''} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Member since</Label>
              <Input value={formatDate(profile?.created_at)} disabled className="bg-muted/50" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
