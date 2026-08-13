'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, ListTodo, ChevronLeft, ChevronRight, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/lib/types';

export default function CalendarPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const fetchTasks = useCallback(async () => {
    if (!user || !profile) return;

    let projectIds: string[] = [];
    if (profile?.role === 'super_admin') {
      const { data: allProjects } = await supabase.from('projects').select('id');
      projectIds = (allProjects ?? []).map((p) => (p as { id: string }).id);
    } else {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);
      projectIds = memberships?.map((m) => m.project_id) ?? [];
    }

    if (projectIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .in('project_id', projectIds)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true });

    setTasks((data as unknown as Task[]) ?? []);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Group tasks by due date (YYYY-MM-DD)
  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date;
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(t);
  }

  const selectedKey = selectedDate
    ? selectedDate.toISOString().slice(0, 10)
    : '';
  const selectedTasks = selectedKey ? (tasksByDate.get(selectedKey) ?? []) : [];

  // Counts for month view
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter((t) => t.due_date?.startsWith(monthKey));

  const goToToday = () => {
    const today = new Date();
    setMonth(today);
    setSelectedDate(today);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {monthTasks.length} tasks with due dates in {month.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 card-hover animate-fade-in-up stagger-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {month.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={month}
              onMonthChange={setMonth}
              className="w-full"
              modifiers={{
                hasTasks: (date) => {
                  const key = date.toISOString().slice(0, 10);
                  return tasksByDate.has(key);
                },
              }}
              modifiersClassNames={{
                hasTasks: 'relative',
              }}
              components={{
                DayContent: ({ date }) => {
                  const key = date.toISOString().slice(0, 10);
                  const dayTasks = tasksByDate.get(key) ?? [];
                  const isSelected = selectedDate && key === selectedDate.toISOString().slice(0, 10);
                  return (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      <span>{date.getDate()}</span>
                      {dayTasks.length > 0 && (
                        <span
                          className={`mt-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                            isSelected
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                  );
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Selected day tasks */}
        <Card className="card-hover animate-fade-in-up stagger-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              {selectedDate ? formatDate(selectedDate.toISOString()) : 'Select a day'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTasks.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No tasks due"
                description="No tasks have a due date on this day"
              />
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {selectedTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/tasks/${task.id}`}
                    className="block p-3 rounded-lg border border-border/60 hover:border-primary/25 hover:shadow-soft transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <TypeBadge type={task.type} />
                      <span className="text-xs text-muted-foreground font-mono">#{task.number}</span>
                    </div>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {task.title}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        {task.project && (
                          <span className="flex items-center gap-1 min-w-0">
                            <FolderKanban className="h-3 w-3 shrink-0" />
                            <span className="truncate">{task.project.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                    {task.assignee && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                        <UserAvatar profile={task.assignee} className="h-4 w-4" />
                        {task.assignee.full_name ?? task.assignee.email}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
