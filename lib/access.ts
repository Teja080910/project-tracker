import { supabase } from '@/lib/supabase/client';
import type { Profile, TeamRole } from '@/lib/types';

export function isGlobalAdmin(profile: Profile | null | undefined) {
  return profile?.role === 'super_admin' || profile?.role === 'admin';
}

export interface TeamAccess {
  /** team_id -> role. Team owners are stored as `owner`. */
  roles: Map<string, TeamRole | 'owner'>;
  adminTeamIds: Set<string>;
}

export async function loadTeamAccess(userId: string): Promise<TeamAccess> {
  const [memberships, ownedTeams] = await Promise.all([
    supabase.from('team_members').select('team_id, role').eq('user_id', userId),
    supabase.from('teams').select('id').eq('owner_id', userId),
  ]);

  const roles = new Map<string, TeamRole | 'owner'>();
  const adminTeamIds = new Set<string>();

  for (const row of (memberships.data ?? []) as Array<{ team_id: string; role: TeamRole }>) {
    roles.set(row.team_id, row.role);
    if (row.role === 'team_admin') adminTeamIds.add(row.team_id);
  }
  for (const row of (ownedTeams.data ?? []) as Array<{ id: string }>) {
    roles.set(row.id, 'owner');
    adminTeamIds.add(row.id);
  }

  return { roles, adminTeamIds };
}
