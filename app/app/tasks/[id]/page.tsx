'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  Send,
  X,
  File as FileIcon,
  Loader2,
  History,
  MessageSquare,
  Calendar,
  User,
  Pencil,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Check, ChevronsUpDown } from 'lucide-react';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { DatePicker } from '@/components/shared/date-picker';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { sendNotificationEmail } from '@/lib/email-client';
import { TASK_TYPES, TASK_STATUSES, TASK_PRIORITIES, getRoleLabel } from '@/lib/constants';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Task, Comment, ActivityLog, Profile, Version, Project } from '@/lib/types';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentEditLoading, setCommentEditLoading] = useState(false);
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const ACTIVITY_PAGE_SIZE = 10;
  const ACTIVITY_PREVIEW_COUNT = 5;

  const commentImageInputRef = useRef<HTMLInputElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activityCardRef = useRef<HTMLDivElement>(null);
  const chatCardRef = useRef<HTMLDivElement>(null);
  const [chatHeight, setChatHeight] = useState(420);

  // Chat card bottom = activity card bottom; chat height = activity bottom - chat top
  useEffect(() => {
    const activityEl = activityCardRef.current;
    const chatEl = chatCardRef.current;
    if (!activityEl || !chatEl) return;
    const sync = () => {
      const activityBottom = activityEl.getBoundingClientRect().bottom;
      const chatTop = chatEl.getBoundingClientRect().top;
      const h = Math.max(200, Math.round(activityBottom - chatTop));
      setChatHeight(h);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(activityEl);
    observer.observe(chatEl);
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [loading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Scroll the comment input into view on page load/refresh
  useEffect(() => {
    if (!loading && task) {
      // small delay so the layout is fully settled after data fetch
      const t = setTimeout(() => {
        commentTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [loading, task]);

  const fetchTask = useCallback(async () => {
    if (!user) return;

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
      .eq('id', taskId)
      .maybeSingle();

    if (!taskData) {
      setLoading(false);
      return;
    }

    const task = taskData as unknown as Task;
    setTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');

    const [commentsRes, activityRes, membersRes, versionsRes, ownerRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*, profile:profiles(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),
      supabase
        .from('activity_logs')
        .select('*, profile:profiles(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }),
      supabase
        .from('project_members')
        .select('profile:profiles(*)')
        .eq('project_id', task.project_id),
      supabase.from('versions').select('*').eq('project_id', task.project_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', task.project?.owner_id ?? '').maybeSingle(),
    ]);

    setComments((commentsRes.data as unknown as Comment[]) ?? []);
    setActivityLogs((activityRes.data as unknown as ActivityLog[]) ?? []);
    const memberProfiles = (membersRes.data?.map((m) => m.profile) as unknown as Profile[]) ?? [];
    // Include the project owner (may not be a project_member row)
    if (ownerRes.data && !memberProfiles.some((p) => p.id === ownerRes.data.id)) {
      memberProfiles.push(ownerRes.data as Profile);
    }
    setMembers(memberProfiles);
    setVersions((versionsRes.data as Version[]) ?? []);

    // Check my role
    const { data: myMembership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('user_id', user.id)
      .maybeSingle();
    setMyRole((myMembership as { role: string } | null)?.role ?? null);

    setLoading(false);
  }, [user, taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Realtime subscription for live comments
  useEffect(() => {
    if (!user || !taskId) return;
    const channel = supabase
      .channel(`comments:${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const newComment = payload.new as Comment;
          // Avoid duplicates: skip if this is the comment we just inserted
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newComment.user_id)
            .maybeSingle();
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [...prev, { ...newComment, profile: (profileData as Profile) ?? undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, taskId]);

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from('task-screenshots').getPublicUrl(path);
    return data.publicUrl;
  };

  const isImageType = (t: string | null) => !!t && t.startsWith('image/');
  const isVideoType = (t: string | null) => !!t && t.startsWith('video/');
  const isPdfType = (t: string | null) => t === 'application/pdf';

  // --- @mention support ---
  const mentionCandidates = members.filter((m) => {
    const q = (mentionQuery ?? '').toLowerCase();
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    const caret = commentTextareaRef.current?.selectionStart ?? value.length;
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

  const insertMention = (m: Profile) => {
    if (!commentTextareaRef.current) return;
    const caret = commentTextareaRef.current.selectionStart ?? newComment.length;
    const before = newComment.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    const after = newComment.slice(caret);
    const name = m.full_name ?? m.email;
    const next = `${before.slice(0, atIdx)}@${name} ${after}`;
    setNewComment(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const el = commentTextareaRef.current;
      if (el) {
        const pos = atIdx + name.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionCandidates.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (mentionCandidates[mentionIndex]) {
          e.preventDefault();
          insertMention(mentionCandidates[mentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setMentionOpen(false);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      addComment();
    }
  };

  const renderMessage = (text: string) => {
    const sorted = [...members].sort(
      (a, b) => (b.full_name ?? b.email).length - (a.full_name ?? a.email).length
    );
    const pattern = sorted
      .map((m) => `@${(m.full_name ?? m.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      .join('|');
    if (!pattern) return text;
    const parts = text.split(new RegExp(`(${pattern})`));
    return parts.map((part, i) => {
      const m = sorted.find((x) => `@${x.full_name ?? x.email}` === part);
      if (m) {
        const name = m.full_name ?? m.email;
        const isMe = m.id === user?.id;
        return (
          <span
            key={i}
            className={`font-semibold px-1.5 py-0.5 rounded-md text-white text-[13px] ${
              isMe ? 'bg-green-600' : 'bg-[#800000]'
            }`}
          >
            {isMe ? 'You' : name}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const addComment = async () => {
    if ((!newComment.trim() && !commentImage) || !user || !task) return;
    setCommentLoading(true);

    let imagePath: string | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;
    if (commentImage) {
      setImageUploading(true);
      const ext = commentImage.name.split('.').pop() ?? 'png';
      fileType = commentImage.type;
      fileName = commentImage.name;
      const storageName = `${task.project_id}/${taskId}/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-screenshots')
        .upload(storageName, commentImage, {
          contentType: fileType,
          cacheControl: '3600',
        });
      setImageUploading(false);
      if (uploadError) {
        toast.error(uploadError.message);
        setCommentLoading(false);
        return;
      }
      imagePath = storageName;
    }

    const { error } = await supabase.from('comments').insert({
      task_id: taskId,
      user_id: user.id,
      message: newComment.trim() || ' ',
      image_path: imagePath,
      file_type: fileType,
      file_name: fileName,
    });

    if (error) {
      toast.error(error.message);
      setCommentLoading(false);
      return;
    }

    try {
      const { error: logErr } = await supabase.from('activity_logs').insert({
        project_id: task.project_id,
        task_id: taskId,
        user_id: user.id,
        action: 'added comment',
        entity_type: 'comment',
      });
      if (logErr) throw logErr;

      const commentText = newComment.trim();
      const notifBase = {
        actor_id: user.id,
        project_id: task.project_id,
        link: `/app/tasks/${taskId}`,
      };

      // Notify mentioned users
      const mentioned = members.filter((m) => {
        const name = m.full_name ?? m.email;
        return m.id !== user.id && commentText.includes(`@${name}`);
      });
      for (const m of mentioned) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          ...notifBase,
          user_id: m.id,
          type: 'mention',
          title: `${profile?.full_name ?? profile?.email} mentioned you in #${task.number}`,
          body: commentText.slice(0, 100) || 'Sent an image',
        });
        if (notifErr) throw notifErr;
        sendNotificationEmail(
          m.email,
          `${profile?.full_name ?? profile?.email} mentioned you in #${task.number}`,
          commentText.slice(0, 200) || 'Sent an image',
          `${window.location.origin}${notifBase.link}`
        );
      }

      // Notify assignee (if not already mentioned)
      if (task.assignee_id && task.assignee_id !== user.id && !mentioned.some((m) => m.id === task.assignee_id)) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          ...notifBase,
          user_id: task.assignee_id,
          type: 'comment_added',
          title: `New comment on #${task.number}`,
          body: commentText.slice(0, 100) || 'Sent an image',
        });
        if (notifErr) throw notifErr;
        const assignee = members.find((m) => m.id === task.assignee_id);
        if (assignee) {
          sendNotificationEmail(
            assignee.email,
            `New comment on #${task.number}`,
            commentText.slice(0, 200) || 'Sent an image',
            `${window.location.origin}${notifBase.link}`
          );
        }
      }

      setNewComment('');
      setCommentImage(null);
      setCommentImagePreview(null);
      await fetchTask();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save comment');
    }
    setCommentLoading(false);
  };

  const saveCommentEdit = async () => {
    if (!editingCommentId || !user) return;
    if (!editingCommentText.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }
    setCommentEditLoading(true);
    const { error } = await supabase
      .from('comments')
      .update({ message: editingCommentText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingCommentId)
      .eq('user_id', user.id);
    setCommentEditLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingCommentId(null);
    setEditingCommentText('');
    await fetchTask();
    toast.success('Comment updated');
  };

  const updateTask = async (updates: Partial<Task>) => {
    if (!task || !user) return;
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    try {
      if (updates.status && updates.status !== task.status) {
        const { error: logErr } = await supabase.from('activity_logs').insert({
          project_id: task.project_id,
          task_id: taskId,
          user_id: user.id,
          action: `changed status from ${task.status.replace('_', ' ')} to ${updates.status.replace('_', ' ')}`,
          entity_type: 'task',
          entity_id: taskId,
          metadata: { from: task.status, to: updates.status },
        });
        if (logErr) throw logErr;

        if (task.assignee_id && task.assignee_id !== user.id) {
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id: task.assignee_id,
            actor_id: user.id,
            project_id: task.project_id,
            type: 'status_changed',
            title: `Status changed on #${task.number}`,
            body: `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
            link: `/app/tasks/${taskId}`,
          });
          if (notifErr) throw notifErr;
          const assignee = members.find((m) => m.id === task.assignee_id);
          if (assignee) {
            sendNotificationEmail(
              assignee.email,
              `Status changed on #${task.number}`,
              `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
              `${window.location.origin}/app/tasks/${taskId}`
            );
          }
        }
      }
      if (updates.assignee_id !== undefined && updates.assignee_id !== task.assignee_id) {
        const newAssigneeId = updates.assignee_id;
        if (newAssigneeId && newAssigneeId !== user.id) {
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id: newAssigneeId,
            actor_id: user.id,
            project_id: task.project_id,
            type: 'task_assigned',
            title: `Task assigned: #${task.number}`,
            body: task.title,
            link: `/app/tasks/${taskId}`,
          });
          if (notifErr) throw notifErr;
          const newAssignee = members.find((m) => m.id === newAssigneeId);
          if (newAssignee) {
            sendNotificationEmail(
              newAssignee.email,
              `Task assigned: #${task.number}`,
              task.title,
              `${window.location.origin}/app/tasks/${taskId}`
            );
          }
        }
        const { error: logErr } = await supabase.from('activity_logs').insert({
          project_id: task.project_id,
          task_id: taskId,
          user_id: user.id,
          action: 'assigned task',
          entity_type: 'task',
          entity_id: taskId,
        });
        if (logErr) throw logErr;
      }
      await fetchTask();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const saveEdit = async () => {
    await updateTask({ title: editTitle, description: editDescription || null });
    setEditing(false);
    toast.success('Task updated');
  };

  const deleteTask = async () => {
    if (!task) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Task deleted');
      router.push(`/app/projects/${task.project?.slug ?? task.project_id}`);
    }
  };

  const confirmDeleteTask = async () => {
    setDeleteTaskLoading(true);
    await deleteTask();
    setDeleteTaskLoading(false);
    setDeleteTaskOpen(false);
  };

  const canEdit = myRole === 'project_admin' || profile?.role === 'super_admin' || task?.reporter_id === user?.id;
  const canDelete = myRole === 'project_admin' || profile?.role === 'super_admin';
  const backHref = task?.version
    ? `/app/projects/${task?.project?.slug ?? task?.project_id}/versions/${task.version.slug}`
    : `/app/projects/${task?.project?.slug ?? task?.project_id}`;
  const activityPageItems = activityLogs.slice((activityPage - 1) * ACTIVITY_PAGE_SIZE, activityPage * ACTIVITY_PAGE_SIZE);
  const activityTotalPages = Math.max(1, Math.ceil(activityLogs.length / ACTIVITY_PAGE_SIZE));
  useEffect(() => {
    if (activityPage > activityTotalPages) setActivityPage(1);
  }, [activityPage, activityTotalPages]);
  const visibleActivity = showAllActivity ? activityPageItems : activityLogs.slice(0, ACTIVITY_PREVIEW_COUNT);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Task not found or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <TypeBadge type={task.type} />
          <span className="text-sm text-muted-foreground">#{task.number}</span>
        </div>
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTaskOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      {/* Delete task confirmation */}
      <ConfirmDeleteDialog
        open={deleteTaskOpen}
        onOpenChange={setDeleteTaskOpen}
        title="Delete Task"
        description={`This will permanently delete task #${task?.number} "${task?.title}" and all its comments and images. This action cannot be undone.`}
        confirmText={task?.title ?? ''}
        onConfirm={confirmDeleteTask}
        loading={deleteTaskLoading}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & description */}
          <Card className="card-hover animate-fade-in-up stagger-1">
            <CardContent className="p-6">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={6}
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditTitle(task.title); setEditDescription(task.description ?? ''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <h1 className="text-xl font-semibold tracking-tight flex-1">{task.title}</h1>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                        Edit
                      </Button>
                    )}
                  </div>
                  {task.description ? (
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{task.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-3 italic">No description provided.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card
            ref={chatCardRef}
            className="card-hover animate-fade-in-up stagger-2 flex flex-col"
            style={{ height: chatHeight }}
          >
            <CardHeader className="shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              {/* Comment list — chat style (top) */}
              {comments.length === 0 ? (
                <div className="py-10 flex-1">
                  <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-3 min-h-0">
                  {comments.map((comment) => {
                    const isMine = comment.user_id === user?.id;
                    const isEditingThis = editingCommentId === comment.id;
                    return (
                      <div key={comment.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <UserAvatar profile={comment.profile} className="h-7 w-7 shrink-0 mt-0.5" />
                        <div className={`max-w-[75%] min-w-0 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-tr-sm [&_*]:selection:bg-white [&_*]:selection:text-primary selection:bg-white selection:text-primary'
                                : 'bg-secondary/70 text-foreground rounded-tl-sm'
                            }`}
                          >
                            {comment.image_path && isImageType(comment.file_type) && (
                              <img
                                src={getImageUrl(comment.image_path)}
                                alt="comment"
                                className="rounded-lg mb-2 max-h-48 w-auto cursor-pointer"
                                onClick={() => setPreviewFile({ url: getImageUrl(comment.image_path!), type: 'image' })}
                              />
                            )}
                            {comment.image_path && isVideoType(comment.file_type) && (
                              <video
                                src={getImageUrl(comment.image_path)}
                                className="rounded-lg mb-2 max-h-64 w-auto cursor-pointer"
                                controls
                                preload="metadata"
                                onClick={() => setPreviewFile({ url: getImageUrl(comment.image_path!), type: 'video' })}
                              />
                            )}
                            {comment.image_path && isPdfType(comment.file_type) && (
                              <button
                                type="button"
                                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 mb-2 w-full text-left hover:bg-accent/50 transition-colors"
                                onClick={() => setPreviewFile({ url: getImageUrl(comment.image_path!), type: 'pdf' })}
                              >
                                <FileIcon className="h-6 w-6 text-primary shrink-0" />
                                <span className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium truncate">{comment.file_name ?? 'document.pdf'}</span>
                                  <span className="text-[11px] text-muted-foreground">PDF document — click to view</span>
                                </span>
                              </button>
                            )}
                            {comment.image_path && !comment.file_type && (
                              <img
                                src={getImageUrl(comment.image_path)}
                                alt="comment"
                                className="rounded-lg mb-2 max-h-48 w-auto cursor-pointer"
                                onClick={() => setPreviewFile({ url: getImageUrl(comment.image_path!), type: 'image' })}
                              />
                            )}
                            {isEditingThis ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  rows={2}
                                  className="bg-background text-foreground text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-primary-foreground hover:text-primary-foreground hover:bg-primary/80"
                                    onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={saveCommentEdit}
                                    disabled={commentEditLoading || !editingCommentText.trim()}
                                  >
                                    {commentEditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {comment.message.trim() !== '' && comment.message.trim() !== ' ' && (
                                  <p>{renderMessage(comment.message)}</p>
                                )}
                                {comment.edited_at && (
                                  <span className={`block mt-1 text-[10px] ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    (edited)
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className={`flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="font-medium">
                              {comment.profile?.full_name ?? comment.profile?.email}
                            </span>
                            <span>{formatRelativeTime(comment.created_at)}</span>
                            {isMine && !isEditingThis && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditingCommentText(comment.message.trim() === ' ' ? '' : comment.message);
                                }}
                                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                title="Edit message"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* New comment (bottom) */}
              <div className="flex gap-3 border-t border-border/60 p-4 shrink-0">
                <UserAvatar profile={profile} className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  {commentImagePreview && commentImage && (
                    <div className="relative inline-block max-w-[320px]">
                      {isImageType(commentImage.type) ? (
                        <img
                          src={commentImagePreview}
                          alt="Attached"
                          className="h-24 w-24 object-cover rounded-lg border border-border"
                        />
                      ) : isVideoType(commentImage.type) ? (
                        <video
                          src={commentImagePreview}
                          className="h-28 rounded-lg border border-border"
                          controls
                          muted
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
                          <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate max-w-[200px]">{commentImage.name}</span>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => { setCommentImage(null); setCommentImagePreview(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="relative">
                    <Textarea
                      ref={commentTextareaRef}
                      placeholder="Write a comment... use @ to mention someone"
                      value={newComment}
                      onChange={(e) => handleCommentChange(e.target.value)}
                      onKeyDown={handleMentionKeyDown}
                      rows={3}
                    />
                    {mentionOpen && mentionCandidates.length > 0 && (
                      <div className="absolute bottom-full mb-2 w-72 rounded-xl border border-border bg-popover shadow-elevated z-20 overflow-hidden animate-fade-in-scale">
                        <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                          Mention someone
                        </p>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {mentionCandidates.map((m, i) => (
                            <button
                              key={m.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        ref={commentImageInputRef}
                        type="file"
                        accept="image/*,video/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const ok = f.type.startsWith('image/') || f.type.startsWith('video/') || f.type === 'application/pdf';
                            if (!ok) {
                              toast.error('Only images, videos and PDF files are allowed');
                              return;
                            }
                            if (f.size > 50 * 1024 * 1024) {
                              toast.error('File too large (max 50 MB)');
                              return;
                            }
                            setCommentImage(f);
                            setCommentImagePreview(URL.createObjectURL(f));
                          }
                          if (commentImageInputRef.current) commentImageInputRef.current.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => commentImageInputRef.current?.click()}
                        disabled={imageUploading}
                      >
                        {imageUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileIcon className="h-4 w-4 mr-2" />
                        )}
                        {imageUploading ? 'Uploading...' : 'Attach'}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={addComment}
                      disabled={(!newComment.trim() && !commentImage) || commentLoading || imageUploading}
                    >
                      {commentLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 text-right">
                    <kbd className="px-1 py-0.5 rounded border border-border/60 bg-secondary/50 text-[10px] font-mono">Ctrl</kbd>
                    {' + '}
                    <kbd className="px-1 py-0.5 rounded border border-border/60 bg-secondary/50 text-[10px] font-mono">Enter</kbd>
                    {' '}to send
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="card-hover animate-fade-in-up stagger-2">
            <CardHeader>
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select
                  value={task.status}
                  onValueChange={(v) => updateTask({ status: v as Task['status'] })}
                  disabled={!canEdit && myRole !== 'developer'}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select
                  value={task.priority}
                  onValueChange={(v) => updateTask({ priority: v as Task['priority'] })}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select
                  value={task.type}
                  onValueChange={(v) => updateTask({ type: v as Task['type'] })}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={assigneeOpen}
                      disabled={!canEdit}
                      className="w-full justify-between font-normal h-9"
                    >
                      {task.assignee
                        ? task.assignee.full_name ?? task.assignee.email
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
                              updateTask({ assignee_id: null });
                              setAssigneeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !task.assignee_id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            Unassigned
                          </CommandItem>
                          {members.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={`${m.full_name ?? ''} ${m.email}`}
                              onSelect={() => {
                                updateTask({ assignee_id: m.id });
                                setAssigneeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  task.assignee_id === m.id ? 'opacity-100' : 'opacity-0'
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

              {/* Version */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Version</label>
                <Select
                  value={task.version_id ?? 'none'}
                  onValueChange={(v) => updateTask({ version_id: v === 'none' ? null : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No version</SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Due Date</label>
                <DatePicker
                  value={task.due_date ?? ''}
                  onChange={(v) => updateTask({ due_date: v || null })}
                  disabled={!canEdit}
                  placeholder="No due date"
                  className="h-9"
                />
              </div>

              {/* Reporter */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Reporter</label>
                <div className="flex items-center gap-2">
                  <UserAvatar profile={task.reporter} className="h-6 w-6" />
                  <span className="text-sm">{task.reporter?.full_name ?? task.reporter?.email}</span>
                </div>
              </div>

              {/* Created date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Created
                </label>
                <p className="text-sm">{formatDate(task.created_at)}</p>
              </div>

              {/* Updated date */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Updated</label>
                <p className="text-sm">{formatRelativeTime(task.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card ref={activityCardRef} className="card-hover animate-fade-in-up stagger-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Activity
              </CardTitle>
              {activityLogs.length > ACTIVITY_PREVIEW_COUNT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowAllActivity((s) => !s)}
                >
                  {showAllActivity ? 'Show less' : `View all (${activityLogs.length})`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleActivity.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <UserAvatar profile={log.profile} className="h-5 w-5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {log.profile?.full_name ?? log.profile?.email}
                            </span>{' '}
                            {log.action}
                          </span>
                          <p className="text-muted-foreground mt-0.5">{formatRelativeTime(log.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {showAllActivity && (
                    <PaginationControls
                      page={activityPage}
                      pageSize={ACTIVITY_PAGE_SIZE}
                      total={activityLogs.length}
                      onPageChange={setActivityPage}
                      className="pt-3"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* File preview modal */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>
              {previewFile?.type === 'image' ? 'Image preview' : previewFile?.type === 'video' ? 'Video preview' : 'PDF preview'}
            </DialogTitle>
            {previewFile && (
              <a
                href={previewFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Open / Download
              </a>
            )}
          </DialogHeader>
          {previewFile?.type === 'image' && (
            <img src={previewFile.url} alt="Full preview" className="w-full h-auto rounded-lg" />
          )}
          {previewFile?.type === 'video' && (
            <video src={previewFile.url} className="w-full h-auto rounded-lg" controls autoPlay />
          )}
          {previewFile?.type === 'pdf' && (
            <iframe src={previewFile.url} title="PDF preview" className="w-full h-[70vh] rounded-lg border border-border/60" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
