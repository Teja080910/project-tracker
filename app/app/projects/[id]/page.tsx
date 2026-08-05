'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FolderKanban,
  Plus,
  Users,
  Tag,
  Calendar,
  Trash2,
  UserPlus,
  X,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge, TypeBadge, PriorityBadge } from '@/components/shared/badges';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getProjectStatusMeta, getRoleLabel, getVersionStatusMeta } from '@/lib/constants';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Project, ProjectMember, Profile, Version, Task } from '@/lib/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('developer');

  const isSuperAdmin = profile?.role === 'super_admin';
  const [myRole, setMyRole] = useState<string | null>(null);
  const canManage = isSuperAdmin || myRole === 'project_admin' || project?.owner_id === user?.id;

  const fetchProject = useCallback(async () => {
    if (!user) return;

    const [projectRes, membersRes, versionsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
      supabase
        .from('project_members')
        .select('*, profile:profiles(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase.from('versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*, project:projects(*), version:versions(*), assignee:profiles!assignee_id(*), reporter:profiles!reporter_id(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ]);

    setProject(projectRes.data as Project | null);
    setMembers((membersRes.data as unknown as ProjectMember[]) ?? []);
    setVersions((versionsRes.data as Version[]) ?? []);
    setTasks((tasksRes.data as unknown as Task[]) ?? []);

    const myMembership = (membersRes.data as unknown as ProjectMember[])?.find((m) => m.user_id === user.id);
    setMyRole(myMembership?.role ?? null);

    if (isSuperAdmin) {
      const { data: profilesData } = await supabase.from('profiles').select('*').eq('disabled', false);
      setAllProfiles((profilesData as Profile[]) ?? []);
    }

    setLoading(false);
  }, [user, profile, projectId, isSuperAdmin]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const addMember = async () => {
    if (!newMemberId) {
      toast.error('Please select a user');
      return;
    }
    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: newMemberId, role: newMemberRole });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Member added');
      setNewMemberId('');
      setAddMemberOpen(false);
      fetchProject();
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Member removed');
      fetchProject();
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const { error } = await supabase.from('project_members').update({ role }).eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Role updated');
      fetchProject();
    }
  };

  const deleteProject = async () => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Project deleted');
      router.push('/app/projects');
    }
  };

  const availableProfiles = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Project not found or you don't have access.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const statusMeta = getProjectStatusMeta(project.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button variant="ghost" size="icon" asChild className="hover:scale-105 transition-transform duration-200">
          <Link href="/app/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge
              variant="outline"
              className={`text-xs bg-${statusMeta.color}-500/10 text-${statusMeta.color}-600 dark:text-${statusMeta.color}-400 border-${statusMeta.color}-500/20`}
            >
              {statusMeta.label}
            </Badge>
          </div>
          {project.client_name && (
            <p className="text-sm text-muted-foreground mt-1">Client: {project.client_name}</p>
          )}
        </div>
        {canManage && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Project Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={project.status}
                    onValueChange={async (v) => {
                      await supabase.from('projects').update({ status: v }).eq('id', projectId);
                      fetchProject();
                      toast.success('Project updated');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isSuperAdmin && (
                  <div className="pt-4 border-t">
                    <Button variant="destructive" size="sm" onClick={deleteProject}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground">{project.description}</p>
      )}

      <Tabs defaultValue="overview" className="animate-fade-in-up stagger-1">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="card-hover group">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 transition-transform duration-200 group-hover:scale-110">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs">Created</span>
                </div>
                <p className="text-sm font-medium mt-1">{formatDate(project.created_at)}</p>
              </CardContent>
            </Card>
            <Card className="card-hover group">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 transition-transform duration-200 group-hover:scale-110">
                    <Tag className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs">Versions</span>
                </div>
                <p className="text-sm font-medium mt-1">{versions.length}</p>
              </CardContent>
            </Card>
            <Card className="card-hover group">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-500 transition-transform duration-200 group-hover:scale-110">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs">Members</span>
                </div>
                <p className="text-sm font-medium mt-1">{members.length}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">All Versions</h3>
            {canManage && (
              <Button size="sm" asChild>
                <Link href={`/app/projects/${projectId}/versions/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Version
                </Link>
              </Button>
            )}
          </div>
          {versions.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <EmptyState
                  icon={Tag}
                  title="No versions yet"
                  description="Create a version to start organizing tasks"
                  action={
                    canManage ? (
                      <Button size="sm" asChild>
                        <Link href={`/app/projects/${projectId}/versions/new`}>New Version</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => {
                const vMeta = getVersionStatusMeta(version.status);
                const versionTasks = tasks.filter((t) => t.version_id === version.id);
                return (
                  <Link
                    key={version.id}
                    href={`/app/projects/${projectId}/versions/${version.id}`}
                  >
                    <Card className="card-hover cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                          <Tag className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{version.name}</h4>
                          {version.description && (
                            <p className="text-xs text-muted-foreground truncate">{version.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{versionTasks.length} tasks</span>
                            {version.release_date && <span>Release: {formatDate(version.release_date)}</span>}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs bg-${vMeta.color}-500/10 text-${vMeta.color}-600 dark:text-${vMeta.color}-400 border-${vMeta.color}-500/20`}
                        >
                          {vMeta.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">All Tasks ({tasks.length})</h3>
            <Button size="sm" asChild>
              <Link href={`/app/tasks/new?project=${projectId}`}>
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Link>
            </Button>
          </div>
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <EmptyState
                  icon={FolderKanban}
                  title="No tasks yet"
                  description="Create a task to start tracking work"
                  action={
                    <Button size="sm" asChild>
                      <Link href={`/app/tasks/new?project=${projectId}`}>New Task</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/app/tasks/${task.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-soft group row-hover"
                >
                  <TypeBadge type={task.type} />
                  <span className="text-xs text-muted-foreground">#{task.number}</span>
                  <span className="text-sm flex-1 truncate">{task.title}</span>
                  {task.assignee && <UserAvatar profile={task.assignee} className="h-6 w-6" />}
                  <StatusBadge status={task.status} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Project Members ({members.length})</h3>
            {canManage && (
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">User</label>
                      <Select value={newMemberId} onValueChange={setNewMemberId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name ?? p.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project_admin">Project Admin</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="tester">Tester</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={addMember}>Add</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {members.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <EmptyState icon={Users} title="No members yet" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md border border-border"
                >
                  <UserAvatar profile={member.profile} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.profile?.full_name ?? member.profile?.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.profile?.email}</p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v) => updateMemberRole(member.id, v)}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project_admin">Project Admin</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="tester">Tester</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMember(member.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {getRoleLabel(member.role)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
