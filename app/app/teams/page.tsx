'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, Loader2, Plus, Search, UsersRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { isGlobalAdmin, loadTeamAccess, type TeamAccess } from '@/lib/access';
import { getRoleLabel } from '@/lib/constants';
import { toast } from 'sonner';
import type { Team } from '@/lib/types';

interface TeamCounts {
  members: Record<string, number>;
  projects: Record<string, number>;
}

export default function TeamsPage() {
  const { profile, user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [access, setAccess] = useState<TeamAccess | null>(null);
  const [counts, setCounts] = useState<TeamCounts>({ members: {}, projects: {} });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const globalAdmin = isGlobalAdmin(profile);

  const fetchTeams = useCallback(async () => {
    if (!user || !profile) return;
    const [teamsRes, memberRes, projectRes, teamAccess] = await Promise.all([
      supabase.from('teams').select('*').order('name', { ascending: true }),
      supabase.from('team_members').select('team_id').limit(1000),
      supabase.from('projects').select('id, team_id').limit(1000),
      loadTeamAccess(user.id),
    ]);

    const memberCounts: Record<string, number> = {};
    for (const row of (memberRes.data ?? []) as Array<{ team_id: string }>) {
      memberCounts[row.team_id] = (memberCounts[row.team_id] ?? 0) + 1;
    }
    const projectCounts: Record<string, number> = {};
    for (const row of (projectRes.data ?? []) as Array<{ team_id: string | null }>) {
      if (row.team_id) projectCounts[row.team_id] = (projectCounts[row.team_id] ?? 0) + 1;
    }

    setTeams((teamsRes.data as Team[]) ?? []);
    setAccess(teamAccess);
    setCounts({ members: memberCounts, projects: projectCounts });
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async () => {
    if (!user || !globalAdmin) return;
    if (!name.trim()) {
      toast.error('Team name is required');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: user.id,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setModalOpen(false);
    setName('');
    setDescription('');
    await fetchTeams();
    toast.success('Team created');
  };

  const filtered = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(search.toLowerCase()) ||
      (team.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {globalAdmin ? `${teams.length} teams` : `${teams.length} teams you belong to`}
          </p>
        </div>
        {globalAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Team
          </Button>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Name *</Label>
              <Input
                id="team-name"
                placeholder="e.g. Mobile Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                placeholder="What does this team work on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={createTeam} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm animate-fade-in-up stagger-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="animate-fade-in-up stagger-2">
          <CardContent className="py-6">
            <EmptyState
              icon={UsersRound}
              title={search ? 'No teams found' : 'No teams yet'}
              description={
                search
                  ? 'Try a different search term'
                  : globalAdmin
                    ? 'Create a team, then add projects and people to it'
                    : 'A global admin can add you to a team'
              }
              action={globalAdmin && !search ? <Button onClick={() => setModalOpen(true)}>New Team</Button> : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((team, i) => {
            const role = access?.roles.get(team.id);
            return (
              <Link key={team.id} href={`/app/teams/${team.slug}`}>
                <Card className={`card-hover h-full animate-fade-in-up stagger-${Math.min(i + 1, 7)}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UsersRound className="h-4 w-4" />
                      </div>
                      {role && (
                        <Badge variant="outline" className="text-[10px]">
                          {role === 'owner' ? 'Team Owner' : getRoleLabel(role)}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{team.name}</h3>
                    {team.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{team.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                      <span className="flex items-center gap-1">
                        <UsersRound className="h-3 w-3" />
                        {counts.members[team.id] ?? 0} members
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {counts.projects[team.id] ?? 0} projects
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
