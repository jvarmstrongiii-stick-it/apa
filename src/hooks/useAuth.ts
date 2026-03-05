import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import { type Session, type User } from '@supabase/supabase-js';
import { type UserRole, type Profile } from '../lib/supabase/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
};

/**
 * Core authentication hook.
 *
 * - Restores the persisted session on mount.
 * - Subscribes to Supabase auth state changes (token refresh, sign-out, etc.).
 * - Fetches the user's profile row to determine role after every login.
 * - Exposes `signInAdmin`, `signInTeam`, and `signOut` helpers.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  // ------------------------------------------------------------------
  // Profile fetcher
  // ------------------------------------------------------------------

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[useAuth] Failed to fetch profile:', error.message);
      return null;
    }

    return data as Profile | null;
  }, []);

  // ------------------------------------------------------------------
  // Session bootstrap + realtime subscription
  // ------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    // 1. Always clear any persisted session on cold launch.
    //    Players and admins must select their team / role every time they open the app.
    //    "My Teams" memory in SecureStore still pre-populates the picker for quick re-selection.
    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          await supabase.auth.signOut();
        }

        if (isMounted) setState({ ...initialState, isLoading: false });
      } catch (err) {
        console.error('[useAuth] Bootstrap error:', err);
        if (isMounted) setState({ ...initialState, isLoading: false });
      }
    };

    bootstrap();

    // 2. Subscribe to auth changes (token refresh, sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setState({ ...initialState, isLoading: false });
          return;
        }

        // For SIGNED_IN, TOKEN_REFRESHED, etc.
        const profile = session.user
          ? await fetchProfile(session.user.id)
          : null;

        if (!isMounted) return;

        setState({
          session,
          user: session.user,
          profile,
          role: profile?.role ?? null,
          isLoading: false,
          isAuthenticated: true,
        });
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ------------------------------------------------------------------
  // Sign-in: Admin
  // ------------------------------------------------------------------

  const signInAdmin = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw new Error(error.message);
      }

      const user = data.user;
      if (!user) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw new Error('Sign-in succeeded but no user was returned.');
      }

      const profile = await fetchProfile(user.id);

      if (!profile || (profile.role !== 'admin' && profile.role !== 'lo')) {
        // Not an admin or LO -- sign them back out immediately
        await supabase.auth.signOut();
        setState({ ...initialState, isLoading: false });
        throw new Error('Access denied. This account does not have admin privileges.');
      }

      setState({
        session: data.session,
        user,
        profile,
        role: profile.role,
        isLoading: false,
        isAuthenticated: true,
      });

      return { session: data.session, user, profile };
    },
    [fetchProfile],
  );

  // ------------------------------------------------------------------
  // Sign-in: Team (anonymous auth — no email or password required)
  // ------------------------------------------------------------------

  const signInTeam = useCallback(
    async (teamId: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Create an anonymous Supabase session — players never type credentials.
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw new Error(error.message);
      }

      const user = data.user;
      if (!user) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw new Error('Sign-in succeeded but no user was returned.');
      }

      // Link this anonymous session to the chosen team via a SECURITY DEFINER
      // RPC that upserts the profile row (bypasses RLS for the insert).
      const { error: rpcError } = await supabase.rpc('set_player_team', {
        p_team_id: teamId,
      });

      if (rpcError) {
        await supabase.auth.signOut();
        setState({ ...initialState, isLoading: false });
        throw new Error('Could not save team selection. Please try again.');
      }

      const profile = await fetchProfile(user.id);

      setState({
        session: data.session,
        user,
        profile,
        role: profile?.role ?? null,
        isLoading: false,
        isAuthenticated: true,
      });

      return { session: data.session, user, profile };
    },
    [fetchProfile],
  );

  // ------------------------------------------------------------------
  // Refresh profile (call after mutating the profile row, e.g. team selection)
  // ------------------------------------------------------------------

  const refreshProfile = useCallback(async () => {
    const userId = state.user?.id;
    if (!userId) return;
    const profile = await fetchProfile(userId);
    setState((prev) => ({ ...prev, profile, role: profile?.role ?? null }));
  }, [state.user?.id, fetchProfile]);

  // ------------------------------------------------------------------
  // Sign-out
  // ------------------------------------------------------------------

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[useAuth] Sign-out error:', error.message);
    }

    setState({ ...initialState, isLoading: false });
  }, []);

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return {
    session: state.session,
    user: state.user,
    profile: state.profile,
    role: state.role,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    signInAdmin,
    signInTeam,
    signOut,
    refreshProfile,
  };
}
