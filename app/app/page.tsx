'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleSlash,
  ListTodo,
  ArrowRight,
  Activity,
  TrendingUp,
  Plus,
  Clock,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusBadge, TypeBadge } from '@/components/shared/badges';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime } from '@/lib/utils';
import type { Task, Project } from '@/lib/types';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  myTasks: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myAssignedTasks, setMyAssignedTasks] = useState<Task[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user || !profile) return;

    const [projectsRes, activeProjectsRes, myProjectsRes] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      profile?.role === 'super_admin'
        ? supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5)
        : supabase
            .from('project_members')
            .select('project:projects(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
    ]);

    const recentProjectsData =
      (profile?.role === 'super_admin'
        ? (myProjectsRes.data as unknown as Project[])
        : (myProjectsRes.data?.map((m) => m.project) as unknown as Project[])) ?? [];
    setRecentProjects(recentProjectsData);

    const projectIds = recentProjectsData.map((p) => p.id);

    let openTasks = 0,
      inProgressTasks = 0,
      completedTasks = 0,
      cancelledTasks = 0;

    if (projectIds.length > 0) {
      const [openRes, inProgressRes, completedRes, cancelledRes] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('project_id', projectIds).eq('status', 'open'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('project_id', projectIds).eq('status', 'in_progress'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('project_id', projectIds).eq('status', 'completed'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('project_id', projectIds).eq('status', 'cancelled'),
      ]);
      openTasks = openRes.count ?? 0;
      inProgressTasks = inProgressRes.count ?? 0;
      completedTasks = completedRes.count ?? 0;
      cancelledTasks = cancelledRes.count ?? 0;
    }

    setStats({
      totalProjects: projectsRes.count ?? 0,
      activeProjects: activeProjectsRes.count ?? 0,
      openTasks,
      inProgressTasks,
      completedTasks,
      cancelledTasks,
      myTasks: 0,
    });

    const [myTasksRes, recentTasksRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, project:projects(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
        .eq('assignee_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('tasks')
        .select('*, project:projects(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
        .in('project_id', projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'])
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

    const myTasksData = (myTasksRes.data ?? []) as unknown as Task[];
    setMyAssignedTasks(myTasksData);
    setRecentTasks((recentTasksRes.data ?? []) as unknown as Task[]);

    if (stats) {
      setStats((prev) => ({ ...prev!, myTasks: myTasksData.length }));
    }

    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Projects', value: stats?.totalProjects ?? 0, icon: FolderKanban, gradient: 'from-blue-500/20 to-blue-600/10', iconBg: 'bg-blue-500/10 text-blue-500', ring: 'ring-blue-500/20' },
    { label: 'Active Projects', value: stats?.activeProjects ?? 0, icon: TrendingUp, gradient: 'from-green-500/20 to-green-600/10', iconBg: 'bg-green-500/10 text-green-500', ring: 'ring-green-500/20' },
    { label: 'My Tasks', value: stats?.myTasks ?? 0, icon: ListTodo, gradient: 'from-amber-500/20 to-amber-600/10', iconBg: 'bg-amber-500/10 text-amber-500', ring: 'ring-amber-500/20' },
    { label: 'Open', value: stats?.openTasks ?? 0, icon: Circle, gradient: 'from-gray-500/20 to-gray-600/10', iconBg: 'bg-gray-500/10 text-gray-500', ring: 'ring-gray-500/20' },
    { label: 'In Progress', value: stats?.inProgressTasks ?? 0, icon: CircleDot, gradient: 'from-blue-500/20 to-indigo-600/10', iconBg: 'bg-blue-500/10 text-blue-500', ring: 'ring-blue-500/20' },
    { label: 'Completed', value: stats?.completedTasks ?? 0, icon: CheckCircle2, gradient: 'from-green-500/20 to-emerald-600/10', iconBg: 'bg-green-500/10 text-green-500', ring: 'ring-green-500/20' },
    { label: 'Cancelled', value: stats?.cancelledTasks ?? 0, icon: CircleSlash, gradient: 'from-red-500/20 to-rose-600/10', iconBg: 'bg-red-500/10 text-red-500', ring: 'ring-red-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, <span className="font-medium text-foreground">{profile?.full_name?.split(' ')[0] ?? profile?.email}</span>
          </p>
        </div>
        <Button asChild className="h-9 gap-2 shadow-glow">
          <Link href="/app/tasks/new">
            <Plus className="h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`card-hover animate-fade-in-up stagger-${Math.min(i + 1, 7)} relative overflow-hidden group border-border/60`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">{card.label}</CardTitle>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.iconBg} transition-all duration-200 group-hover:scale-110 group-hover:shadow-glow`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-2xl font-bold tabular-nums tracking-tight">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Task Lists */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* My assigned tasks */}
        <Card className="animate-fade-in-up stagger-5 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Activity className="h-3.5 w-3.5" />
              </div>
              My Assigned Tasks
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{myAssignedTasks.length} tasks</span>
              <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
                <Link href="/app/projects">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {myAssignedTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No assigned tasks"
                description="Tasks assigned to you will appear here"
              />
            ) : (
              myAssignedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/tasks/${task.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all duration-200 group row-hover"
                >
                  <TypeBadge type={task.type} />
                  <span className="text-xs text-muted-foreground font-mono">#{task.number}</span>
                  <span className="text-sm flex-1 truncate font-medium">{task.title}</span>
                  <StatusBadge status={task.status} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recently updated tasks */}
        <Card className="animate-fade-in-up stagger-6 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                <Clock className="h-3.5 w-3.5" />
              </div>
              Recently Updated
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{recentTasks.length} tasks</span>
              <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
                <Link href="/app/projects">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {recentTasks.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Recently updated tasks will appear here"
              />
            ) : (
              recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/tasks/${task.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-all duration-200 group row-hover"
                >
                  <TypeBadge type={task.type} />
                  <span className="text-xs text-muted-foreground font-mono">#{task.number}</span>
                  <span className="text-sm flex-1 truncate font-medium">{task.title}</span>
                  <span className="text-xs text-muted-foreground/60">{formatRelativeTime(task.updated_at)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card className="animate-fade-in-up stagger-7 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="h-3.5 w-3.5" />
            </div>
            Recent Projects
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
            <Link href="/app/projects">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to get started"
              action={
                <Button size="sm" asChild>
                  <Link href="/app/projects/new">New Project</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.slug}`}
                  className="block p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-all duration-200 group card-hover bg-card/50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:scale-110 group-hover:shadow-glow">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm group-hover:text-foreground block truncate">{project.name}</span>
                      {project.client_name && (
                        <span className="text-[10px] text-muted-foreground">{project.client_name}</span>
                      )}
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{project.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground/60">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(project.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
