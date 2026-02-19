import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { getAuthSupabaseClient } from '../services/supabase.js';

const router = Router();
const APP_SLUG = process.env.APP_SLUG || 'quote-calculator';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function getGotrueUrl(): string {
  return (process.env.GOTRUE_URL || requireEnv('SUPABASE_URL')).replace(
    /\/+$/,
    '',
  );
}

function base64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256Base64Url(input: string): string {
  return base64Url(crypto.createHash('sha256').update(input).digest());
}

function createPkce() {
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = sha256Base64Url(codeVerifier);
  return { codeVerifier, codeChallenge };
}

function cookieDomain(): string | undefined {
  const v = process.env.COOKIE_DOMAIN;
  return v && v.trim() ? v.trim() : undefined;
}

function cookieSecure(req: Request): boolean {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const configured = process.env.COOKIE_SECURE;
  const wantSecure = configured ? configured === 'true' : nodeEnv === 'production';
  if (!wantSecure) return false;
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function cookieOpts(req: Request) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(req),
    domain: cookieDomain(),
    path: '/',
  };
}

function getBaseUrl(req: Request): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ??
    (req.secure ? 'https' : 'http');
  return `${proto}://${req.get('host')}`;
}

async function exchangeAuthCodeForSession(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authCode: string;
  codeVerifier: string;
}) {
  const res = await fetch(
    `${params.supabaseUrl}/auth/v1/token?grant_type=pkce`,
    {
      method: 'POST',
      headers: {
        apikey: params.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_code: params.authCode,
        code_verifier: params.codeVerifier,
      }),
    },
  );
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.msg || 'Auth exchange failed');
  if (!data?.access_token || !data?.refresh_token)
    throw new Error('Auth response missing tokens');
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Number(data.expires_in ?? 0),
  };
}

async function fetchSupabaseUser(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
}) {
  const res = await fetch(`${params.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}

function verifySupabaseToken(token: string): jwt.JwtPayload {
  const jwtSecret = requireEnv('SUPABASE_JWT_SECRET');
  const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null)
    throw new Error('Invalid token');
  return decoded as jwt.JwtPayload;
}

// ── GET /login/google ─────────────────────────────────────────
router.get('/login/google', (req, res) => {
  const supabaseUrl = getGotrueUrl();
  void requireEnv('SUPABASE_ANON_KEY');
  const { codeVerifier, codeChallenge } = createPkce();
  const appState = base64Url(crypto.randomBytes(16));
  const baseUrl = getBaseUrl(req);
  const redirectTo = `${baseUrl}/api/auth/callback?state=${encodeURIComponent(appState)}`;

  res.cookie('pkce_v', codeVerifier, {
    ...cookieOpts(req),
    path: '/api/auth/callback',
    maxAge: 10 * 60 * 1000,
  });
  res.cookie('app_state', appState, {
    ...cookieOpts(req),
    path: '/api/auth/callback',
    maxAge: 10 * 60 * 1000,
  });

  const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=s256`;
  res.redirect(302, authorizeUrl);
});

// ── GET /callback ─────────────────────────────────────────────
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  if (typeof code !== 'string' || !code)
    return res.status(400).send('Missing code');
  if (typeof state !== 'string' || !state)
    return res.status(400).send('Missing state');

  const codeVerifier = req.cookies.pkce_v;
  const expectedState = req.cookies.app_state;

  if (typeof codeVerifier !== 'string' || !codeVerifier)
    return res.status(400).send('Missing PKCE verifier');
  if (typeof expectedState !== 'string' || expectedState !== state)
    return res.status(400).send('Invalid state');

  try {
    const supabaseUrl = getGotrueUrl();
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');

    const session = await exchangeAuthCodeForSession({
      supabaseUrl,
      supabaseAnonKey,
      authCode: code,
      codeVerifier,
    });

    res.clearCookie('pkce_v', { path: '/api/auth/callback' });
    res.clearCookie('app_state', { path: '/api/auth/callback' });

    res.cookie('tb_access_token', session.access_token, {
      ...cookieOpts(req),
      maxAge: Math.max(60, session.expires_in) * 1000,
    });
    res.cookie('tb_refresh_token', session.refresh_token, {
      ...cookieOpts(req),
      maxAge: 60 * 60 * 24 * 30 * 1000,
    });

    res.redirect(302, '/');
  } catch (err) {
    res
      .status(400)
      .send(err instanceof Error ? err.message : 'Auth callback failed');
  }
});

// ── POST /logout ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('tb_access_token', cookieOpts(req));
  res.clearCookie('tb_refresh_token', cookieOpts(req));
  res.status(204).end();
});

// ── GET /session ──────────────────────────────────────────────
router.get('/session', async (req: Request, res: Response) => {
  const token =
    typeof req.cookies.tb_access_token === 'string'
      ? req.cookies.tb_access_token
      : null;

  if (!token) return res.json({ session: null, access: null });

  try {
    const decoded = verifySupabaseToken(token);
    const userId = typeof decoded.sub === 'string' ? decoded.sub : null;
    if (!userId) return res.json({ session: null, access: null });

    const supabaseUrl = getGotrueUrl();
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const user = await fetchSupabaseUser({
      supabaseUrl,
      supabaseAnonKey,
      accessToken: token,
    });

    const supabase = getAuthSupabaseClient();
    if (!supabase)
      return res
        .status(503)
        .json({ error: { message: 'DB not configured' } });

    const { data: access, error: accessError } = await supabase
      .from('effective_user_app_access_view')
      .select('role_slug,role_name,is_admin')
      .eq('user_id', userId)
      .eq('app_slug', APP_SLUG)
      .eq('is_active', true)
      .eq('app_is_active', true)
      .maybeSingle();

    if (accessError)
      logger.warn(`Failed to load app access: ${accessError.message}`);

    res.json({
      session: user
        ? { user }
        : {
            user: {
              id: userId,
              email: decoded.email ?? null,
              user_metadata: null,
            },
          },
      access: access ?? null,
    });
  } catch (err) {
    logger.warn(err instanceof Error ? err.message : 'Invalid token');
    res.json({ session: null, access: null });
  }
});

export default router;
