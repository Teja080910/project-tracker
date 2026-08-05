'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import type { Project, Version, Profile } from '@/lib/types';

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const presetProject = searchParams.get('project');
  const presetVersion = searchParams.get('version');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(presetProject ?? '');
  const [versionId, setVersionId] = useState(presetVersion ?? 'none');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    if (profile?.role === 'super_admin') {
      const { data } = await supabase.from('projects').select('*').order('name');
      setProjects((data as Project[]) ?? []);
    } else {
      const { data } = await supabase
        .from('project_members')
        .select('project:projects(*)')
        .eq('user_id', user.id);
      setProjects((data?.map((m) => m.project) as unknown as Project[]) ?? []);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (projectId) {
      supabase
        .from('versions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .then(({ data }) => setVersions((data as Version[]) ?? []));
      supabase
        .from('project_members')
        .select('profile:profiles(*)')
        .eq('project_id', projectId)
        .then(({ data }) => setMembers((data?.map((m) => m.profile) as unknown as Profile[]) ?? []));
    } else {
      setVersions([]);
      setMembers([]);
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!projectId) {
      toast.error('Please select a project');
      return;
    }
    setLoading(true);

    // Get the next task number for this project
    const { data: maxTask } = await supabase
      .from('tasks')
      .select('number')
      .eq('project_id', projectId)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = ((maxTask as { number: number } | null)?.number ?? 0) + 1;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        number: nextNumber,
        title,
        description: description || null,
        project_id: projectId,
        version_id: versionId === 'none' ? null : versionId,
        type,
        priority,
        assignee_id: assigneeId === 'none' ? null : assigneeId,
        reporter_id: user.id,
        due_date: dueDate || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      // Log activity
      await supabase.from('activity_logs').insert({
        project_id: projectId,
        task_id: data.id,
        user_id: user.id,
        action: `created ${type}`,
        entity_type: 'task',
        entity_id: data.id,
      });

      // Notify assignee if assigned
      if (assigneeId !== 'none' && assigneeId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          type: 'task_assigned',
          title: `New ${type} assigned: #${data.number}`,
          body: title,
          link: `/app/tasks/${data.id}`,
        });
      }

      toast.success('Task created');
      router.push(`/app/tasks/${data.id}`);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href="/app/tasks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Task</h1>
      </div>

      <Card className="card-hover animate-fade-in-up stagger-1">
        <CardHeader>
          <CardTitle className="text-base">Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Fix login page styling"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the task in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Select value={versionId} onValueChange={setVersionId} disabled={!projectId}>
                  <SelectTrigger id="version">
                    <SelectValue placeholder="No version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No version</SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!projectId}>
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Task
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/app/tasks">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
