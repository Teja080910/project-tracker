'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  Send,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  History,
  MessageSquare,
  Calendar,
  User,
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
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { TASK_TYPES, TASK_STATUSES, TASK_PRIORITIES, getRoleLabel } from '@/lib/constants';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Task, Comment, TaskImage, ActivityLog, Profile, Version, Project } from '@/lib/types';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [images, setImages] = useState<TaskImage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

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

    const [commentsRes, imagesRes, activityRes, membersRes, versionsRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*, profile:profiles(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }),
      supabase.from('task_images').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
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
    ]);

    setComments((commentsRes.data as unknown as Comment[]) ?? []);
    setImages((imagesRes.data as TaskImage[]) ?? []);
    setActivityLogs((activityRes.data as unknown as ActivityLog[]) ?? []);
    setMembers((membersRes.data?.map((m) => m.profile) as unknown as Profile[]) ?? []);
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

  // Paste screenshot handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!task) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await uploadFile(file);
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [task]);

  const uploadFile = async (file: File) => {
    if (!user || !task) return;
    setUploadLoading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const fileName = `${task.project_id}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-screenshots')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('task_images').insert({
        task_id: taskId,
        storage_path: fileName,
        file_name: file.name,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      const { error: logErr } = await supabase.from('activity_logs').insert({
        project_id: task.project_id,
        task_id: taskId,
        user_id: user.id,
        action: 'uploaded screenshot',
        entity_type: 'task_image',
      });
      if (logErr) throw logErr;

      await fetchTask();
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await uploadFile(file);
      }
    }
  };

  const deleteImage = async (image: TaskImage) => {
    const isAdmin = profile?.role === 'super_admin' || myRole === 'project_admin';
    if (!isAdmin && image.uploaded_by !== user?.id) {
      toast.error('Only the uploader or an admin can delete this image');
      return;
    }
    const { error: storageErr } = await supabase.storage.from('task-screenshots').remove([image.storage_path]);
    if (storageErr) { toast.error(storageErr.message); return; }
    const { error: dbErr } = await supabase.from('task_images').delete().eq('id', image.id);
    if (dbErr) { toast.error(dbErr.message); return; }
    await fetchTask();
    toast.success('Image deleted');
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from('task-screenshots').getPublicUrl(path);
    return data.publicUrl;
  };

  const addComment = async () => {
    if ((!newComment.trim() && !commentImage) || !user || !task) return;
    setCommentLoading(true);

    let imagePath: string | null = null;
    if (commentImage) {
      const ext = commentImage.name.split('.').pop() ?? 'png';
      const fileName = `${task.project_id}/${taskId}/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('task-screenshots')
        .upload(fileName, commentImage);
      if (uploadError) {
        toast.error(uploadError.message);
        setCommentLoading(false);
        return;
      }
      imagePath = fileName;
    }

    const { error } = await supabase.from('comments').insert({
      task_id: taskId,
      user_id: user.id,
      message: newComment.trim() || ' ',
      image_path: imagePath,
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

      if (task.assignee_id && task.assignee_id !== user.id) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: task.assignee_id,
          type: 'comment_added',
          title: `New comment on #${task.number}`,
          body: newComment.trim().slice(0, 100) || 'Sent an image',
          link: `/app/tasks/${taskId}`,
        });
        if (notifErr) throw notifErr;
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
            type: 'status_changed',
            title: `Status changed on #${task.number}`,
            body: `${task.status.replace('_', ' ')} → ${updates.status.replace('_', ' ')}`,
            link: `/app/tasks/${taskId}`,
          });
          if (notifErr) throw notifErr;
        }
      }
      if (updates.assignee_id !== undefined && updates.assignee_id !== task.assignee_id) {
        const newAssigneeId = updates.assignee_id;
        if (newAssigneeId && newAssigneeId !== user.id) {
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id: newAssigneeId,
            type: 'task_assigned',
            title: `Task assigned: #${task.number}`,
            body: task.title,
            link: `/app/tasks/${taskId}`,
          });
          if (notifErr) throw notifErr;
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
          <Link href="/app/tasks">Back to Tasks</Link>
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
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteTask}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

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

          {/* Images */}
          <Card className="card-hover animate-fade-in-up stagger-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Screenshots
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
              >
                {uploadLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </CardHeader>
            <CardContent>
              {/* Drop zone */}
              <div
                ref={dragRef}
                onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add('border-primary'); }}
                onDragLeave={() => dragRef.current?.classList.remove('border-primary')}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground mb-4 transition-colors"
              >
                Drag & drop images here, or paste (Ctrl+V)
              </div>

              {images.length === 0 ? (
                <EmptyState icon={ImageIcon} title="No screenshots" description="Upload images to attach to this task" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img) => {
                    const isAdmin = profile?.role === 'super_admin' || myRole === 'project_admin';
                    const canDeleteImg = isAdmin || img.uploaded_by === user?.id;
                    return (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border shadow-soft">
                        <img
                          src={getImageUrl(img.storage_path)}
                          alt={img.file_name ?? 'screenshot'}
                          className="w-full h-32 object-cover cursor-pointer"
                          onClick={() => setPreviewImage(getImageUrl(img.storage_path))}
                        />
                        {canDeleteImg && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); deleteImage(img); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {img.file_name && (
                          <p className="text-xs text-muted-foreground truncate px-2 py-1">{img.file_name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="card-hover animate-fade-in-up stagger-3">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New comment */}
              <div className="flex gap-3">
                <UserAvatar profile={profile} className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  {commentImagePreview && (
                    <div className="relative inline-block">
                      <img
                        src={commentImagePreview}
                        alt="Attached"
                        className="h-24 w-24 object-cover rounded-lg border border-border"
                      />
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
                  <Textarea
                    placeholder="Write a comment... (attach an image with the camera icon)"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        ref={commentImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
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
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Image
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={addComment}
                      disabled={(!newComment.trim() && !commentImage) || commentLoading}
                    >
                      {commentLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comment list — chat style */}
              {comments.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No comments yet" description="Start the conversation" />
              ) : (
                <div className="space-y-3 pt-2 max-h-[500px] overflow-y-auto pr-1">
                  {comments.map((comment) => {
                    const isMine = comment.user_id === user?.id;
                    return (
                      <div key={comment.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                        <UserAvatar profile={comment.profile} className="h-7 w-7 shrink-0 mt-0.5" />
                        <div className={`max-w-[75%] min-w-0 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm break-words whitespace-pre-wrap ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-secondary/70 text-foreground rounded-tl-sm'
                            }`}
                          >
                            {comment.image_path && (
                              <img
                                src={getImageUrl(comment.image_path)}
                                alt="comment"
                                className="rounded-lg mb-2 max-h-48 w-auto cursor-pointer"
                                onClick={() => setPreviewImage(getImageUrl(comment.image_path!))}
                              />
                            )}
                            {comment.message.trim() !== '' && comment.message.trim() !== ' ' && (
                              <p>{comment.message}</p>
                            )}
                          </div>
                          <div className={`flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="font-medium">
                              {comment.profile?.full_name ?? comment.profile?.email}
                            </span>
                            <span>{formatRelativeTime(comment.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                <Select
                  value={task.assignee_id ?? 'none'}
                  onValueChange={(v) => updateTask({ assignee_id: v === 'none' ? null : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Input
                  type="date"
                  value={task.due_date ?? ''}
                  onChange={(e) => updateTask({ due_date: e.target.value || null })}
                  disabled={!canEdit}
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
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {activityPageItems.map((log) => (
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
                  <PaginationControls
                    page={activityPage}
                    pageSize={ACTIVITY_PAGE_SIZE}
                    total={activityLogs.length}
                    onPageChange={setActivityPage}
                    className="pt-3"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image preview modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img src={previewImage} alt="Full preview" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
