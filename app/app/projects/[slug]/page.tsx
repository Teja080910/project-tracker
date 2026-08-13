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
  Check,
  Loader2,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { sendNotificationEmail } from '@/lib/email-client';
import { getProjectStatusMeta, getRoleLabel, getVersionStatusMeta } from '@/lib/constants';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Project, ProjectMember, Profile, Version } from '@/lib/types';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const projectSlug = params.slug as string;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('developer');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const MEMBER_PAGE_SIZE = 10;
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const isSuperAdmin = profile?.role === 'super_admin';
  const [myRole, setMyRole] = useState<string | null>(null);
  const canManage = isSuperAdmin || myRole === 'project_admin' || project?.owner_id === user?.id;

  const fetchProject = useCallback(async () => {
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
    const pid = projectData.id;

    const [membersRes, versionsRes] = await Promise.all([
      supabase
        .from('project_members')
        .select('*, profile:profiles(*)')
        .eq('project_id', pid)
        .order('created_at', { ascending: true }),
      supabase.from('versions').select('*').eq('project_id', pid).order('created_at', { ascending: false }),
    ]);

    setMembers((membersRes.data as unknown as ProjectMember[]) ?? []);
    setVersions((versionsRes.data as Version[]) ?? []);

    const myMembership = (membersRes.data as unknown as ProjectMember[])?.find((m) => m.user_id === user.id);
    setMyRole(myMembership?.role ?? null);

    if (isSuperAdmin || myMembership?.role === 'project_admin' || projectData.owner_id === user.id) {
      const { data: profilesData } = await supabase.from('profiles').select('*').eq('disabled', false);
      setAllProfiles((profilesData as Profile[]) ?? []);
    }

    setLoading(false);
  }, [user, profile, projectSlug, isSuperAdmin]);

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
      .insert({ project_id: project?.id, user_id: newMemberId, role: newMemberRole });
    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from('notifications').insert({
        user_id: newMemberId,
        actor_id: user?.id,
        project_id: project?.id,
        type: 'member_added',
        title: `You were added to ${project?.name}`,
        body: `Role: ${getRoleLabel(newMemberRole)}`,
        link: `/app/projects/${projectSlug}`,
      });
      const newMember = allProfiles.find((p) => p.id === newMemberId);
      if (newMember) {
        sendNotificationEmail(
          newMember.email,
          `You were added to ${project?.name}`,
          `Role: ${getRoleLabel(newMemberRole)}`,
          `${window.location.origin}/app/projects/${projectSlug}`
        );
      }
      setNewMemberId('');
      setAddMemberOpen(false);
      await fetchProject();
      toast.success('Member added');
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      await fetchProject();
      toast.success('Member removed');
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const { error } = await supabase.from('project_members').update({ role }).eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      await fetchProject();
      toast.success('Role updated');
    }
  };

  const deleteProject = async () => {
    const { error } = await supabase.from('projects').delete().eq('id', project?.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Project deleted');
      router.push('/app/projects');
    }
  };

  const saveProject = async () => {
    if (!editName.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        client_name: editClientName.trim() || null,
      })
      .eq('id', project?.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      await fetchProject();
      setSettingsOpen(false);
      toast.success('Project updated');
    }
  };

  const availableProfiles = allProfiles.filter(
    (p) => !members.some((m) => m.user_id === p.id)
  );

  const memberSearchResults = availableProfiles.filter((p) => {
    const q = memberSearch.toLowerCase();
    return (
      (p.full_name ?? '').toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });

  const memberPageItems = memberSearchResults.slice((memberPage - 1) * MEMBER_PAGE_SIZE, memberPage * MEMBER_PAGE_SIZE);
  const memberTotalPages = Math.max(1, Math.ceil(memberSearchResults.length / MEMBER_PAGE_SIZE));
  useEffect(() => {
    if (memberPage > memberTotalPages) setMemberPage(1);
  }, [memberPage, memberTotalPages, memberSearch]);

  const pageVersions = versions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(versions.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

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
        <p className="text-sm text-muted-foreground">Project not found or you don&apos;t have access.</p>
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
          <Dialog open={settingsOpen} onOpenChange={(open) => {
            setSettingsOpen(open);
            if (open) {
              setEditName(project.name);
              setEditDescription(project.description ?? '');
              setEditClientName(project.client_name ?? '');
            }
          }}>
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
                  <label className="text-sm font-medium">Name</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    placeholder="Brief description of the project..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name</label>
                  <Input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={project.status}
                    onValueChange={async (v) => {
                      await supabase.from('projects').update({ status: v }).eq('id', project?.id);
                      await fetchProject();
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={saveProject} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
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
        <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">{project.description}</p>
      )}

      <div className="grid sm:grid-cols-3 gap-4 animate-fade-in-up stagger-1">
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

      {/* Versions */}
      <div className="space-y-4 animate-fade-in-up stagger-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">All Versions</h3>
          {canManage && (
            <Button size="sm" asChild>
              <Link href={`/app/projects/${projectSlug}/versions/new`}>
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
                      <Link href={`/app/projects/${projectSlug}/versions/new`}>New Version</Link>
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pageVersions.map((version) => {
              const vMeta = getVersionStatusMeta(version.status);
              return (
                <Link
                  key={version.id}
                  href={`/app/projects/${projectSlug}/versions/${version.slug}`}
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
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={versions.length}
          onPageChange={setPage}
        />
      </div>

      {/* Members */}
      <div className="space-y-4 animate-fade-in-up stagger-1">
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
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <div className="border border-border rounded-lg">
                      {memberSearchResults.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No user found.</p>
                      ) : (
                        <>
                          <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                            {memberPageItems.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setNewMemberId(p.id);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-none text-left transition-colors ${
                                  newMemberId === p.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                                }`}
                              >
                                <Check
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    newMemberId === p.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <UserAvatar profile={p} className="h-7 w-7 shrink-0" />
                                <span className="flex flex-col min-w-0">
                                  <span className="truncate text-sm">{p.full_name ?? p.email}</span>
                                  {p.full_name && (
                                    <span className="text-[11px] text-muted-foreground truncate mt-0.5">{p.email}</span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                          {memberSearchResults.length > MEMBER_PAGE_SIZE && (
                            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-border/60 bg-secondary/30">
                              <p className="text-[11px] text-muted-foreground">
                                {memberSearchResults.length} users
                              </p>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={memberPage <= 1}
                                  onClick={() => setMemberPage(memberPage - 1)}
                                >
                                  Prev
                                </Button>
                                <span className="text-[11px] text-muted-foreground px-1">
                                  {memberPage} / {memberTotalPages}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={memberPage >= memberTotalPages}
                                  onClick={() => setMemberPage(memberPage + 1)}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
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
      </div>
    </div>
  );
}
