'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ListTodo, ArrowRight, FolderKanban, Calendar, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import type { Task, Project } from '@/lib/types';

export default function TasksPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState(searchParams.get('project') ?? 'all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchTasks = useCallback(async () => {
    if (!user || authLoading) return;

    let projectIds: string[] = [];
    if (profile?.role === 'super_admin') {
      const { data: allProjects } = await supabase.from('projects').select('*');
      setProjects((allProjects as Project[]) ?? []);
      projectIds = (allProjects ?? []).map((p) => (p as Project).id);
    } else {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project:projects(*)')
        .eq('user_id', user.id);
      const userProjects = (memberships?.map((m) => m.project) as unknown as Project[]) ?? [];
      setProjects(userProjects);
      projectIds = userProjects.map((p) => p.id);
    }

    if (projectIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false });

    setTasks((tasksData as unknown as Task[]) ?? []);

    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email');
    setProfiles((profilesData as { id: string; full_name: string | null; email: string }[]) ?? []);

    setLoading(false);
  }, [user, profile, authLoading]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesProject =
      filterProject === 'all' ||
      t.project_id === filterProject ||
      t.project?.slug === filterProject;
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesAssignee =
      filterAssignee === 'all' ||
      (filterAssignee === 'unassigned' && !t.assignee_id) ||
      t.assignee_id === filterAssignee;
    return matchesSearch && matchesProject && matchesStatus && matchesType && matchesPriority && matchesAssignee;
  });

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const counts = {
    open: tasks.filter((t) => t.status === 'open').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {tasks.length} tasks
          </p>
        </div>
        <Button asChild className="animate-fade-in-scale">
          <Link href="/app/tasks/new">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2 animate-fade-in-up stagger-1">
        {TASK_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? 'all' : s.value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
              filterStatus === s.value
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card/60 border-border/60 text-muted-foreground hover:border-primary/20 hover:text-foreground'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
            <span className="tabular-nums opacity-70">{counts[s.value as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up stagger-1">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary/40 border-transparent focus-visible:bg-card transition-colors duration-200"
          />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task table */}
      {filtered.length === 0 ? (
        <Card className="animate-fade-in-up stagger-2">
          <CardContent className="py-6">
            <EmptyState
              icon={ListTodo}
              title={tasks.length === 0 ? "No tasks yet" : "No tasks match filters"}
              description={tasks.length === 0 ? "Create your first task to get started" : "Try adjusting your filters"}
              action={
                tasks.length === 0 ? (
                  <Button size="sm" asChild>
                    <Link href="/app/tasks/new">New Task</Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 animate-fade-in-up stagger-2">
          {pageItems.map((task, i) => (
            <Link
              key={task.id}
              href={`/app/tasks/${task.id}`}
              className={`block rounded-xl border border-border/70 bg-card/60 hover:border-primary/30 hover:shadow-soft hover:bg-card transition-all duration-200 group animate-fade-in-up stagger-${Math.min(i + 1, 7)} overflow-hidden`}
            >
              {/* Mobile layout */}
              <div className="md:hidden p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={task.type} />
                    <span className="text-xs text-muted-foreground font-mono">#{task.number}</span>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors duration-200">
                  {task.title}
                </p>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    {task.project ? (
                      <>
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.project.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    {task.assignee && <UserAvatar profile={task.assignee} className="h-5 w-5 shrink-0" />}
                  </div>
                </div>
              </div>

              {/* Desktop layout */}
              <div className="hidden md:flex items-center gap-4 px-5 py-4">
                <div className="w-24 shrink-0">
                  <TypeBadge type={task.type} />
                </div>
                <div className="w-14 shrink-0 text-xs text-muted-foreground font-mono">#{task.number}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors duration-200">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {task.project && (
                      <span className="flex items-center gap-1 min-w-0">
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.project.name}</span>
                      </span>
                    )}
                    {task.version && (
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">{task.version.name}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-24 shrink-0 flex justify-center">
                  <PriorityBadge priority={task.priority} />
                </div>
                <div className="w-40 shrink-0 flex items-center gap-2 min-w-0">
                  {task.assignee ? (
                    <>
                      <UserAvatar profile={task.assignee} className="h-6 w-6 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {task.assignee.full_name ?? task.assignee.email}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">Unassigned</span>
                  )}
                </div>
                <div className="w-28 shrink-0 flex justify-center">
                  <StatusBadge status={task.status} />
                </div>
                <div className="w-24 shrink-0 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(task.updated_at)}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
