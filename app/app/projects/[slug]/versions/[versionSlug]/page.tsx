'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Plus, Calendar, Search, Settings, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { DatePicker } from '@/components/shared/date-picker';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getVersionStatusMeta, TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Version, Task, Project, Profile } from '@/lib/types';

export default function VersionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectSlug = params.slug as string;
  const versionSlug = params.versionSlug as string;

  const [version, setVersion] = useState<Version | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // New task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState('none');
  const [taskAssigneeOpen, setTaskAssigneeOpen] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskCreating, setTaskCreating] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', projectSlug)
      .maybeSingle();
    setProject(projectData as Project | null);
    if (!projectData) {
      setLoading(false);
      return;
    }

    const { data: versionData } = await supabase
      .from('versions')
      .select('*')
      .eq('project_id', projectData.id)
      .eq('slug', versionSlug)
      .maybeSingle();
    setVersion(versionData as Version | null);
    if (!versionData) {
      setLoading(false);
      return;
    }

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .eq('version_id', versionData.id)
      .order('created_at', { ascending: false });

    setTasks((tasksData as unknown as Task[]) ?? []);

    // Fetch project members for the assignee picker (includes owner)
    const { data: membersData } = await supabase
      .from('project_members')
      .select('profile:profiles(*)')
      .eq('project_id', projectData.id);
    const memberProfiles = (membersData?.map((m) => m.profile) as unknown as Profile[]) ?? [];
    const { data: ownerData } = await supabase.from('profiles').select('*').eq('id', projectData.owner_id).maybeSingle();
    if (ownerData && !memberProfiles.some((p) => p.id === ownerData.id)) {
      memberProfiles.push(ownerData as Profile);
    }
    setMembers(memberProfiles);

    setLoading(false);
  }, [user, projectSlug, versionSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesAssignee =
      filterAssignee === 'all' ||
      (filterAssignee === 'unassigned' && !t.assignee_id) ||
      t.assignee_id === filterAssignee;
    return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesAssignee;
  });

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Assignees derived from the actual task list (includes non-member assignees)
  const assignees = Array.from(
    new Map(
      tasks
        .filter((t) => t.assignee)
        .map((t) => [t.assignee!.id, t.assignee!])
    ).values()
  );

  const saveVersion = async () => {
    if (!editName.trim()) {
      toast.error('Version name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('versions')
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        release_date: editReleaseDate || null,
        status: editStatus,
      })
      .eq('id', version?.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSettingsOpen(false);
      await fetchData();
      toast.success('Version updated');
    }
  };

  const createTask = async () => {
    if (!user || !project || !version) return;
    if (!taskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setTaskCreating(true);

    // Next task number for this project
    const { data: maxTask } = await supabase
      .from('tasks')
      .select('number')
      .eq('project_id', project.id)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = ((maxTask as { number: number } | null)?.number ?? 0) + 1;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        number: nextNumber,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        project_id: project.id,
        version_id: version.id,
        type: taskType,
        priority: taskPriority,
        assignee_id: taskAssigneeId === 'none' ? null : taskAssigneeId,
        reporter_id: user.id,
        due_date: taskDueDate || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setTaskCreating(false);
      return;
    }

    try {
      await supabase.from('activity_logs').insert({
        project_id: project.id,
        task_id: data.id,
        user_id: user.id,
        action: `created ${taskType}`,
        entity_type: 'task',
        entity_id: data.id,
      });

      if (taskAssigneeId !== 'none' && taskAssigneeId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: taskAssigneeId,
          actor_id: user.id,
          project_id: project.id,
          type: 'task_assigned',
          title: `New ${taskType} assigned: #${data.number}`,
          body: taskTitle.trim(),
          link: `/app/tasks/${data.id}`,
          priority: taskPriority,
        });
      }

      setTaskModalOpen(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskType('task');
      setTaskPriority('medium');
      setTaskAssigneeId('none');
      setTaskDueDate('');
      await fetchData();
      toast.success('Task created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Task created but setup failed');
    }
    setTaskCreating(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!version) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Version not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/app/projects/${projectSlug}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  const vMeta = getVersionStatusMeta(version.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href={`/app/projects/${projectSlug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tag className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{version.name}</h1>
            <Badge
              variant="outline"
              className={`text-xs bg-${vMeta.color}-500/10 text-${vMeta.color}-600 dark:text-${vMeta.color}-400 border-${vMeta.color}-500/20`}
            >
              {vMeta.label}
            </Badge>
          </div>
          {project && (
            <p className="text-sm text-muted-foreground mt-1">
              <Link href={`/app/projects/${projectSlug}`} className="hover:underline">
                {project.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => {
            setEditName(version.name);
            setEditDescription(version.description ?? '');
            setEditReleaseDate(version.release_date ?? '');
            setEditStatus(version.status);
            setSettingsOpen(true);
          }}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setTaskModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* New Task modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Task in {version.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Fix login page styling"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
                placeholder="Describe the task in detail..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger>
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
                <label className="text-sm font-medium">Priority</label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger>
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
                <label className="text-sm font-medium">Assignee</label>
                <Popover open={taskAssigneeOpen} onOpenChange={setTaskAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={taskAssigneeOpen}
                      className="w-full justify-between font-normal"
                    >
                      {taskAssigneeId !== 'none'
                        ? members.find((m) => m.id === taskAssigneeId)?.full_name ??
                          members.find((m) => m.id === taskAssigneeId)?.email
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
                              setTaskAssigneeId('none');
                              setTaskAssigneeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                taskAssigneeId === 'none' ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            Unassigned
                          </CommandItem>
                          {members.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={`${m.full_name ?? ''} ${m.email}`}
                              onSelect={() => {
                                setTaskAssigneeId(m.id);
                                setTaskAssigneeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  taskAssigneeId === m.id ? 'opacity-100' : 'opacity-0'
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
                <label className="text-sm font-medium">Due Date</label>
                <DatePicker
                  value={taskDueDate}
                  onChange={setTaskDueDate}
                  placeholder="No due date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={createTask} disabled={taskCreating}>
              {taskCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                placeholder="What's in this version..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Release Date</label>
                <DatePicker
                  value={editReleaseDate}
                  onChange={setEditReleaseDate}
                  placeholder="No release date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={saveVersion} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {version.description && (
        <p className="text-sm text-muted-foreground">{version.description}</p>
      )}

      {version.release_date && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Release date: {formatDate(version.release_date)}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up stagger-1">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {assignees.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={Tag}
              title={tasks.length === 0 ? "No tasks yet" : "No tasks match filters"}
              description={tasks.length === 0 ? "Create a task for this version" : "Try adjusting your filters"}
              action={
                tasks.length === 0 ? (
                  <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                    New Task
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {pageItems.map((task) => (
            <Link
              key={task.id}
              href={`/app/tasks/${task.id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-soft group row-hover"
            >
              <TypeBadge type={task.type} />
              <span className="text-xs text-muted-foreground">#{task.number}</span>
              <span className="text-sm flex-1 truncate">{task.title}</span>
              <PriorityBadge priority={task.priority} />
              {task.assignee && <UserAvatar profile={task.assignee} className="h-6 w-6" />}
              <StatusBadge status={task.status} />
            </Link>
          ))}
        </div>
      )}
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
