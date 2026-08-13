'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Shield } from 'lucide-react';

export default function NewVersionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const projectSlug = params.slug as string;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    (async () => {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', projectSlug)
        .maybeSingle();
      if (!projectData) {
        setChecking(false);
        return;
      }
      setProjectId(projectData.id);
      if (profile.role === 'super_admin') {
        setCanManage(true);
        setChecking(false);
        return;
      }
      const { data: membership } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectData.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setCanManage(membership?.role === 'project_admin' || membership?.role === 'super_admin');
      setChecking(false);
    })();
  }, [user, profile, projectSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('versions')
      .insert({
        project_id: projectId,
        name,
        description: description || null,
        release_date: releaseDate || null,
        status,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success('Version created');
      router.push(`/app/projects/${projectSlug}/versions/${data.slug}`);
    }
  };

  if (checking) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3 animate-fade-in-up">
          <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
            <Link href={`/app/projects/${projectSlug}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">New Version</h1>
        </div>
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Checking permissions...</CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3 animate-fade-in-up">
          <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
            <Link href={`/app/projects/${projectSlug}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">New Version</h1>
        </div>
        <Card>
          <CardContent className="py-6 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">You don&apos;t have permission to create versions.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href={`/app/projects/${projectSlug}`}>Back to Project</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href={`/app/projects/${projectSlug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Version</h1>
      </div>

      <Card className="card-hover animate-fade-in-up stagger-1">
        <CardHeader>
          <CardTitle className="text-base">Version Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Version 1.0"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's in this version..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="released">Released</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Version
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/app/projects/${projectSlug}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
