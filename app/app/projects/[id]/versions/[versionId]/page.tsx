'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Plus, Calendar, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { getVersionStatusMeta, TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { Version, Task, Project } from '@/lib/types';

export default function VersionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<Version | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [versionRes, projectRes] = await Promise.all([
      supabase.from('versions').select('*').eq('id', versionId).maybeSingle(),
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
    ]);

    setVersion(versionRes.data as Version | null);
    setProject(projectRes.data as Project | null);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false });

    setTasks((tasksData as unknown as Task[]) ?? []);
    setLoading(false);
  }, [user, projectId, versionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

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
          <Link href={`/app/projects/${projectId}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  const vMeta = getVersionStatusMeta(version.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href={`/app/projects/${projectId}`}>
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
              <Link href={`/app/projects/${projectId}`} className="hover:underline">
                {project.name}
              </Link>
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={`/app/tasks/new?project=${projectId}&version=${versionId}`}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Link>
        </Button>
      </div>

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
                  <Button size="sm" asChild>
                    <Link href={`/app/tasks/new?project=${projectId}&version=${versionId}`}>
                      New Task
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((task) => (
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
    </div>
  );
}
