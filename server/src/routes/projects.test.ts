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

  const mod = await import('./projects.js');
  app.use('/api/projects', mod.default);
  return app;
}

describe('projects routes', () => {
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

  it('GET /api/projects returns list', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Project 1', quote_count: 1 }] });
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /api/projects creates forecasted project', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', development_id: 'd1', name: 'Masterplan', is_forecasted: true }],
    });

    const res = await request(app).post('/api/projects').send({
      development_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Masterplan',
    });

    expect(res.status).toBe(201);
    expect(res.body.is_forecasted).toBe(true);
  });

  it('POST /api/projects uses null created_by during dev auth bypass', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';

    mockDbQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', development_id: 'd1', name: 'Masterplan', is_forecasted: true }],
    });

    const res = await request(app).post('/api/projects').send({
      development_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Masterplan',
    });
    expect(res.status).toBe(201);

    const insertCall = mockDbQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO projects'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params[4]).toBeNull();
  });

  it('POST /api/projects/:id/link links project to kantata id', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'p1', kantata_id: '23046', is_forecasted: false }] });

    const res = await request(app).post('/api/projects/p1/link').send({ kantata_id: '23046' });
    expect(res.status).toBe(200);
    expect(res.body.kantata_id).toBe('23046');
  });
});
