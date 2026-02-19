import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenvConfig({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  PORT: z.string().default('3048'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  GOOGLE_WORKSPACE_DOMAIN: z.string().default('the-boundary.com'),
  APP_SLUG: z.string().default('quote-calculator'),
  CORS_ORIGIN: z.string().default('http://192.168.0.51:5174'),
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  supabaseJwtSecret: parsed.data.SUPABASE_JWT_SECRET,
  supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
  googleWorkspaceDomain: parsed.data.GOOGLE_WORKSPACE_DOMAIN,
  appSlug: parsed.data.APP_SLUG,
  corsOrigin: parsed.data.CORS_ORIGIN,
  cookieDomain: parsed.data.COOKIE_DOMAIN,
} as const;
