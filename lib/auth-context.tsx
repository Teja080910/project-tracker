'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@/lib/supabase/client';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  teamAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  teamAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamAdmin, setTeamAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    const profile = data as Profile | null;
    if (profile?.disabled) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setTeamAdmin(false);
      setLoading(false);
      return;
    }
    setProfile(profile);

    const [memberships, ownedTeams] = await Promise.all([
      supabase.from('team_members').select('role').eq('user_id', uid),
      supabase.from('teams').select('id').eq('owner_id', uid),
    ]);
    setTeamAdmin(
      (memberships.data ?? []).some((row: { role?: string }) => row.role === 'team_admin') ||
        (ownedTeams.data ?? []).length > 0
    );
  };

  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setTeamAdmin(false);
        setLoading(false);
        return;
      }
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !user) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setTeamAdmin(false);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(user);
      fetchProfile(user.id).finally(() => mounted && setLoading(false));
    };

    validateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setTeamAdmin(false);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setProfile(null);
        setTeamAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setTeamAdmin(false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, teamAdmin, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
