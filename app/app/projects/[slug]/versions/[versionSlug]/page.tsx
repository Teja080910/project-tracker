'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tag, Plus, Calendar, Search, Settings, Loader2, Check, ChevronsUpDown, File as FileIcon, X } from 'lucide-react';
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
import { BackButton } from '@/components/shared/back-button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { DatePicker } from '@/components/shared/date-picker';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { sendPushToUser } from '@/lib/push';
import { sendNotificationEmail } from '@/lib/email-client';
import { getVersionStatusMeta, TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Version, Task, Project, Profile } from '@/lib/types';

export default function VersionDetailPage() {
  return (
    <Suspense fallback={null}>
      <VersionDetailContent />
    </Suspense>
  );
}

function VersionDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const projectSlug = params.slug as string;
  const versionSlug = params.versionSlug as string;

  const [version, setVersion] = useState<Version | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [filterStatus, setFilterStatus] = useState<string>(() => searchParams.get('status') ?? 'all');
  const [filterType, setFilterType] = useState<string>(() => searchParams.get('type') ?? 'all');
  const [filterPriority, setFilterPriority] = useState<string>(() => searchParams.get('priority') ?? 'all');
  const [filterAssignee, setFilterAssignee] = useState<string>(() => searchParams.get('assignee') ?? 'all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReleaseDate, setEditReleaseDate] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'all') sp.delete(key);
        else sp.set(key, value);
      }
      const qs = sp.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, router]
  );

  // New task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskComment, setTaskComment] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState('none');
  const [taskAssigneeOpen, setTaskAssigneeOpen] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskCreating, setTaskCreating] = useState(false);
  const [taskCommentFile, setTaskCommentFile] = useState<File | null>(null);
  const [taskCommentPreview, setTaskCommentPreview] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const taskCommentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const taskCommentFileInputRef = useRef<HTMLInputElement>(null);
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
      t.assignee?.email === filterAssignee;
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

  const isImageAttachment = (t: string) => t.startsWith('image/');
  const isVideoAttachment = (t: string) => t.startsWith('video/');
  const isMarkdownAttachment = (t: string, name: string) =>
    t === 'text/markdown' || t === 'text/x-markdown' || t === 'application/markdown' || /\.(md|markdown)$/i.test(name);

  const taskMentionCandidates = members.filter((m) => {
    const q = (mentionQuery ?? '').toLowerCase();
    return (m.full_name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const handleTaskCommentChange = (value: string) => {
    setTaskComment(value);
    const caret = taskCommentTextareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === before.length - 1) {
      setMentionQuery('');
      setMentionIndex(0);
      setMentionOpen(true);
    } else if (atIdx !== -1 && /^[a-zA-Z0-9._-]*$/.test(before.slice(atIdx + 1))) {
      setMentionQuery(before.slice(atIdx + 1));
      setMentionIndex(0);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertTaskMention = (m: Profile) => {
    const el = taskCommentTextareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? taskComment.length;
    const before = taskComment.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    const after = taskComment.slice(caret);
    const name = m.full_name ?? m.email;
    const next = `${before.slice(0, atIdx)}@${name} ${after}`;
    setTaskComment(next);
    setMentionOpen(false);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = atIdx + name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleTaskCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(Math.min(mentionIndex + 1, taskMentionCandidates.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(Math.max(mentionIndex - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (taskMentionCandidates[mentionIndex]) {
          e.preventDefault();
          insertTaskMention(taskMentionCandidates[mentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setMentionOpen(false);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      createTask();
    }
  };

  const createTask = async () => {
    if (!user || !project || !version) return;
    if (!taskTitle.trim()) {
      toast.error('Task title is required');
      return;
    }
    setTaskCreating(true);

    // number is assigned by the tasks_number_seq sequence
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: taskTitle.trim(),
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
      const commentText = taskComment.trim();
      if (commentText || taskCommentFile) {
        let imagePath: string | null = null;
        let fileType: string | null = null;
        let fileName: string | null = null;
        if (taskCommentFile) {
          const ext = taskCommentFile.name.split('.').pop() ?? 'png';
          fileType = taskCommentFile.type || (isMarkdownAttachment('', taskCommentFile.name) ? 'text/markdown' : null);
          fileName = taskCommentFile.name;
          const storageName = `${project.id}/${data.id}/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('task-screenshots')
            .upload(storageName, taskCommentFile, {
              contentType: fileType ?? undefined,
              cacheControl: '3600',
            });
          if (uploadError) throw uploadError;
          imagePath = storageName;
        }
        const { error: commentErr } = await supabase.from('comments').insert({
          task_id: data.id,
          user_id: user.id,
          message: commentText || ' ',
          image_path: imagePath,
          file_type: fileType,
          file_name: fileName,
        });
        if (commentErr) throw commentErr;

        const projectSuffix = ` · ${project.name}`;
        const mentioned = members.filter(
          (m) => m.id !== user.id && commentText.includes(`@${m.full_name ?? m.email}`)
        );
        for (const m of mentioned) {
          const title = `${profile?.full_name ?? profile?.email} mentioned you in #${data.number}${projectSuffix}`;
          await supabase.from('notifications').insert({
            user_id: m.id,
            actor_id: user.id,
            project_id: project.id,
            type: 'mention',
            title,
            body: commentText.slice(0, 100) || 'Sent an attachment',
            link: `/app/tasks/${data.number}`,
            priority: taskPriority,
          });
          sendNotificationEmail(
            m.email,
            title,
            commentText.slice(0, 200) || 'Sent an attachment',
            `${window.location.origin}/app/tasks/${data.number}`
          );
          sendPushToUser(m.id, title, commentText.slice(0, 100) || 'Sent an attachment', `/app/tasks/${data.number}`);
        }
      }

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
          title: `New ${taskType} assigned: #${data.number} · ${project.name}`,
          body: taskTitle.trim(),
          link: `/app/tasks/${data.number}`,
          priority: taskPriority,
        });
        sendPushToUser(
          taskAssigneeId,
          `New ${taskType} assigned: #${data.number} · ${project.name}`,
          taskTitle.trim(),
          `/app/tasks/${data.number}`
        );
      }

      setTaskModalOpen(false);
      setTaskTitle('');
      setTaskComment('');
      setTaskCommentFile(null);
      setTaskCommentPreview(null);
      setMentionOpen(false);
      setMentionQuery(null);
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
      <div className="flex flex-col gap-3 animate-fade-in-up sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <BackButton fallbackHref={`/app/projects/${projectSlug}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Tag className="h-4.5 w-4.5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{version.name}</h1>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 bg-${vMeta.color}-500/10 text-${vMeta.color}-600 dark:text-${vMeta.color}-400 border-${vMeta.color}-500/20`}
              >
                {vMeta.label}
              </Badge>
            </div>
            {project && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                <Link href={`/app/projects/${projectSlug}`} className="hover:underline">
                  {project.name}
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
            setEditName(version.name);
            setEditDescription(version.description ?? '');
            setEditReleaseDate(version.release_date ?? '');
            setEditStatus(version.status);
            setSettingsOpen(true);
          }}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setTaskModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* New Task modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2 min-w-0">
              <label className="text-sm font-medium block">Comment</label>
              {taskCommentPreview && taskCommentFile && (
                <div className="relative inline-block max-w-full">
                  {isImageAttachment(taskCommentFile.type) ? (
                    <img
                      src={taskCommentPreview}
                      alt="Attached"
                      className="h-24 w-24 object-cover rounded-lg border border-border"
                    />
                  ) : isVideoAttachment(taskCommentFile.type) ? (
                    <video
                      src={taskCommentPreview}
                      className="h-28 rounded-lg border border-border"
                      controls
                      muted
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
                      <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate min-w-0 max-w-[200px]">{taskCommentFile.name}</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => {
                      setTaskCommentFile(null);
                      setTaskCommentPreview(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="relative">
                <Textarea
                  ref={taskCommentTextareaRef}
                  value={taskComment}
                  onChange={(e) => handleTaskCommentChange(e.target.value)}
                  onKeyDown={handleTaskCommentKeyDown}
                  rows={3}
                  placeholder="Add a comment... use @ to mention someone (optional)"
                />
                {mentionOpen && taskMentionCandidates.length > 0 && (
                  <div className="absolute bottom-full mb-2 w-72 rounded-xl border border-border bg-popover shadow-elevated z-20 overflow-hidden animate-fade-in-scale">
                    <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                      Mention someone
                    </p>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {taskMentionCandidates.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertTaskMention(m);
                          }}
                          onMouseEnter={() => setMentionIndex(i)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                            i === mentionIndex ? 'bg-accent text-accent-foreground' : ''
                          }`}
                        >
                          <UserAvatar profile={m} className="h-6 w-6 shrink-0" />
                          <span className="flex flex-col min-w-0">
                            <span className="truncate">{m.full_name ?? m.email}</span>
                            {m.full_name && (
                              <span className="text-[11px] text-muted-foreground truncate">{m.email}</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={taskCommentFileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf,.md,.markdown,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const ok =
                        f.type.startsWith('image/') ||
                        f.type.startsWith('video/') ||
                        f.type === 'application/pdf' ||
                        isMarkdownAttachment(f.type, f.name);
                      if (!ok) {
                        toast.error('Only images, videos, PDF and Markdown (.md) files are allowed');
                        return;
                      }
                      if (f.size > 50 * 1024 * 1024) {
                        toast.error('File too large (max 50 MB)');
                        return;
                      }
                      setTaskCommentFile(f);
                      setTaskCommentPreview(URL.createObjectURL(f));
                    }
                    if (taskCommentFileInputRef.current) taskCommentFileInputRef.current.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => taskCommentFileInputRef.current?.click()}
                >
                  <FileIcon className="h-4 w-4 mr-2" />
                  Attach
                </Button>
                {taskCommentFile && (
                  <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">{taskCommentFile.name}</span>
                )}
              </div>
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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center animate-fade-in-up stagger-1">
        <div className="relative col-span-2 sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParams({ q: e.target.value });
            }}
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(v);
            setPage(1);
            updateParams({ status: v });
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterType}
          onValueChange={(v) => {
            setFilterType(v);
            setPage(1);
            updateParams({ type: v });
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterPriority}
          onValueChange={(v) => {
            setFilterPriority(v);
            setPage(1);
            updateParams({ priority: v });
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterAssignee}
          onValueChange={(v) => {
            setFilterAssignee(v);
            setPage(1);
            updateParams({ assignee: v });
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {assignees.map((m) => (
              <SelectItem key={m.id} value={m.email}>{m.full_name ?? m.email}</SelectItem>
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
              href={`/app/tasks/${task.number}`}
              className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2.5 sm:py-2 rounded-lg hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-soft group row-hover"
            >
              <TypeBadge type={task.type} />
              <span className="text-xs text-muted-foreground shrink-0">#{task.number}</span>
              <span className="text-sm order-first basis-full truncate sm:order-none sm:basis-auto sm:flex-1">{task.title}</span>
              <PriorityBadge priority={task.priority} />
              {task.assignee && <UserAvatar profile={task.assignee} className="hidden sm:block h-6 w-6" />}
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
