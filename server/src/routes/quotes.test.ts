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

  const mod = await import('./quotes.js');
  app.use('/api/quotes', mod.default);
  return app;
}

describe('quotes routes', () => {
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

  it('GET /api/quotes returns list', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'draft' }] });
    const res = await request(app).get('/api/quotes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /api/quotes validates v2 payload', async () => {
    const res = await request(app).post('/api/quotes').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/quotes creates quote with project_id + mode', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [{ id: 'project-1' }] })
        .mockResolvedValueOnce({
          rows: [{ hours_per_second: 17.33, editing_hours_per_30s: 100, hourly_rate: 125 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'quote-1', project_id: 'project-1', mode: 'retainer', status: 'draft' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'log-1', new_status: 'draft' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'version-1', version_number: 1, duration_seconds: 60, shot_count: 15 }],
        });

      return fn({ query });
    });

    const res = await request(app).post('/api/quotes').send({
      project_id: '550e8400-e29b-41d4-a716-446655440001',
      mode: 'retainer',
      rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(res.status).toBe(201);
    expect(res.body.project_id).toBe('project-1');
    expect(res.body.mode).toBe('retainer');
  });

  it('POST /api/quotes uses null created_by during dev auth bypass', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';

    const query = vi
      .fn<(...args: unknown[]) => Promise<QueryResult>>()
      .mockResolvedValueOnce({ rows: [{ id: 'project-1' }] })
      .mockResolvedValueOnce({
        rows: [{ hours_per_second: 17.33, editing_hours_per_30s: 100, hourly_rate: 125 }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'quote-1', project_id: 'project-1', mode: 'retainer', status: 'draft' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'log-1', new_status: 'draft' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'version-1', version_number: 1, duration_seconds: 60, shot_count: 15 }],
      });

    mockDbTransaction.mockImplementation(async (fn: TxFn) => fn({ query }));

    const res = await request(app).post('/api/quotes').send({
      project_id: '550e8400-e29b-41d4-a716-446655440001',
      mode: 'retainer',
      rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(res.status).toBe(201);
    const insertQuoteCall = query.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO quotes'),
    );
    expect(insertQuoteCall).toBeDefined();
    const params = insertQuoteCall?.[1] as unknown[];
    expect(params[3]).toBeNull();
  });

  it('PUT /api/quotes/:id/status rejects invalid transition', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'draft' }] });
      return fn({ query });
    });

    const res = await request(app).put('/api/quotes/q1/status').send({ status: 'confirmed' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/quotes/:id/status allows valid transition and logs', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'negotiating' }] })
        .mockResolvedValueOnce({ rows: [] });
      return fn({ query });
    });

    const res = await request(app).put('/api/quotes/q1/status').send({ status: 'negotiating' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('negotiating');
  });

  it('GET /api/quotes/:id returns status_log', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'q1',
            rate_card_id: 'rc1',
            project_id: 'p1',
            project_name: 'Project',
            development_id: 'd1',
            development_name: 'Dev',
            development_client_name: 'Client',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'rc1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'log-1', new_status: 'draft' }] });

    const res = await request(app).get('/api/quotes/q1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.status_log)).toBe(true);
  });

  it('DELETE /api/quotes/:id archives quote and logs status change', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'draft' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'q1', status: 'archived' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'log-1' }] });
      return fn({ query });
    });

    const res = await request(app).delete('/api/quotes/q1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });

  it('DELETE /api/quotes/:id returns 404 for unknown quote', async () => {
    mockDbTransaction.mockImplementation(async (fn: TxFn) => {
      const query = vi
        .fn<(...args: unknown[]) => Promise<QueryResult>>()
        .mockResolvedValueOnce({ rows: [] });
      return fn({ query });
    });

    const res = await request(app).delete('/api/quotes/missing');

    expect(res.status).toBe(404);
  });
});
