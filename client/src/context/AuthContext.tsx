import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type User = {
  id: string;
  email?: string | null;
  user_metadata?: unknown;
};

type AuthError = { message: string };
type AppAccess = { role_slug: string; role_name: string; is_admin: boolean };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  access: AppAccess | null;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseAccess(raw: unknown): AppAccess | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  return {
    role_slug: String(a.role_slug ?? ''),
    role_name: String(a.role_name ?? ''),
    is_admin: Boolean(a.is_admin),
  };
}

function parseUser(payload: Record<string, unknown>): User | null {
  const sess = payload.session as Record<string, unknown> | undefined;
  const sessUser = sess?.user as Record<string, unknown> | undefined;
  if (!sessUser?.id) return null;
  return {
    id: String(sessUser.id),
    email: (sessUser.email as string) ?? null,
    user_metadata: sessUser.user_metadata ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AppAccess | null>(null);

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (!mounted) return;
        const payload: Record<string, unknown> | null = res.ok ? await res.json() : null;
        if (!mounted) return;
        if (!payload) {
          setUser(null);
          setAccess(null);
          setLoading(false);
          return;
        }
        setUser(parseUser(payload));
        setAccess(parseAccess(payload.access));
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Auth initialization error:', err);
        if (mounted) setLoading(false);
      }
    }
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
      setUser(null);
      setAccess(null);
      return { error: null };
    } catch (err) {
      return { error: { message: err instanceof Error ? err.message : 'Sign out failed' } };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, access, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
