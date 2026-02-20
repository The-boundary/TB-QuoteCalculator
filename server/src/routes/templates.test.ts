import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

type QueryResult = { rows: unknown[]; rowCount?: number };
type TxClient = { query: (...args: unknown[]) => Promise<QueryResult> };
type TxFn = (client: TxClient) => Promise<unknown>;

const mockDbQuery = vi.fn();
const mockDbTransaction = vi.fn();

vi.mock('../services/supabase.js', () => ({
  dbQuery: (...args: unknown[]) => mockDbQuery(...args),
  dbTransaction: (...args: unknown[]) => mockDbTransaction(...args),
  getAuthSupabaseClient: () => null,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function createApp(isAdmin = true) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      email: 'stan@the-boundary.com',
      role: isAdmin ? 'admin' : 'user',
      aud: 'authenticated',
      appAccess: { role_slug: isAdmin ? 'admin' : 'user', is_admin: isAdmin },
    };
    next();
  });

  const mod = await import('./templates.js');
  app.use('/api/templates', mod.default);
  return app;
}

describe('templates routes', () => {
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

  it('GET /api/templates returns templates list with shots', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Masterplan', duration_seconds: 60 }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1', template_id: 't1', percentage: 40 }] });

    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body[0].shots).toHaveLength(1);
  });

  it('POST /api/templates creates template', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Masterplan', duration_seconds: 60 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 's1', template_id: 't1', shot_type: 'Aerial', percentage: 40 }],
        });
      return fn({ query });
    });

    const res = await request(app)
      .post('/api/templates')
      .send({
        name: 'Masterplan',
        duration_seconds: 60,
        shots: [{ shot_type: 'Aerial', percentage: 40, efficiency_multiplier: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('t1');
  });

  it('POST /api/templates uses null created_by during dev auth bypass', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';

    const query = vi
      .fn<(...args: unknown[]) => Promise<QueryResult>>()
      .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Masterplan', duration_seconds: 60 }] });

    mockDbTransaction.mockImplementation(async (fn: TxFn) => fn({ query }));

    const res = await request(app).post('/api/templates').send({
      name: 'Masterplan',
      duration_seconds: 60,
    });

    expect(res.status).toBe(201);
    const insertCall = query.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO film_templates'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    expect(params[4]).toBeNull();
  });

  it('POST /api/templates rejects non-admin', async () => {
    const nonAdminApp = await createApp(false);
    const res = await request(nonAdminApp).post('/api/templates').send({
      name: 'Masterplan',
      duration_seconds: 60,
    });
    expect(res.status).toBe(403);
  });
});
