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
      .single();

    if (error) {
      console.error('[useAuth] Failed to fetch profile:', error.message);
      return null;
    }

    return data as Profile;
  }, []);

  // ------------------------------------------------------------------
  // Session bootstrap + realtime subscription
  // ------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    // 1. Restore existing session (if any)
    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);

          if (!isMounted) return;

          setState({
            session,
            user: session.user,
            profile,
            role: profile?.role ?? null,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setState({ ...initialState, isLoading: false });
        }
      } catch (err) {
        console.error('[useAuth] Bootstrap error:', err);
        if (isMounted) {
          setState({ ...initialState, isLoading: false });
        }
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

      if (!profile || profile.role !== 'admin') {
        // Not an admin -- sign them back out immediately
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
  // Sign-in: Team
  // ------------------------------------------------------------------

  const signInTeam = useCallback(
    async (username: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Team accounts sign in with their username used as an email-style
      // identifier.  The Supabase auth table stores the email; the caller
      // may pass either a bare username or a full email.
      const email = username.includes('@') ? username : username;

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

      if (!profile || profile.role !== 'team') {
        await supabase.auth.signOut();
        setState({ ...initialState, isLoading: false });
        throw new Error('Access denied. This account does not have team privileges.');
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
  };
}
