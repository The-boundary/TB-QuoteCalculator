import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type User = {
  id: string;
  email?: string | null;
  user_metadata?: unknown;
};

type Session = { user: User } | null;
type AuthError = { message: string };
type AppAccess = { role_slug: string; role_name: string; is_admin: boolean };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  access: AppAccess | null;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  refreshAccess: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AppAccess | null>(null);

  const refreshAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (!res.ok) return;
      const data: Record<string, unknown> = await res.json();
      const acc = data?.access;
      if (acc && typeof acc === 'object') {
        const a = acc as Record<string, unknown>;
        setAccess({
          role_slug: String(a.role_slug ?? ''),
          role_name: String(a.role_name ?? ''),
          is_admin: Boolean(a.is_admin),
        });
      } else {
        setAccess(null);
      }
    } catch {
      setAccess(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        const payload: Record<string, unknown> | null = res.ok ? await res.json() : null;
        if (!mounted) return;
        if (!payload) {
          setSession(null);
          setUser(null);
          setAccess(null);
          setLoading(false);
          return;
        }

        const sess = payload.session as Record<string, unknown> | undefined;
        const sessUser = sess?.user as Record<string, unknown> | undefined;
        if (sessUser?.id) {
          const userObj: User = {
            id: String(sessUser.id),
            email: (sessUser.email as string) ?? null,
            user_metadata: sessUser.user_metadata ?? null,
          };
          setUser(userObj);
          setSession({ user: userObj });
        } else {
          setUser(null);
          setSession(null);
        }

        const acc = payload.access;
        if (acc && typeof acc === 'object') {
          const a = acc as Record<string, unknown>;
          setAccess({
            role_slug: String(a.role_slug ?? ''),
            role_name: String(a.role_name ?? ''),
            is_admin: Boolean(a.is_admin),
          });
        } else {
          setAccess(null);
        }
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Auth initialization error:', err);
        if (mounted) setLoading(false);
      }
    };
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    window.location.assign('/api/auth/login/google');
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setSession(null);
      setUser(null);
      setAccess(null);
      return { error: null };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Sign out failed' } };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, access, signInWithGoogle, signOut, refreshAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
