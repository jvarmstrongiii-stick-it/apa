import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

/**
 * The shape exposed by the AuthContext is exactly the return type of
 * the `useAuth` hook -- session, user, profile, role, loading state,
 * and the sign-in / sign-out helpers.
 */
type AuthContextType = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Wrap your root component tree with `<AuthProvider>` so that every
 * descendant can call `useAuthContext()` to access authentication state.
 *
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * Convenience hook to consume the auth context.
 *
 * Throws if called outside of an `<AuthProvider>` so that missing
 * providers are caught early during development.
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuthContext must be used within an <AuthProvider>. ' +
        'Make sure your component tree is wrapped with <AuthProvider>.',
    );
  }

  return context;
}
