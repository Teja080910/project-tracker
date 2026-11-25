'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
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
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  DialogFooter,
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
import {
  Check,
  ChevronsUpDown,
  SmilePlus,
  RotateCcw,
  Copy,
  CornerDownRight,
  CornerUpLeft,
  ChevronDown,
  ChevronUp,
  Reply,
  ListChecks,
  Plus,
} from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { DatePicker } from '@/components/shared/date-picker';
import { platform } from '@/lib/platform/client';
import { useAuth } from '@/lib/auth-context';
import { isGlobalAdmin } from '@/lib/access';
import { sendNotificationEmail } from '@/lib/email-client';
import { sendPushToUser } from '@/lib/push';
import { TASK_TYPES, TASK_STATUSES, TASK_PRIORITIES, getRoleLabel, canTransitionStatus } from '@/lib/constants';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Task, Comment, CommentReaction, ActivityLog, Profile, Version, Project, TaskTestCase } from '@/lib/types';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏'];

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const taskParam = params.id as string;
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const [taskId, setTaskId] = useState('');

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [commentFiles, setCommentFiles] = useState<{ file: File; url: string }[]>([]);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editMentionQuery, setEditMentionQuery] = useState<string | null>(null);
  const [editMentionIndex, setEditMentionIndex] = useState(0);
  const [editMentionOpen, setEditMentionOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentEditLoading, setCommentEditLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [commentDeleteLoading, setCommentDeleteLoading] = useState(false);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [deleteTaskLoading, setDeleteTaskLoading] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [parentTask, setParentTask] = useState<Pick<Task, 'id' | 'number' | 'title'> | null>(null);
  const [testCases, setTestCases] = useState<TaskTestCase[]>([]);
  const [newTestCase, setNewTestCase] = useState('');
  const [newTestCaseDescription, setNewTestCaseDescription] = useState('');
  const [editingTestCase, setEditingTestCase] = useState<string | null>(null);
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskCreating, setSubtaskCreating] = useState(false);
  const [subtaskFormOpen, setSubtaskFormOpen] = useState(false);
  const ACTIVITY_PAGE_SIZE = 10;
  const ACTIVITY_PREVIEW_COUNT = 1;

  const commentImageInputRef = useRef<HTMLInputElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editCommentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsListRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<string | null>(null);

  // Keep the comment list scrolled to the latest message (scrolls only the list, never the page)
  useEffect(() => {
    const el = commentsListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const fetchTask = useCallback(async () => {
    if (!user) return;

    const query = platform
      .from('tasks')
      .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)');
    const { data: taskData } = isUuid(taskParam)
      ? await query.eq('id', taskParam).maybeSingle()
      : await query.eq('number', parseInt(taskParam, 10)).maybeSingle();
    if (!taskData) {
      setLoading(false);
      return;
    }

    const resolvedTaskId = taskData.id;
    setTaskId(resolvedTaskId);

    const task = taskData as unknown as Task;
    setTask(task);
    setEditTitle(task.title);

    // Opening a task clears the unread notifications that point at it,
    // whether it was opened from the bell or from any other link.
    if (markedReadRef.current !== String(task.number)) {
      markedReadRef.current = String(task.number);
      void platform
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('link', `/app/tasks/${task.number}`)
        .eq('read', false);
    }

    const [commentsRes, activityRes, membersRes, versionsRes, ownerRes, myMembershipRes, teamMembershipRes, teamMembersRes, subtasksRes, parentTaskRes, testCasesRes] = await Promise.all([
      platform
        .from('comments')
        .select('*, profile:profiles(*)')
        .eq('task_id', resolvedTaskId)
        .order('created_at', { ascending: true }),
      platform
        .from('activity_logs')
        .select('*, profile:profiles(*)')
        .eq('task_id', resolvedTaskId)
        .order('created_at', { ascending: false }),
      platform
        .from('project_members')
        .select('profile:profiles(*)')
        .eq('project_id', task.project_id),
      platform.from('versions').select('*').eq('project_id', task.project_id).order('created_at', { ascending: false }),
      platform.from('profiles').select('*').eq('id', task.project?.owner_id ?? '').maybeSingle(),
      platform
        .from('project_members')
        .select('role')
        .eq('project_id', task.project_id)
        .eq('user_id', user.id)
        .maybeSingle(),
      task.project?.team_id
        ? platform
            .from('team_members')
            .select('role')
            .eq('team_id', task.project.team_id)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      task.project?.team_id
        ? platform
            .from('team_members')
            .select('profile:profiles(*)')
            .eq('team_id', task.project.team_id)
        : Promise.resolve({ data: [] }),
      platform
        .from('tasks')
        .select('*, assignee:profiles!assignee_id(*)')
        .eq('parent_id', resolvedTaskId)
        .order('created_at', { ascending: true }),
      task.parent_id
        ? platform.from('tasks').select('id, number, title').eq('id', task.parent_id).maybeSingle()
        : Promise.resolve({ data: null }),
      platform
        .from('task_test_cases')
        .select('*')
        .eq('task_id', resolvedTaskId)
        .order('created_at'),
    ]);

    const myMembership = (myMembershipRes.data as { role: string } | null) ?? null;
    const myTeamMembership = (teamMembershipRes.data as { role: string } | null) ?? null;
    if (!isGlobalAdmin(profile) && !myMembership && !myTeamMembership) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    setMyRole(myMembership?.role ?? null);
    setTeamRole(myTeamMembership?.role ?? null);

    setSubtasks(
      ((subtasksRes.data as unknown as Task[]) ?? []).filter((row) => !row.deleted_at)
    );
    setParentTask((parentTaskRes.data as Pick<Task, 'id' | 'number' | 'title'> | null) ?? null);
    setTestCases((testCasesRes.data as unknown as TaskTestCase[]) ?? []);

    const commentRows = (commentsRes.data as unknown as Comment[]) ?? [];
    setComments(commentRows);
    const commentIds = commentRows.map((c: any) => c.id);
    if (commentIds.length > 0) {
      const { data: reactionRows } = await platform
        .from('comment_reactions')
        .select('*')
        .in('comment_id', commentIds);
      setReactions((reactionRows as CommentReaction[]) ?? []);
    } else {
      setReactions([]);
    }
    setActivityLogs((activityRes.data as unknown as ActivityLog[]) ?? []);
    const memberProfiles = (membersRes.data?.map((m: any) => m.profile) as unknown as Profile[]) ?? [];
    for (const row of (teamMembersRes.data ?? []) as Array<{ profile?: Profile }>) {
      if (row.profile && !memberProfiles.some((p) => p.id === row.profile!.id)) {
        memberProfiles.push(row.profile);
      }
    }
    // Include the project owner (may not be a project_member row)
    if (ownerRes.data && !memberProfiles.some((p: any) => p.id === ownerRes.data.id)) {
      memberProfiles.push(ownerRes.data as Profile);
    }
    // Include the reporter (ticket creator) so they can always be mentioned
    if (task.reporter && !memberProfiles.some((p: any) => p.id === task.reporter?.id)) {
      memberProfiles.push(task.reporter as Profile);
    }
    setMembers(memberProfiles);
    setVersions((versionsRes.data as Version[]) ?? []);

    setLoading(false);
  }, [user?.id, taskParam, profile?.role]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // Realtime subscription for live comments
  useEffect(() => {
    if (!user || !taskId) return;
    const channel = platform
      .channel(`comments:${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${taskId}` },
        async (payload) => {
          const newComment = payload.new as unknown as Comment;
          // Avoid duplicates: skip if this is the comment we just inserted
          const { data: profileData } = await platform
            .from('profiles')
            .select('*')
            .eq('id', newComment.user_id)
            .maybeSingle();
          setComments((prev) => {
            if (prev.some((c: any) => c.id === newComment.id)) return prev;
            return [...prev, { ...newComment, profile: (profileData as Profile) ?? undefined }];
          });
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comment_reactions' }, (payload) => {
        const r = payload.new as unknown as CommentReaction;
        setReactions((prev) => (prev.some((x: any) => x.id === r.id) ? prev : [...prev, r]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comment_reactions' }, (payload) => {
        const old = payload.old as { id?: string };
        if (old?.id) setReactions((prev) => prev.filter((x: any) => x.id !== old.id));
      })
      .subscribe();

    return () => {
      platform.removeChannel(channel);
    };
  }, [user, taskId]);

  const getImageUrl = (path: string) => {
    const { data } = platform.storage.from('task-screenshots').getPublicUrl(path);
    return data.publicUrl;
  };

  const getCommentAttachments = (comment: Comment) => {
    if (!comment.image_path) return [];
    if (comment.image_path.startsWith('[')) {
      try {
        const parsed = JSON.parse(comment.image_path) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item) => ({
              path: String(item.path ?? ''),
              type: typeof item.type === 'string' ? item.type : null,
              name: typeof item.name === 'string' ? item.name : null,
            }))
            .filter((item) => item.path);
        }
      } catch {
        // fall through and treat as a single attachment path
      }
    }
    return [{ path: comment.image_path, type: comment.file_type, name: comment.file_name }];
  };

  const isImageType = (t: string | null) => !!t && t.startsWith('image/');
  const isVideoType = (t: string | null) => !!t && t.startsWith('video/');
  const isPdfType = (t: string | null) => t === 'application/pdf';
  const isMarkdownType = (t: string | null, name?: string | null) =>
    (!!t && (t === 'text/markdown' || t === 'text/x-markdown' || t === 'application/markdown')) ||
    (!!name && /\.(md|markdown)$/i.test(name));

  const applyCommentFiles = (files: File[]) => {
    const accepted: { file: File; url: string }[] = [];
    for (const file of files) {
      const ok =
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type === 'application/pdf' ||
        isMarkdownType(file.type, file.name);
      if (!ok) {
        toast.error(`${file.name}: only images, videos, PDF and Markdown (.md) files are allowed`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 50 MB)`);
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (accepted.length) setCommentFiles((prev) => [...prev, ...accepted]);
  };

  const removeCommentFile = (index: number) => {
    const target = commentFiles[index];
    if (target) URL.revokeObjectURL(target.url);
    setCommentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCommentFiles = () => {
    commentFiles.forEach((attachment) => URL.revokeObjectURL(attachment.url));
    setCommentFiles([]);
  };

  const handleCommentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    let files = Array.from(e.clipboardData.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      files = Array.from(e.clipboardData.items)
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
    }
    if (!files.length) return;
    e.preventDefault();
    const named = files.map((file, index) => {
      if (/\.[a-z0-9]+$/i.test(file.name)) return file;
      const ext = (file.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg');
      return new File([file], `pasted-image-${Date.now()}-${index}.${ext}`, { type: file.type });
    });
    applyCommentFiles(named);
  };

  // --- @mention support ---
  const mentionCandidates = members.filter((m: any) => {
    const q = (mentionQuery ?? '').toLowerCase();
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const editMentionCandidates = members.filter((m: any) => {
    const q = (editMentionQuery ?? '').toLowerCase();
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const handleMentionChange = (
    value: string,
    type: 'comment' | 'edit',
    ref: React.RefObject<HTMLTextAreaElement>,
    current: string,
    setValue: (v: string) => void,
    setQuery: (q: string | null) => void,
    setIndex: (i: number) => void,
    setOpen: (o: boolean) => void
  ) => {
    setValue(value);
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === before.length - 1) {
      setQuery('');
      setIndex(0);
      setOpen(true);
    } else if (atIdx !== -1 && /^[a-zA-Z0-9._-]*$/.test(before.slice(atIdx + 1))) {
      setQuery(before.slice(atIdx + 1));
      setIndex(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const insertMention = (
    m: Profile,
    type: 'comment' | 'edit',
    ref: React.RefObject<HTMLTextAreaElement>,
    current: string,
    setValue: (v: string) => void,
    setOpen: (o: boolean) => void,
    setQuery: (q: string | null) => void
  ) => {
    if (!ref.current) return;
    const caret = ref.current.selectionStart ?? current.length;
    const before = current.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    const after = current.slice(caret);
    const name = m.full_name ?? m.email;
    const next = `${before.slice(0, atIdx)}@${name} ${after}`;
    setValue(next);
    setOpen(false);
    setQuery(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        const pos = atIdx + name.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleMentionKeyDown = (
    e: React.KeyboardEvent,
    type: 'comment' | 'edit',
    open: boolean,
    candidates: Profile[],
    index: number,
    setIndex: (i: number) => void,
    setOpen: (o: boolean) => void,
    insert: (m: Profile) => void,
    submit: () => void
  ) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex(Math.min(index + 1, candidates.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex(Math.max(index - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (candidates[index]) {
          e.preventDefault();
          insert(candidates[index]);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const renderMessage = (text: string) => {
    const sorted = [...members].sort(
      (a, b) => (b.full_name ?? b.email).length - (a.full_name ?? a.email).length
    );
    const pattern = sorted
      .map((m: any) => `@${(m.full_name ?? m.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      .join('|');
    if (!pattern) return text;
    const parts = text.split(new RegExp(`(${pattern})`));
    return parts.map((part, i) => {
      const m = sorted.find((x: any) => `@${x.full_name ?? x.email}` === part);
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
            {name}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!user) return;
    setReactionPickerFor(null);
    const existing = reactions.find(
      (r) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      const { error } = await platform.from('comment_reactions').delete().eq('id', existing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setReactions((prev) => prev.filter((r: any) => r.id !== existing.id));
      return;
    }
    const { data, error } = await platform
      .from('comment_reactions')
      .insert({ comment_id: commentId, user_id: user.id, emoji })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const created = data as CommentReaction;
    setReactions((prev) => (prev.some((r: any) => r.id === created.id) ? prev : [...prev, created]));
  };

  const messagePreview = (comment: Comment) => {
    const text = comment.message.trim();
    if (text && text !== 'Attachment') return text;
    const attachments = getCommentAttachments(comment);
    return attachments.length ? attachments.map((a) => a.name ?? 'attachment').join(', ') : 'Attachment';
  };

  const copyComment = async (comment: Comment) => {
    const text = comment.message.trim();
    const value = text && text !== 'Attachment' ? text : messagePreview(comment);
    const markCopied = () => {
      setCopiedCommentId(comment.id);
      window.setTimeout(
        () => setCopiedCommentId((id) => (id === comment.id ? null : id)),
        1600
      );
    };
    const legacyCopy = () => {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    };
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else if (!legacyCopy()) throw new Error('copy failed');
      markCopied();
    } catch {
      if (legacyCopy()) {
        markCopied();
        return;
      }
      toast.error('Could not copy message');
    }
  };

  const hasReplies = (comment: Comment) => comments.some((c) => c.parent_id === comment.id);

  const requestDeleteComment = (comment: Comment) => {
    if (hasReplies(comment)) {
      toast.error('Delete the replies in this thread first');
      return;
    }
    setDeleteCommentId(comment.id);
  };

  const deleteComment = async () => {
    if (!deleteCommentId || !user) return;
    setCommentDeleteLoading(true);
    const { error } = await platform
      .from('comments')
      .delete()
      .eq('id', deleteCommentId)
      .eq('user_id', user.id);
    setCommentDeleteLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeleteCommentId(null);
    if (replyTo?.id === deleteCommentId) setReplyTo(null);
    await fetchTask();
    toast.success('Message deleted');
  };

  const startReply = (comment: Comment) => {
    setReplyTo(comment);
    requestAnimationFrame(() => {
      commentTextareaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      commentTextareaRef.current?.focus();
    });
  };

  const toggleThread = (rootId: string) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  const addComment = async () => {
    const files = commentFiles.map((attachment) => attachment.file);
    if ((!newComment.trim() && files.length === 0) || !user || !task) return;
    setCommentLoading(true);

    const parentComment = replyTo;
    const commentText = newComment.trim();
    const attachmentLabel = files.length > 1 ? 'Sent attachments' : 'Sent an image';
    const uploaded: { path: string; type: string | null; name: string }[] = [];
    if (files.length > 0) {
      setImageUploading(true);
      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'png';
        const fileType = file.type || (isMarkdownType(null, file.name) ? 'text/markdown' : null);
        const storageName = `${task.project_id}/${taskId}/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await platform.storage
          .from('task-screenshots')
          .upload(storageName, file, {
            contentType: fileType ?? undefined,
            cacheControl: '3600',
          });
        if (uploadError) {
          setImageUploading(false);
          toast.error(uploadError.message);
          setCommentLoading(false);
          return;
        }
        uploaded.push({ path: storageName, type: fileType, name: file.name });
      }
      setImageUploading(false);
    }

    const singleAttachment = uploaded.length === 1 ? uploaded[0] : null;
    const { error } = await platform.from('comments').insert({
      task_id: taskId,
      user_id: user.id,
      parent_id: parentComment?.id ?? null,
      message: uploaded.length === 0 ? commentText : commentText || 'Attachment',
      image_path:
        uploaded.length === 0
          ? null
          : uploaded.length === 1
            ? uploaded[0].path
            : JSON.stringify(uploaded),
      file_type: singleAttachment?.type ?? null,
      file_name: singleAttachment?.name ?? null,
    });
    if (error) {
      toast.error(error.message);
      setCommentLoading(false);
      return;
    }

    try {
      const { error: logErr } = await platform.from('activity_logs').insert({
        project_id: task.project_id,
        task_id: taskId,
        user_id: user.id,
        action: 'added comment',
        entity_type: 'comment',
      });
      if (logErr) throw logErr;

      const projectSuffix = task.project?.name ? ` · ${task.project.name}` : '';
      const notifBase = {
        actor_id: user.id,
        project_id: task.project_id,
        link: `/app/tasks/${task.number}`,
        priority: task.priority,
      };

      // Notify mentioned users
      const mentioned = members.filter((m: any) => {
        const name = m.full_name ?? m.email;
        return m.id !== user.id && commentText.includes(`@${name}`);
      });
      for (const m of mentioned) {
        const { error: notifErr } = await platform.from('notifications').insert({
          ...notifBase,
          user_id: m.id,
          type: 'mention',
          title: `${profile?.full_name ?? profile?.email} mentioned you in #${task.number}${projectSuffix}`,
          body: commentText.slice(0, 100) || attachmentLabel,
        });
        if (notifErr) throw notifErr;
        sendNotificationEmail(
          m.email,
          `${profile?.full_name ?? profile?.email} mentioned you in #${task.number}${projectSuffix}`,
          commentText.slice(0, 200) || attachmentLabel,
          `${window.location.origin}${notifBase.link}`
        );
        sendPushToUser(
          m.id,
          `${profile?.full_name ?? profile?.email} mentioned you in #${task.number}${projectSuffix}`,
          commentText.slice(0, 100) || attachmentLabel,
          notifBase.link
        );
      }

      // Notify the author of the message being replied to
      const parentAuthorId = parentComment?.user_id ?? null;
      if (
        parentAuthorId &&
        parentAuthorId !== user.id &&
        !mentioned.some((m: any) => m.id === parentAuthorId) &&
        parentAuthorId !== task.assignee_id
      ) {
        const { error: notifErr } = await platform.from('notifications').insert({
          ...notifBase,
          user_id: parentAuthorId,
          type: 'comment_added',
          title: `New reply on #${task.number}${projectSuffix}`,
          body: commentText.slice(0, 100) || attachmentLabel,
        });
        if (notifErr) throw notifErr;
        const parentAuthor = members.find((m: any) => m.id === parentAuthorId);
        if (parentAuthor) {
          sendNotificationEmail(
            parentAuthor.email,
            `New reply on #${task.number}${projectSuffix}`,
            commentText.slice(0, 200) || attachmentLabel,
            `${window.location.origin}${notifBase.link}`
          );
        }
        sendPushToUser(
          parentAuthorId,
          `New reply on #${task.number}${projectSuffix}`,
          commentText.slice(0, 100) || attachmentLabel,
          notifBase.link
        );
      }

      // Notify assignee (if not already mentioned)
      if (task.assignee_id && task.assignee_id !== user.id && !mentioned.some((m: any) => m.id === task.assignee_id)) {
        const { error: notifErr } = await platform.from('notifications').insert({
          ...notifBase,
          user_id: task.assignee_id,
          type: 'comment_added',
          title: `New comment on #${task.number}${projectSuffix}`,
          body: commentText.slice(0, 100) || attachmentLabel,
        });
        if (notifErr) throw notifErr;
        const assignee = members.find((m: any) => m.id === task.assignee_id);
        if (assignee) {
          sendNotificationEmail(
            assignee.email,
            `New comment on #${task.number}${projectSuffix}`,
            commentText.slice(0, 200) || attachmentLabel,
            `${window.location.origin}${notifBase.link}`
          );
        }
        sendPushToUser(
          task.assignee_id,
          `New comment on #${task.number}${projectSuffix}`,
          commentText.slice(0, 100) || attachmentLabel,
          notifBase.link
        );
      }

      setNewComment('');
      setReplyTo(null);
      clearCommentFiles();
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
    const { error } = await platform
      .from('comments')
      .update({ message: editingCommentText.trim() })
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
    if (
      updates.status &&
      updates.status !== task.status &&
      !canTransitionStatus(task.status, updates.status)
    ) {
      toast.error(
        'Follow the flow: Open → In Progress → Development Completed → Testing → Testing Completed → Released. Cancelled is allowed anytime.'
      );
      return;
    }
    if (
      updates.status === 'test_release' &&
      !(testCases.length > 0 && testCases.every((tc) => tc.checked))
    ) {
      toast.error('Check all test cases before marking Testing Completed');
      return;
    }
    const projectSuffix = task.project?.name ? ` · ${task.project.name}` : '';
    const notifBase = {
      actor_id: user.id,
      project_id: task.project_id,
      link: `/app/tasks/${task.number}`,
      priority: task.priority,
    };
    const { error } = await platform.from('tasks').update(updates).eq('id', taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    try {
      if (updates.approval_status && updates.approval_status !== task.approval_status) {
        const approved = updates.approval_status === 'approved';
        const rejected = updates.approval_status === 'rejected';
        const requesting = updates.approval_status === 'pending';
        const action = requesting ? 'requested approval' : approved ? 'approved task' : 'rejected task';
        const { error: logErr } = await platform.from('activity_logs').insert({
          project_id: task.project_id,
          task_id: taskId,
          user_id: user.id,
          action,
          entity_type: 'task',
          entity_id: taskId,
        });
        if (logErr) throw logErr;

        // Requesting approval notifies the assignee; approving/rejecting
        // notifies the reporter.
        const targetId = requesting ? task.assignee_id : task.reporter_id;
        if (targetId && targetId !== user.id) {
          const title = requesting
            ? `Approval requested: #${task.number}${projectSuffix}`
            : `${approved ? 'Task approved' : 'Task rejected'}: #${task.number}${projectSuffix}`;
          const type = requesting
            ? 'task_approval_requested'
            : approved
              ? 'task_approved'
              : 'task_rejected';
          const { error: notifErr } = await platform.from('notifications').insert({
            ...notifBase,
            user_id: targetId,
            type,
            title,
            body: task.title,
          });
          if (notifErr) throw notifErr;
          const target = members.find((m: any) => m.id === targetId);
          if (target) {
            sendNotificationEmail(
              target.email,
              title,
              task.title,
              `${window.location.origin}/app/tasks/${task.number}`
            );
          }
          sendPushToUser(targetId, title, task.title, `/app/tasks/${task.number}`);
        }
      }

      if (updates.status && updates.status !== task.status) {
        const { error: logErr } = await platform.from('activity_logs').insert({
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
          const { error: notifErr } = await platform.from('notifications').insert({
            user_id: task.assignee_id,
            actor_id: user.id,
            project_id: task.project_id,
            type: 'status_changed',
            title: `Status changed on #${task.number}${projectSuffix}`,
            body: `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
            link: `/app/tasks/${task.number}`,
            priority: task.priority,
          });
          if (notifErr) throw notifErr;
          const assignee = members.find((m: any) => m.id === task.assignee_id);
          if (assignee) {
            sendNotificationEmail(
              assignee.email,
              `Status changed on #${task.number}${projectSuffix}`,
              `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
              `${window.location.origin}/app/tasks/${task.number}`
            );
          }
          sendPushToUser(
            task.assignee_id,
            `Status changed on #${task.number}${projectSuffix}`,
            `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
            `/app/tasks/${task.number}`
          );
        }
      }
      if (updates.assignee_id !== undefined && updates.assignee_id !== task.assignee_id) {
        const newAssigneeId = updates.assignee_id;
        if (newAssigneeId && newAssigneeId !== user.id) {
          const { error: notifErr } = await platform.from('notifications').insert({
            user_id: newAssigneeId,
            actor_id: user.id,
            project_id: task.project_id,
            type: 'task_assigned',
            title: `Task assigned: #${task.number}${projectSuffix}`,
            body: task.title,
            link: `/app/tasks/${task.number}`,
            priority: updates.priority ?? task.priority,
          });
          if (notifErr) throw notifErr;
          const newAssignee = members.find((m: any) => m.id === newAssigneeId);
          if (newAssignee) {
            sendNotificationEmail(
              newAssignee.email,
              `Task assigned: #${task.number}${projectSuffix}`,
              task.title,
              `${window.location.origin}/app/tasks/${task.number}`
            );
          }
          sendPushToUser(
            newAssigneeId,
            `Task assigned: #${task.number}${projectSuffix}`,
            task.title,
            `/app/tasks/${task.number}`
          );
        }
        const { error: logErr } = await platform.from('activity_logs').insert({
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

  const createSubtask = async () => {
    if (!task || !user || !subtaskTitle.trim()) return;
    setSubtaskCreating(true);
    const { error } = await platform.from('tasks').insert({
      project_id: task.project_id,
      version_id: task.version_id ?? null,
      parent_id: taskId,
      title: subtaskTitle.trim(),
      type: 'task',
      status: 'open',
      priority: task.priority,
      reporter_id: user.id,
    });
    if (error) {
      toast.error(error.message);
      setSubtaskCreating(false);
      return;
    }
    try {
      await platform.from('activity_logs').insert({
        project_id: task.project_id,
        task_id: taskId,
        user_id: user.id,
        action: 'created a subtask',
        entity_type: 'task',
      });
    } catch {
      // non-fatal
    }
    setSubtaskTitle('');
    setSubtaskCreating(false);
    await fetchTask();
    toast.success('Subtask created');
  };

  const fetchTestCases = async () => {
    if (!taskId) return;
    const { data, error } = await platform
      .from('task_test_cases')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at');
    if (error) {
      toast.error(error.message);
      return;
    }
    setTestCases((data as unknown as TaskTestCase[]) ?? []);
  };

  const addTestCase = async () => {
    if (!task || !user || !newTestCase.trim()) return;
    const { error } = await platform.from('task_test_cases').insert({
      task_id: taskId,
      title: newTestCase.trim(),
      description: newTestCaseDescription.trim() || null,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewTestCase('');
    setNewTestCaseDescription('');
    await fetchTestCases();
  };

  const saveTestCaseEdit = async (testCase: TaskTestCase) => {
    const title = editTitleDraft.trim();
    if (!title) {
      toast.error('Test case title is required');
      return;
    }
    const { error } = await platform
      .from('task_test_cases')
      .update({ title, description: descriptionDraft.trim() || null })
      .eq('id', testCase.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingTestCase(null);
    await fetchTestCases();
    toast.success('Test case updated');
  };

  const deleteTestCase = async (testCase: TaskTestCase) => {
    if (!user) return;
    const { error } = await platform.from('task_test_cases').delete().eq('id', testCase.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await fetchTestCases();
  };

  const toggleTestCase = async (testCase: TaskTestCase) => {
    if (!user) return;
    const { error } = await platform
      .from('task_test_cases')
      .update(
        testCase.checked
          ? { checked: false, checked_by: null, checked_at: null }
          : { checked: true, checked_by: user.id, checked_at: new Date().toISOString() }
      )
      .eq('id', testCase.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await fetchTestCases();
  };

  const saveEdit = async () => {
    await updateTask({ title: editTitle });
    setEditing(false);
    toast.success('Task updated');
  };

  const deleteTask = async () => {
    if (!task) return;
    const { error } = await platform
      .from('tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
      .eq('id', taskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Task moved to deleted tasks');
      router.push(`/app/projects/${task.project?.slug ?? task.project_id}`);
    }
  };

  const restoreTask = async () => {
    const { error } = await platform
      .from('tasks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', taskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Task restored');
      await fetchTask();
    }
  };

  const confirmDeleteTask = async () => {
    setDeleteTaskLoading(true);
    await deleteTask();
    setDeleteTaskLoading(false);
    setDeleteTaskOpen(false);
  };

  const isProjectAdmin = myRole === 'project_admin' || teamRole === 'team_admin' || teamRole === 'owner';
  const canEdit = isProjectAdmin || isGlobalAdmin(profile) || task?.reporter_id === user?.id;
  const canDelete = isProjectAdmin || isGlobalAdmin(profile);
  const approvalStatus = task?.approval_status ?? 'approved';
  const awaitingApproval = !!task?.assignee_id && approvalStatus !== 'approved';
  const canApprove =
    awaitingApproval &&
    (user?.id === task?.assignee_id || isProjectAdmin || isGlobalAdmin(profile));
  const canRequestApproval =
    !!task?.assignee_id &&
    approvalStatus !== 'pending' &&
    (user?.id === task?.reporter_id || isProjectAdmin || isGlobalAdmin(profile));
  const allTestCasesChecked = testCases.length > 0 && testCases.every((tc) => tc.checked);
  const canManageTestCase = (tc: TaskTestCase) =>
    !!user && (tc.created_by === user.id || isGlobalAdmin(profile));
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to this task. You must be a member of the project.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Task not found or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  const commentGroups: {
    comment: Comment;
    attachments: { path: string; type: string | null; name: string | null }[];
  }[] = [];

  for (const comment of comments) {
    // Replies are rendered inside their thread, not in the main list.
    if (comment.parent_id) continue;
    const previousGroup = commentGroups[commentGroups.length - 1];
    const previousComment = previousGroup?.comment;
    const isAttachmentOnly = comment.message.trim() === 'Attachment' && !!comment.image_path;
    const sentCloseTogether = previousComment
      ? new Date(comment.created_at).getTime() - new Date(previousComment.created_at).getTime() <= 10_000
      : false;
    if (
      previousGroup &&
      previousComment &&
      isAttachmentOnly &&
      comment.user_id === previousComment.user_id &&
      sentCloseTogether
    ) {
      previousGroup.attachments.push(...getCommentAttachments(comment));
    } else {
      commentGroups.push({ comment, attachments: getCommentAttachments(comment) });
    }
  }

  // --- Threads -------------------------------------------------------------
  const commentsById = new Map(comments.map((c) => [c.id, c]));

  // Flatten nested replies under their thread root.
  const rootIdFor = (comment: Comment) => {
    let current = comment;
    const seen = new Set<string>();
    while (current.parent_id && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = commentsById.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return current.id;
  };

  const threadReplies = new Map<string, Comment[]>();
  for (const comment of comments) {
    if (!comment.parent_id) continue;
    const rootId = rootIdFor(comment);
    if (rootId === comment.id) continue;
    const list = threadReplies.get(rootId) ?? [];
    list.push(comment);
    threadReplies.set(rootId, list);
  }
  for (const list of threadReplies.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return (
    <div className="flex flex-col gap-6 xl:min-h-0 xl:flex-1">
      <div className="flex shrink-0 items-center gap-3 animate-fade-in-up">
        <BackButton fallbackHref={backHref} />
        <div className="flex items-center gap-2 flex-1">
          <TypeBadge type={task.type} />
          <span className="text-sm text-muted-foreground">#{task.number}</span>
          {awaitingApproval && (
            <Badge
              variant="outline"
              className={
                approvalStatus === 'rejected'
                  ? 'border-red-500/20 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400'
              }
            >
              {approvalStatus === 'rejected' ? 'Approval rejected' : 'Awaiting approval'}
            </Badge>
          )}
          {parentTask && (
            <Link
              href={`/app/tasks/${parentTask.number}`}
              className="flex max-w-[320px] items-center gap-1 rounded-md border border-border/60 bg-secondary/40 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              title={`Subtask of #${parentTask.number} ${parentTask.title}`}
            >
              <CornerUpLeft className="h-3 w-3 shrink-0" />
              <span className="truncate">Subtask of #{parentTask.number} · {parentTask.title}</span>
            </Link>
          )}
        </div>
        {canDelete && !task.deleted_at && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTaskOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
        {task.deleted_at && profile?.role === 'super_admin' && (
          <Button variant="ghost" size="sm" onClick={restoreTask}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore
          </Button>
        )}
      </div>

      {task.deleted_at && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive animate-fade-in-up">
          <Trash2 className="h-4 w-4 shrink-0" />
          This task is in deleted tasks{task.deleted_at ? ` (deleted ${formatRelativeTime(task.deleted_at)})` : ''}.
          {profile?.role === 'super_admin' ? ' Use Restore to bring it back.' : ' Only Super Admin can see and restore it.'}
        </div>
      )}

      {/* Delete task confirmation */}
      <ConfirmDeleteDialog
        open={deleteTaskOpen}
        onOpenChange={setDeleteTaskOpen}
        title="Delete Task"
        description={`This will move task #${task?.number} "${task?.title}" to deleted tasks. It will be hidden from all task lists; Super Admin can restore it later.`}
        confirmText={task?.title ?? ''}
        onConfirm={confirmDeleteTask}
        loading={deleteTaskLoading}
      />

      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main content */}
        <div className="flex min-w-0 flex-col gap-6 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          {/* Title */}
          <Card className="card-hover animate-fade-in-up stagger-1">
            <CardContent className="p-6">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditTitle(task.title); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-xl font-semibold tracking-tight flex-1">{task.title}</h1>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="card-hover animate-fade-in-up stagger-2 flex shrink-0 flex-col overflow-hidden xl:h-[calc(100vh_-_15rem)] xl:min-h-[560px]">
            <CardHeader className="shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              {/* Comment list — chat style (top) */}
              {comments.length === 0 ? (
                <div className="py-10 flex-1 min-h-0">
                  <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation" />
                </div>
              ) : (
                <div ref={commentsListRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-4 min-h-0">
                  {commentGroups.map(({ comment, attachments: commentAttachments }) => {
                    const isMine = comment.user_id === user?.id;
                    const isEditingThis = editingCommentId === comment.id;
                    const groupedReactions = reactions
                      .filter((r: any) => r.comment_id === comment.id)
                      .reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
                        const prev = acc[r.emoji] ?? { count: 0, mine: false };
                        acc[r.emoji] = { count: prev.count + 1, mine: prev.mine || r.user_id === user?.id };
                        return acc;
                      }, {});
                    const hasMultipleAttachments = commentAttachments.length > 1;
                    return (
                      <div key={comment.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 mt-0.5 cursor-default">
                              <UserAvatar profile={comment.profile} className="h-7 w-7" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {comment.profile?.full_name ?? comment.profile?.email ?? 'Unknown user'}
                          </TooltipContent>
                        </Tooltip>
                        <div className={`${isEditingThis ? 'flex-1 max-w-full' : 'max-w-[80%]'} min-w-0 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-tr-sm [&_*]:selection:bg-white [&_*]:selection:text-primary selection:bg-white selection:text-primary'
                                : 'bg-secondary/70 text-foreground rounded-tl-sm'
                            } ${isEditingThis ? 'w-full' : ''}`}
                          >
                            {commentAttachments.length > 0 && (
                              <div className={hasMultipleAttachments ? 'grid grid-cols-2 gap-2 mb-2' : 'mb-2'}>
                                {commentAttachments.map((attachment, attachmentIndex) => {
                                  const attachmentUrl = getImageUrl(attachment.path);
                                  const key = `${attachment.path}-${attachmentIndex}`;
                                  if (isImageType(attachment.type) || !attachment.type) {
                                    return (
                                      <img
                                        key={key}
                                        src={attachmentUrl}
                                        alt={attachment.name ?? 'comment attachment'}
                                        className={
                                          hasMultipleAttachments
                                            ? 'max-h-64 w-full rounded-lg bg-black/10 object-contain cursor-pointer'
                                            : 'rounded-lg max-h-48 w-auto cursor-pointer'
                                        }
                                        onClick={() => setPreviewFile({ url: attachmentUrl, type: 'image' })}
                                      />
                                    );
                                  }
                                  if (isVideoType(attachment.type)) {
                                    return (
                                      <video
                                        key={key}
                                        src={attachmentUrl}
                                        className={
                                          hasMultipleAttachments
                                            ? 'max-h-64 w-full rounded-lg bg-black/10 cursor-pointer'
                                            : 'rounded-lg max-h-64 w-auto cursor-pointer'
                                        }
                                        controls
                                        preload="metadata"
                                        onClick={() => setPreviewFile({ url: attachmentUrl, type: 'video' })}
                                      />
                                    );
                                  }
                                  if (isPdfType(attachment.type)) {
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 w-full text-left hover:bg-accent/50 transition-colors"
                                        onClick={() => setPreviewFile({ url: attachmentUrl, type: 'pdf' })}
                                      >
                                        <FileIcon className="h-6 w-6 text-primary shrink-0" />
                                        <span className="flex flex-col min-w-0">
                                          <span className="text-sm font-medium truncate">{attachment.name ?? 'document.pdf'}</span>
                                          <span className="text-[11px] text-muted-foreground">PDF document — click to view</span>
                                        </span>
                                      </button>
                                    );
                                  }
                                  return (
                                    <a
                                      key={key}
                                      href={attachmentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 w-full text-left hover:bg-accent/50 transition-colors"
                                    >
                                      <FileIcon className="h-6 w-6 text-primary shrink-0" />
                                      <span className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate">{attachment.name ?? 'Attachment'}</span>
                                        <span className="text-[11px] text-muted-foreground">Click to download</span>
                                      </span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                            {isEditingThis ? (
                              <div className="space-y-2">
                                <div className="relative">
                                  <Textarea
                                    ref={editCommentTextareaRef}
                                    value={editingCommentText}
                                    onChange={(e) => handleMentionChange(e.target.value, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionQuery, setEditMentionIndex, setEditMentionOpen)}
                                    onKeyDown={(e) => handleMentionKeyDown(e, 'edit', editMentionOpen, editMentionCandidates, editMentionIndex, setEditMentionIndex, setEditMentionOpen, (m) => insertMention(m, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionOpen, setEditMentionQuery), saveCommentEdit)}
                                    rows={6}
                                    className="bg-background text-foreground text-sm resize min-h-[140px] max-w-full"
                                    autoFocus
                                  />
                                  {editMentionOpen && editMentionCandidates.length > 0 && (
                                    <div className="absolute bottom-full mb-2 w-72 rounded-xl border border-border bg-popover shadow-elevated z-20 overflow-hidden animate-fade-in-scale">
                                      <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                                        Mention someone
                                      </p>
                                      <div className="max-h-48 overflow-y-auto p-1">
                                        {editMentionCandidates.map((m, i) => (
                                          <button
                                            key={m.id}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); insertMention(m, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionOpen, setEditMentionQuery); }}
                                            onMouseEnter={() => setEditMentionIndex(i)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                                              i === editMentionIndex ? 'bg-accent text-accent-foreground' : ''
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
                          {!isEditingThis && (
                            <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
                              {Object.entries(groupedReactions).map(([emoji, info]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(comment.id, emoji)}
                                  className={cn(
                                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                                    info.mine
                                      ? 'border-primary/40 bg-primary/10'
                                      : 'border-border/60 bg-secondary/40 hover:bg-secondary/70'
                                  )}
                                  title={info.mine ? 'Remove your reaction' : 'Add reaction'}
                                >
                                  <span className="text-sm leading-none">{emoji}</span>
                                  <span className="text-[10px] font-semibold text-muted-foreground">{info.count}</span>
                                </button>
                              ))}
                              <Popover
                                open={reactionPickerFor === comment.id}
                                onOpenChange={(open) => setReactionPickerFor(open ? comment.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-secondary/60 hover:text-foreground"
                                    title="Add reaction"
                                  >
                                    <SmilePlus className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align={isMine ? 'end' : 'start'} className="w-auto p-1.5">
                                  <div className="flex items-center gap-0.5">
                                    {REACTION_EMOJIS.map((emoji: any) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => toggleReaction(comment.id, emoji)}
                                        className="h-8 w-8 rounded-lg text-lg leading-none transition-colors hover:bg-accent"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                          <div className={`flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="font-medium">
                              {comment.profile?.full_name ?? comment.profile?.email}
                            </span>
                            <span>{formatRelativeTime(comment.created_at)}</span>
                            {!isEditingThis && (
                              <button
                                onClick={() => copyComment(comment)}
                                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                title="Copy message"
                              >
                                {copiedCommentId === comment.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                            )}
                            {!isEditingThis && (
                              <button
                                onClick={() => startReply(comment)}
                                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                title="Reply in thread"
                              >
                                <Reply className="h-3 w-3" />
                              </button>
                            )}
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
                            {isMine && !isEditingThis && (
                              <button
                                onClick={() => requestDeleteComment(comment)}
                                className="text-muted-foreground/60 hover:text-destructive transition-colors"
                                title="Delete message"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {/* Thread */}
                          {(threadReplies.get(comment.id)?.length ?? 0) > 0 && (() => {
                            const replies = threadReplies.get(comment.id)!;
                            const collapsed = collapsedThreads.has(comment.id);
                            return (
                              <div className="mt-2 w-full overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
                                <button
                                  type="button"
                                  onClick={() => toggleThread(comment.id)}
                                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                  {collapsed ? (
                                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronUp className="ml-auto h-3.5 w-3.5" />
                                  )}
                                </button>
                                {!collapsed && (
                                  <div className="space-y-2.5 border-t border-border/50 px-3 py-2.5">
                                    {replies.map((reply) => {
                                      const replyParent = reply.parent_id ? commentsById.get(reply.parent_id) : null;
                                      const replyIsMine = reply.user_id === user?.id;
                                      const replyAttachments = getCommentAttachments(reply);
                                      return (
                                        <div key={reply.id} className="flex gap-2">
                                          <UserAvatar profile={reply.profile} className="mt-0.5 h-6 w-6 shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            {replyParent && replyParent.id !== comment.id && (
                                              <p className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <CornerDownRight className="h-3 w-3" />
                                                replying to{' '}
                                                <span className="font-medium">
                                                  {replyParent.profile?.full_name ?? replyParent.profile?.email}
                                                </span>
                                              </p>
                                            )}
                                            {editingCommentId === reply.id ? (
                                              <div className="w-full space-y-2">
                                                <div className="relative">
                                                  <Textarea
                                                    value={editingCommentText}
                                                    onChange={(e) => handleMentionChange(e.target.value, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionQuery, setEditMentionIndex, setEditMentionOpen)}
                                                    onKeyDown={(e) => handleMentionKeyDown(e, 'edit', editMentionOpen, editMentionCandidates, editMentionIndex, setEditMentionIndex, setEditMentionOpen, (m) => insertMention(m, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionOpen, setEditMentionQuery), saveCommentEdit)}
                                                    rows={4}
                                                    className="bg-background text-foreground text-sm resize min-h-[100px] max-w-full"
                                                    autoFocus
                                                  />
                                                  {editMentionOpen && editMentionCandidates.length > 0 && (
                                                    <div className="absolute bottom-full mb-2 w-72 rounded-xl border border-border bg-popover shadow-elevated z-20 overflow-hidden animate-fade-in-scale">
                                                      <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                                                        Mention someone
                                                      </p>
                                                      <div className="max-h-48 overflow-y-auto p-1">
                                                        {editMentionCandidates.map((m, i) => (
                                                          <button
                                                            key={m.id}
                                                            type="button"
                                                            onMouseDown={(e) => { e.preventDefault(); insertMention(m, 'edit', editCommentTextareaRef, editingCommentText, setEditingCommentText, setEditMentionOpen, setEditMentionQuery); }}
                                                            onMouseEnter={() => setEditMentionIndex(i)}
                                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                                                              i === editMentionIndex ? 'bg-accent text-accent-foreground' : ''
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
                                                <div className="flex gap-1.5 justify-end">
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2 text-xs"
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
                                            <div
                                              className={cn(
                                                'rounded-xl px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap',
                                                replyIsMine
                                                  ? 'rounded-tr-sm bg-primary text-primary-foreground'
                                                  : 'rounded-tl-sm bg-secondary/70 text-foreground'
                                              )}
                                            >
                                              {replyAttachments.length > 0 && (
                                                <div className="mb-1.5 flex flex-wrap gap-1.5">
                                                  {replyAttachments.map((attachment, attachmentIndex) => {
                                                    const url = getImageUrl(attachment.path);
                                                    const key = `${attachment.path}-${attachmentIndex}`;
                                                    if (isImageType(attachment.type) || !attachment.type) {
                                                      return (
                                                        <img
                                                          key={key}
                                                          src={url}
                                                          alt={attachment.name ?? 'reply attachment'}
                                                          className="h-20 w-20 cursor-pointer rounded-md object-cover"
                                                          onClick={() => setPreviewFile({ url, type: 'image' })}
                                                        />
                                                      );
                                                    }
                                                    return (
                                                      <a
                                                        key={key}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[11px] hover:bg-accent/50"
                                                      >
                                                        <FileIcon className="h-3 w-3 text-primary" />
                                                        {attachment.name ?? 'File'}
                                                      </a>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                              {reply.message.trim() !== '' && reply.message.trim() !== ' ' && (
                                                <p>{renderMessage(reply.message)}</p>
                                              )}
                                              {reply.edited_at && (
                                                <span className="mt-1 block text-[10px] opacity-70">(edited)</span>
                                              )}
                                            </div>
                                            )}
                                            <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                                              <span className="font-medium">
                                                {reply.profile?.full_name ?? reply.profile?.email}
                                              </span>
                                              <span>{formatRelativeTime(reply.created_at)}</span>
                                              <button
                                                onClick={() => copyComment(reply)}
                                                className="text-muted-foreground/60 transition-colors hover:text-foreground"
                                                title="Copy message"
                                              >
                                                {copiedCommentId === reply.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                              </button>
                                              <button
                                                onClick={() => startReply(reply)}
                                                className="text-muted-foreground/60 transition-colors hover:text-foreground"
                                                title="Reply in thread"
                                              >
                                                <Reply className="h-3 w-3" />
                                              </button>
                                              {replyIsMine && editingCommentId !== reply.id && (
                                                <button
                                                  onClick={() => {
                                                    setEditingCommentId(reply.id);
                                                    setEditingCommentText(reply.message.trim() === ' ' ? '' : reply.message);
                                                  }}
                                                  className="text-muted-foreground/60 transition-colors hover:text-foreground"
                                                  title="Edit message"
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </button>
                                              )}
                                              {replyIsMine && editingCommentId !== reply.id && (
                                                <button
                                                  onClick={() => requestDeleteComment(reply)}
                                                  className="text-muted-foreground/60 transition-colors hover:text-destructive"
                                                  title="Delete message"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* New comment (bottom) */}
              <div className="flex gap-3 border-t border-border/60 p-4 shrink-0">
                <UserAvatar profile={profile} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  {replyTo && (
                    <div className="flex min-w-0 items-start justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-primary">
                            Replying to {replyTo.profile?.full_name ?? replyTo.profile?.email ?? 'message'}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{messagePreview(replyTo)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        title="Cancel reply"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commentFiles.map((attachment, index) => (
                        <div key={`${attachment.file.name}-${index}`} className="relative max-w-[320px]">
                          {isImageType(attachment.file.type) ? (
                            <img
                              src={attachment.url}
                              alt={attachment.file.name}
                              className="h-24 w-24 object-cover rounded-lg border border-border"
                            />
                          ) : isVideoType(attachment.file.type) ? (
                            <video
                              src={attachment.url}
                              className="h-28 rounded-lg border border-border"
                              controls
                              muted
                            />
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
                              <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate max-w-[200px]">{attachment.file.name}</span>
                            </div>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => removeCommentFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Textarea
                      ref={commentTextareaRef}
                      placeholder="Write a comment... paste an image or use @ to mention someone"
                      value={newComment}
                      onChange={(e) => handleMentionChange(e.target.value, 'comment', commentTextareaRef, newComment, setNewComment, setMentionQuery, setMentionIndex, setMentionOpen)}
                      onKeyDown={(e) => handleMentionKeyDown(e, 'comment', mentionOpen, mentionCandidates, mentionIndex, setMentionIndex, setMentionOpen, (m) => insertMention(m, 'comment', commentTextareaRef, newComment, setNewComment, setMentionOpen, setMentionQuery), addComment)}
                      onPaste={handleCommentPaste}
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
                              onMouseDown={(e) => { e.preventDefault(); insertMention(m, 'comment', commentTextareaRef, newComment, setNewComment, setMentionOpen, setMentionQuery); }}
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
                        multiple
                        accept="image/*,video/*,application/pdf,.md,.markdown,text/markdown"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length) applyCommentFiles(files);
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
                      disabled={(!newComment.trim() && commentFiles.length === 0) || commentLoading || imageUploading}
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

          {/* Subtasks */}
          <Card className="card-hover shrink-0 animate-fade-in-up stagger-3">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Subtasks ({subtasks.length})
              </CardTitle>
              {!subtaskFormOpen && (
                <Button size="sm" variant="outline" onClick={() => setSubtaskFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add subtask
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {subtaskFormOpen && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    autoFocus
                    placeholder="Subtask title..."
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createSubtask();
                      if (e.key === 'Escape') {
                        setSubtaskFormOpen(false);
                        setSubtaskTitle('');
                      }
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={createSubtask}
                      disabled={subtaskCreating || !subtaskTitle.trim()}
                    >
                      {subtaskCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSubtaskFormOpen(false);
                        setSubtaskTitle('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {subtasks.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No subtasks yet. Break this task into smaller pieces.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {subtasks.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/app/tasks/${sub.number}`}
                      className="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:border-border hover:bg-accent/40"
                    >
                      <TypeBadge type={sub.type} />
                      <span className="font-mono text-[11px] text-muted-foreground">#{sub.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{sub.title}</span>
                      {sub.assignee && <UserAvatar profile={sub.assignee} className="h-5 w-5 shrink-0" />}
                      {sub.approval_status === 'pending' && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          Approval pending
                        </Badge>
                      )}
                      <StatusBadge status={sub.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Cases */}
          <Card className="card-hover shrink-0 animate-fade-in-up stagger-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Test Cases ({testCases.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {testCases.filter((tc) => tc.checked).length}/{testCases.length} checked
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Test case title..."
                    value={newTestCase}
                    onChange={(e) => setNewTestCase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTestCase();
                      }
                    }}
                  />
                  <Button size="sm" onClick={addTestCase} disabled={!user || !newTestCase.trim()}>
                    Add
                  </Button>
                </div>
                <Textarea
                  placeholder="Description / end-to-end steps (optional)..."
                  value={newTestCaseDescription}
                  onChange={(e) => setNewTestCaseDescription(e.target.value)}
                  rows={2}
                  className="resize-y text-xs"
                />
              </div>
              {testCases.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No test cases yet. Add the cases that must pass before testing is complete.
                </p>
              ) : (
                <Accordion type="multiple" className="space-y-1.5">
                  {testCases.map((tc) => {
                    const checkedBy = tc.checked_by
                      ? members.find((m) => m.id === tc.checked_by)
                      : null;
                    return (
                      <AccordionItem
                        key={tc.id}
                        value={tc.id}
                        className="rounded-lg border border-border/50 px-3 data-[state=open]:bg-secondary/20"
                      >
                        <div className="flex items-start gap-2.5 py-2">
                          <Checkbox
                            checked={tc.checked}
                            onCheckedChange={() => toggleTestCase(tc)}
                            disabled={!user}
                            className="mt-0.5"
                            aria-label={`Mark "${tc.title}" as checked`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm break-words', tc.checked && 'text-muted-foreground line-through')}>
                              {tc.title}
                            </p>
                            {tc.checked && (
                              <p className="text-[11px] text-muted-foreground">
                                Checked by {checkedBy?.full_name ?? checkedBy?.email ?? 'unknown user'}
                                {tc.checked_at ? ` · ${formatRelativeTime(tc.checked_at)}` : ''}
                              </p>
                            )}
                          </div>
                          {canManageTestCase(tc) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTestCase(tc)}
                              aria-label="Delete test case"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <AccordionTrigger
                            className="!flex-none !justify-center !px-1 !py-0"
                            aria-label={`Description for ${tc.title}`}
                          />
                        </div>
                        <AccordionContent className="pb-3 pl-8">
                          {editingTestCase === tc.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editTitleDraft}
                                onChange={(e) => setEditTitleDraft(e.target.value)}
                                placeholder="Test case title"
                                className="h-8 text-xs"
                              />
                              <Textarea
                                value={descriptionDraft}
                                onChange={(e) => setDescriptionDraft(e.target.value)}
                                rows={4}
                                placeholder="Describe the end-to-end steps and expected result..."
                                className="text-xs"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveTestCaseEdit(tc)}>
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingTestCase(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                                {tc.description || 'No description yet.'}
                              </p>
                              {canManageTestCase(tc) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px]"
                                  onClick={() => {
                                    setEditingTestCase(tc.id);
                                    setEditTitleDraft(tc.title);
                                    setDescriptionDraft(tc.description ?? '');
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
              <p className="text-[11px] text-muted-foreground">
                After development is complete and the task is in Testing, check every case before marking Testing Completed.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
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
                  disabled={(!canEdit && myRole !== 'developer') || awaitingApproval}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s: any) => (
                      <SelectItem
                        key={s.value}
                        value={s.value}
                        disabled={
                          !canTransitionStatus(task.status, s.value as Task['status']) ||
                          (s.value === 'test_release' && !allTestCasesChecked)
                        }
                      >
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Flow: Open → In Progress → Development Completed → Testing → Testing Completed → Released. Cancelled anytime.
                </p>
                {awaitingApproval && (
                  <p className="text-[11px] text-muted-foreground">
                    {approvalStatus === 'rejected'
                      ? 'Rejected by the assignee — request approval again after updating the task.'
                      : `Waiting for ${task.assignee?.full_name ?? task.assignee?.email ?? 'the assignee'} to approve before work starts.`}
                  </p>
                )}
              </div>

              {/* Approval */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Approval</label>
                <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={
                        approvalStatus === 'approved'
                          ? 'border-green-500/20 bg-green-500/10 text-[10px] text-green-600 dark:text-green-400'
                          : approvalStatus === 'rejected'
                            ? 'border-red-500/20 bg-red-500/10 text-[10px] text-red-600 dark:text-red-400'
                            : 'border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400'
                      }
                    >
                      {approvalStatus === 'approved'
                        ? 'Approved'
                        : approvalStatus === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                    </Badge>
                    {approvalStatus === 'approved' && task.approved_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(task.approved_at)}
                      </span>
                    )}
                    {!task.assignee_id && (
                      <span className="text-[10px] text-muted-foreground">No approval needed</span>
                    )}
                  </div>
                  {(canApprove || canRequestApproval) && (
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {canApprove && (
                        <>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateTask({ approval_status: 'approved' })}
                          >
                            Approve
                          </Button>
                          {approvalStatus !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => updateTask({ approval_status: 'rejected' })}
                            >
                              Reject
                            </Button>
                          )}
                        </>
                      )}
                      {canRequestApproval && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => updateTask({ approval_status: 'pending' })}
                        >
                          Request approval
                        </Button>
                      )}
                    </div>
                  )}
                </div>
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
                    {TASK_PRIORITIES.map((p: any) => (
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
                    {TASK_TYPES.map((t: any) => (
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
                      disabled={!canEdit && !myRole}
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
                          {members.map((m: any) => (
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
                    {versions.map((v: any) => (
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
          <Card className="card-hover animate-fade-in-up stagger-3">
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
                  {showAllActivity ? 'Show less' : `More (${activityLogs.length})`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleActivity.map((log: any) => (
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

      {/* Delete message confirmation */}
      <Dialog open={!!deleteCommentId} onOpenChange={(open) => { if (!open) setDeleteCommentId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This message will be removed for everyone. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCommentId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteComment} disabled={commentDeleteLoading}>
              {commentDeleteLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File preview modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); setImageScale(1); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>
              {previewFile?.type === 'image' ? 'Image preview' : previewFile?.type === 'video' ? 'Video preview' : 'PDF preview'}
            </DialogTitle>
            <div className="flex items-center gap-3">
              {previewFile?.type === 'image' && (
                <div className="flex items-center gap-1.5 bg-secondary/80 rounded-md p-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setImageScale((s) => Math.max(0.5, s - 0.25))}>Zoom -</Button>
                  <span className="text-xs px-1 font-mono">{Math.round(imageScale * 100)}%</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setImageScale((s) => Math.min(3, s + 0.25))}>Zoom +</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setImageScale(1)}>Reset</Button>
                </div>
              )}
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
            </div>
          </DialogHeader>
          {previewFile?.type === 'image' && (
            <div className="overflow-auto max-h-[75vh] flex items-center justify-center p-2 bg-muted/30 rounded-lg">
              <img
                src={previewFile.url}
                alt="Full preview"
                style={{ transform: `scale(${imageScale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
                className="max-h-[70vh] w-auto object-contain rounded-lg cursor-pointer"
                onClick={() => setImageScale((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
              />
            </div>
          )}
          {previewFile?.type === 'video' && (
            <video src={previewFile.url} className="w-full h-auto rounded-lg max-h-[75vh]" controls autoPlay />
          )}
          {previewFile?.type === 'pdf' && (
            <iframe src={previewFile.url} title="PDF preview" className="w-full h-[75vh] rounded-lg border border-border/60" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
