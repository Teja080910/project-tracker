'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Check,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BackButton } from '@/components/shared/back-button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { isGlobalAdmin, loadTeamAccess, type TeamAccess } from '@/lib/access';
import { TEAM_ROLES, getProjectStatusMeta, getRoleLabel } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { Profile, Project, Team, TeamMember, TeamRole } from '@/lib/types';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const slug = params.slug as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [access, setAccess] = useState<TeamAccess | null>(null);
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('developer');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectStatus, setProjectStatus] = useState('active');
  const [creatingProject, setCreatingProject] = useState(false);

  const [removeMemberTarget, setRemoveMemberTarget] = useState<TeamMember | null>(null);
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false);

  const globalAdmin = isGlobalAdmin(profile);

  const fetchTeam = useCallback(async () => {
    if (!user || !profile) return;

    const { data: teamData } = await supabase.from('teams').select('*').eq('slug', slug).maybeSingle();
    const teamRow = teamData as Team | null;
    setTeam(teamRow);
    if (!teamRow) {
      setLoading(false);
      return;
    }

    const [memberRes, projectRes, accessData, ownerRes] = await Promise.all([
      supabase
        .from('team_members')
        .select('*, profile:profiles(*)')
        .eq('team_id', teamRow.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('projects')
        .select('*, team:teams(*)')
        .eq('team_id', teamRow.id)
        .order('created_at', { ascending: false }),
      loadTeamAccess(user.id),
      supabase.from('profiles').select('*').eq('id', teamRow.owner_id).maybeSingle(),
    ]);

    setMembers((memberRes.data as unknown as TeamMember[]) ?? []);
    setProjects((projectRes.data as unknown as Project[]) ?? []);
    setAccess(accessData);
    setOwnerProfile((ownerRes.data as Profile | null) ?? null);
    setEditName(teamRow.name);
    setEditDescription(teamRow.description ?? '');

    if (isGlobalAdmin(profile) || accessData.adminTeamIds.has(teamRow.id) || teamRow.owner_id === user.id) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .eq('disabled', false)
        .order('full_name', { ascending: true });
      setProfiles((profileRows as Profile[]) ?? []);
    }

    setLoading(false);
  }, [user, profile, slug]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const canManage = !!team && (globalAdmin || access?.adminTeamIds.has(team.id) || team.owner_id === user?.id);
  const isOwner = !!team && team.owner_id === user?.id;

  const saveTeam = async () => {
    if (!team) return;
    if (!editName.trim()) {
      toast.error('Team name is required');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('teams')
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq('id', team.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSettingsOpen(false);
    const updated = data as Team;
    if (updated.slug && updated.slug !== slug) {
      router.replace(`/app/teams/${updated.slug}`);
    } else {
      await fetchTeam();
    }
    toast.success('Team updated');
  };

  const deleteTeam = async () => {
    if (!team) return;
    setDeleting(true);
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Team deleted');
    router.push('/app/teams');
  };

  const addMember = async () => {
    if (!team || !user) return;
    if (!newMemberId) {
      toast.error('Please select a user');
      return;
    }
    const { error } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: newMemberId,
      role: newMemberRole,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from('notifications').insert({
      user_id: newMemberId,
      actor_id: user.id,
      type: 'team_member_added',
      title: `You were added to ${team.name}`,
      body: `Role: ${getRoleLabel(newMemberRole)}`,
      link: `/app/teams/${team.slug}`,
    });
    setAddMemberOpen(false);
    setNewMemberId('');
    setNewMemberRole('developer');
    setMemberSearch('');
    await fetchTeam();
    toast.success('Team member added');
  };

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    const { error } = await supabase.from('team_members').update({ role }).eq('id', memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await fetchTeam();
    toast.success('Role updated');
  };

  const confirmRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setRemoveMemberLoading(true);
    const { error } = await supabase.from('team_members').delete().eq('id', removeMemberTarget.id);
    setRemoveMemberLoading(false);
    setRemoveMemberTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await fetchTeam();
    toast.success('Team member removed');
  };

  const createProject = async () => {
    if (!team || !user) return;
    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }
    setCreatingProject(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        client_name: projectClient.trim() || null,
        status: projectStatus,
        team_id: team.id,
        owner_id: user.id,
      })
      .select()
      .single();
    if (error) {
      setCreatingProject(false);
      toast.error(error.message);
      return;
    }

    if (globalAdmin) {
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        role: 'project_admin',
      });
    }
    await supabase.from('activity_logs').insert({
      project_id: data.id,
      user_id: user.id,
      action: 'created project',
      entity_type: 'project',
      entity_id: data.id,
    });

    setCreatingProject(false);
    setProjectModalOpen(false);
    setProjectName('');
    setProjectDescription('');
    setProjectClient('');
    setProjectStatus('active');
    await fetchTeam();
    toast.success('Project created');
  };

  const availableProfiles = profiles.filter((p) => !members.some((m) => m.user_id === p.id));
  const searchResults = availableProfiles.filter((p) => {
    const q = memberSearch.toLowerCase();
    return (p.full_name ?? '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Team not found or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 animate-fade-in-up">
        <BackButton fallbackHref="/app/teams" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UsersRound className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
            {isOwner && <Badge variant="outline" className="text-[10px]">Owner</Badge>}
            {!isOwner && access?.roles.get(team.id) && (
              <Badge variant="outline" className="text-[10px]">
                {getRoleLabel(access.roles.get(team.id)!)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(team.created_at)} · {members.length} members · {projects.length} projects
          </p>
        </div>
        {canManage && (
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Team Settings</DialogTitle>
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
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveTeam} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
                <div className="pt-4 border-t">
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {team.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{team.description}</p>
      )}

      <div className="space-y-4 animate-fade-in-up stagger-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Projects ({projects.length})</h3>
          {canManage && (
            <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Project in {team.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name *</label>
                    <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Client Name</label>
                      <Input value={projectClient} onChange={(e) => setProjectClient(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select value={projectStatus} onValueChange={setProjectStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={createProject} disabled={creatingProject}>
                    {creatingProject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description={canManage ? 'Create the first project for this team' : 'Team projects will appear here'}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => {
              const statusMeta = getProjectStatusMeta(project.status);
              return (
                <Link key={project.id} href={`/app/projects/${project.slug}`}>
                  <Card className="card-hover">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {project.client_name ? `Client: ${project.client_name}` : formatDate(project.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{statusMeta.label}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4 animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Members ({members.some((m) => m.user_id === team.owner_id) ? members.length : members.length + 1})
          </h3>
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
                  <DialogTitle>Add Team Member</DialogTitle>
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
                    <div className="border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border/50">
                      {searchResults.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No user found.</p>
                      ) : (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setNewMemberId(p.id)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                              newMemberId === p.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                            )}
                          >
                            <Check className={cn('h-4 w-4 shrink-0', newMemberId === p.id ? 'opacity-100' : 'opacity-0')} />
                            <UserAvatar profile={p} className="h-7 w-7 shrink-0" />
                            <span className="flex flex-col min-w-0">
                              <span className="truncate text-sm">{p.full_name ?? p.email}</span>
                              {p.full_name && <span className="text-[11px] text-muted-foreground truncate">{p.email}</span>}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as TeamRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEAM_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
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

        <div className="space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/30">
            <UserAvatar profile={ownerProfile} className="h-8 w-8" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {ownerProfile?.full_name ?? ownerProfile?.email ?? 'Team owner'}
              </p>
              <p className="text-xs text-muted-foreground">Team owner</p>
            </div>
            <Badge variant="outline" className="text-xs">Owner</Badge>
          </div>
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
              <UserAvatar profile={member.profile} className="h-8 w-8" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.profile?.full_name ?? member.profile?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{member.profile?.email}</p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as TeamRole)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEAM_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveMemberTarget(member)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">{getRoleLabel(member.role)}</Badge>
              )}
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">
            No team members yet. Add people so they can access this team&apos;s projects.
          </p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Team"
        description={`Delete "${team.name}"? Projects stay in the system but will no longer belong to a team.`}
        confirmText={team.name}
        onConfirm={deleteTeam}
        loading={deleting}
      />

      <ConfirmDeleteDialog
        open={!!removeMemberTarget}
        onOpenChange={(open) => { if (!open) setRemoveMemberTarget(null); }}
        title="Remove Team Member"
        description={`Remove ${removeMemberTarget?.profile?.full_name ?? removeMemberTarget?.profile?.email ?? 'this member'} from the team? They will lose access to the team's projects unless added directly.`}
        confirmText={removeMemberTarget?.profile?.full_name ?? removeMemberTarget?.profile?.email ?? ''}
        onConfirm={confirmRemoveMember}
        loading={removeMemberLoading}
      />

    </div>
  );
}
