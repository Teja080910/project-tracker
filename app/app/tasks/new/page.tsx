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
import { sendNotificationEmail } from '@/lib/email-client';
import { TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { StatusBadge, TypeBadge } from '@/components/shared/badges';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, FolderKanban } from 'lucide-react';
import type { Project, Version, Profile, Task } from '@/lib/types';

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const presetProject = searchParams.get('project');
  const presetVersion = searchParams.get('version');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [versionId, setVersionId] = useState('none');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('none');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchProjects = useCallback(async () => {
    if (!user || !profile) return;
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

  // Resolve preset slugs (from URL) to ids once projects are loaded
  useEffect(() => {
    if (projects.length === 0) return;
    if (presetProject) {
      const match = projects.find((p) => p.slug === presetProject || p.id === presetProject);
      if (match) {
        setProjectId(match.id);
        if (presetVersion) {
          supabase
            .from('versions')
            .select('*')
            .eq('project_id', match.id)
            .then(({ data }) => {
              const v = (data as Version[] ?? []).find((x) => x.slug === presetVersion || x.id === presetVersion);
              if (v) setVersionId(v.id);
            });
        }
        // Auto-open the task form when arriving with project/version context
        setShowForm(true);
      }
    }
  }, [projects, presetProject, presetVersion]);

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
        .then(async ({ data }) => {
          const memberProfiles = (data?.map((m) => m.profile) as unknown as Profile[]) ?? [];
          const { data: projectData } = await supabase.from('projects').select('owner_id').eq('id', projectId).maybeSingle();
          if (projectData?.owner_id && !memberProfiles.some((p) => p.id === projectData.owner_id)) {
            const { data: owner } = await supabase.from('profiles').select('*').eq('id', projectData.owner_id).maybeSingle();
            if (owner) memberProfiles.push(owner as Profile);
          }
          setMembers(memberProfiles);
        });
      let query = supabase
        .from('tasks')
        .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (versionId !== 'none') {
        query = query.eq('version_id', versionId);
      }
      query.then(({ data }) => setTasks((data as unknown as Task[]) ?? []));
    } else {
      setVersions([]);
      setMembers([]);
      setTasks([]);
    }
  }, [projectId, versionId]);

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
      return;
    }

    try {
      const { error: logErr } = await supabase.from('activity_logs').insert({
        project_id: projectId,
        task_id: data.id,
        user_id: user.id,
        action: `created ${type}`,
        entity_type: 'task',
        entity_id: data.id,
      });
      if (logErr) throw logErr;

      if (assigneeId !== 'none' && assigneeId !== user.id) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: assigneeId,
          actor_id: user.id,
          project_id: projectId,
          type: 'task_assigned',
          title: `New ${type} assigned: #${data.number}`,
          body: title,
          link: `/app/tasks/${data.id}`,
        });
        if (notifErr) throw notifErr;
        const assignee = members.find((m) => m.id === assigneeId);
        if (assignee) {
          sendNotificationEmail(
            assignee.email,
            `New ${type} assigned: #${data.number}`,
            title,
            `${window.location.origin}/app/tasks/${data.id}`
          );
        }
      }

      toast.success('Task created');
      router.push(`/app/tasks/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Task created but notification failed');
      router.push(`/app/tasks/${data.id}`);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href="/app/tasks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New Task</h1>
      </div>

      {/* Project / Version context — hidden when preset in URL (arrived from project/version) */}
      {presetProject && projectId ? (
        <div className="flex flex-wrap items-center gap-2 animate-fade-in-up stagger-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Adding task to</span>
          {(() => {
            const proj = projects.find((p) => p.id === projectId);
            const ver = versions.find((v) => v.id === versionId);
            return (
              <>
                <Link
                  href={`/app/projects/${proj?.slug ?? ''}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  {proj?.name ?? 'Project'}
                </Link>
                {ver && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-foreground text-sm font-medium">
                      {ver.name}
                    </span>
                  </>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <Card className="card-hover animate-fade-in-up stagger-1">
          <CardHeader>
            <CardTitle className="text-base">Select Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                <Select value={projectId} onValueChange={(v) => { setProjectId(v); setShowForm(false); }}>
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
          </CardContent>
        </Card>
      )}

      {/* Task list for selected project/version */}
      {projectId && (
        <Card className="animate-fade-in-up stagger-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FolderKanban className="h-3.5 w-3.5" />
              </div>
              {versionId !== 'none'
                ? `Tasks in ${versions.find((v) => v.id === versionId)?.name ?? 'version'} (${tasks.length})`
                : `All Tasks (${tasks.length})`}
            </CardTitle>
            <Button size="sm" onClick={() => setShowForm((s) => !s)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No tasks yet"
                description="Click Add Task to create the first one"
              />
            ) : (
              <div className="space-y-1">
                {tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/tasks/${task.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-soft group row-hover"
                  >
                    <TypeBadge type={task.type} />
                    <span className="text-xs text-muted-foreground">#{task.number}</span>
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    {task.assignee && <UserAvatar profile={task.assignee} className="h-6 w-6" />}
                    <StatusBadge status={task.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task form (no project/version fields) */}
      {projectId && showForm && (
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
                  rows={4}
                />
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
                  <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assigneeOpen}
                        className="w-full justify-between font-normal h-9"
                      >
                        {assigneeId !== 'none'
                          ? members.find((m) => m.id === assigneeId)?.full_name ??
                            members.find((m) => m.id === assigneeId)?.email
                          : 'Unassigned'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search members..." />
                        <CommandList className="max-h-56 overflow-y-auto">
                          <CommandEmpty>No member found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="unassigned"
                              onSelect={() => {
                                setAssigneeId('none');
                                setAssigneeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  assigneeId === 'none' ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              Unassigned
                            </CommandItem>
                            {members.map((m) => (
                              <CommandItem
                                key={m.id}
                                value={`${m.full_name ?? ''} ${m.email}`}
                                onSelect={() => {
                                  setAssigneeId(m.id);
                                  setAssigneeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    assigneeId === m.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <UserAvatar profile={m} className="h-6 w-6 mr-2" />
                                <span className="flex flex-col min-w-0">
                                  <span className="truncate text-sm">{m.full_name ?? m.email}</span>
                                  {m.full_name && (
                                    <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                                  )}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
