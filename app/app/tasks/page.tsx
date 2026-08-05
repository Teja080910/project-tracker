'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, ListTodo, ArrowRight } from 'lucide-react';
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
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import type { Task, Project } from '@/lib/types';

export default function TasksPage() {
  const { user, profile } = useAuth();
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

  const fetchTasks = useCallback(async () => {
    if (!user) return;

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
  }, [user, profile]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesProject = filterProject === 'all' || t.project_id === filterProject;
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesAssignee =
      filterAssignee === 'all' ||
      (filterAssignee === 'unassigned' && !t.assignee_id) ||
      t.assignee_id === filterAssignee;
    return matchesSearch && matchesProject && matchesStatus && matchesType && matchesPriority && matchesAssignee;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {tasks.length} tasks</p>
        </div>
        <Button asChild className="animate-fade-in-scale">
          <Link href="/app/tasks/new">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Link>
        </Button>
      </div>

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
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <div className="space-y-1">
          {filtered.map((task, i) => (
            <Link
              key={task.id}
              href={`/app/tasks/${task.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-soft group animate-fade-in-up stagger-${Math.min(i + 1, 7)} row-hover`}
            >
              <TypeBadge type={task.type} />
              <span className="text-xs text-muted-foreground">#{task.number}</span>
              <span className="text-sm flex-1 truncate group-hover:text-foreground transition-colors duration-200">{task.title}</span>
              {task.project && (
                <span className="text-xs text-muted-foreground hidden md:inline">{task.project.name}</span>
              )}
              <PriorityBadge priority={task.priority} />
              {task.assignee && <UserAvatar profile={task.assignee} className="h-6 w-6" />}
              <StatusBadge status={task.status} />
              <span className="text-xs text-muted-foreground hidden lg:inline">{formatRelativeTime(task.updated_at)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
