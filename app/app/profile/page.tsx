'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Loader2, Camera, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile]);

  const getAvatarUrl = (path: string) => {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      // Remove old avatar if it exists
      const { data: existing } = await supabase.storage.from('avatars').list(user.id);
      if (existing && existing.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map((f) => `${user.id}/${f.name}`));
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const avatarUrl = getAvatarUrl(path);
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (dbError) throw dbError;

      refreshProfile();
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const { data: existing } = await supabase.storage.from('avatars').list(user.id);
      if (existing && existing.length > 0) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map((f) => `${user.id}/${f.name}`));
      }
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);
      if (error) throw error;
      refreshProfile();
      toast.success('Profile photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
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
            <div className="relative group">
              <UserAvatar profile={profile} className="h-20 w-20" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              {profile?.avatar_url && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div>
              <p className="font-medium">{profile?.full_name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <Badge variant="outline" className="mt-1 text-xs">{getRoleLabel(profile?.role ?? 'viewer')}</Badge>
            </div>
          </div>

          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploading...' : profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
