'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
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
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  if (profile?.role !== 'super_admin') {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">You don't have permission to create projects.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description || null,
        client_name: clientName || null,
        status,
        owner_id: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        role: 'project_admin',
      });
      await supabase.from('activity_logs').insert({
        project_id: data.id,
        user_id: user.id,
        action: 'created project',
        entity_type: 'project',
        entity_id: data.id,
      });
      toast.success('Project created');
      router.push(`/app/projects/${data.id}`);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href="/app/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Project</h1>
      </div>

      <Card className="card-hover animate-fade-in-up stagger-1">
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Mobile App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client Name</Label>
              <Input
                id="client"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
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
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Project
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/app/projects">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
