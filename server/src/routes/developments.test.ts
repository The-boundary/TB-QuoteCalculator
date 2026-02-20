import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockDbQuery = vi.fn();

vi.mock('../services/supabase.js', () => ({
  dbQuery: (...args: unknown[]) => mockDbQuery(...args),
  dbTransaction: vi.fn(),
  getAuthSupabaseClient: () => null,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      email: 'stan@the-boundary.com',
      role: 'admin',
      aud: 'authenticated',
      appAccess: { role_slug: 'admin', is_admin: true },
    };
    next();
  });

  const mod = await import('./developments.js');
  app.use('/api/developments', mod.default);
  return app;
}

describe('developments routes', () => {
  let app: express.Express;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDevBypass = process.env.DEV_AUTH_BYPASS;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEV_AUTH_BYPASS = originalDevBypass;
    app = await createApp();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEV_AUTH_BYPASS = originalDevBypass;
  });

  it('GET /api/developments returns list', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'd1', name: 'Dubai', project_count: 2 }] });
    const res = await request(app).get('/api/developments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /api/developments creates development', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'd1', name: 'Dubai' }] });
    const res = await request(app).post('/api/developments').send({ name: 'Dubai' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('d1');
  });

  it('POST /api/developments uses null created_by during dev auth bypass', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'd1', name: 'Dubai' }] });

    const res = await request(app).post('/api/developments').send({ name: 'Dubai' });
    expect(res.status).toBe(201);

    const insertCall = mockDbQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO developments'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params[3]).toBeNull();
  });
});
