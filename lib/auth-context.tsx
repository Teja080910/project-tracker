'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@/lib/platform/client';
import { platform } from '@/lib/platform/client';
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

  const clearAuth = () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setTeamAdmin(false);
    setLoading(false);
  };

  // A session without a profile is not a usable login: the app shell would
  // render with a "Viewer" placeholder and every page would sit in its
  // skeleton forever. Reject it like any other invalid session.
  const fetchProfile = async (uid: string): Promise<boolean> => {
    const { data, error } = await platform
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    const profile = data as Profile | null;
    if (error || !profile || profile.disabled) {
      await platform.auth.signOut();
      clearAuth();
      return false;
    }
    setProfile(profile);

    const [memberships, ownedTeams] = await Promise.all([
      platform.from('team_members').select('role').eq('user_id', uid),
      platform.from('teams').select('id').eq('owner_id', uid),
    ]);
    setTeamAdmin(
      (memberships.data ?? []).some((row: { role?: string }) => row.role === 'team_admin') ||
        (ownedTeams.data ?? []).length > 0
    );
    return true;
  };

  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      try {
        const { data: { session } } = await platform.auth.getSession();
        if (!mounted) return;
        if (!session) {
          clearAuth();
          return;
        }
        const { data: { user }, error } = await platform.auth.getUser();
        if (!mounted) return;
        if (error || !user) {
          await platform.auth.signOut();
          clearAuth();
          return;
        }
        setSession(session);
        setUser(user);
        await fetchProfile(user.id);
        if (mounted) setLoading(false);
      } catch {
        if (mounted) clearAuth();
      }
    };

    validateSession();

    const {
      data: { subscription },
    } = platform.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        clearAuth();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        void fetchProfile(session.user.id).finally(() => mounted && setLoading(false));
      } else {
        clearAuth();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await platform.auth.signOut();
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
