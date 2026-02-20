import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  const mod = await import('./rate-cards.js');
  app.use('/api/rate-cards', mod.default);
  return app;
}

describe('rate-cards routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp();
  });

  it('GET /api/rate-cards returns cards', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ id: 'rc1', name: 'DHRE 2025', hours_per_second: 17.33, hourly_rate: 125 }],
    });

    const res = await request(app).get('/api/rate-cards');
    expect(res.status).toBe(200);
    expect(res.body[0].hourly_rate).toBe(125);
  });

  it('POST /api/rate-cards creates card with hourly_rate', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 'rc1', name: 'New Card', hours_per_second: 10, hourly_rate: 150 }],
      });

    const res = await request(app).post('/api/rate-cards').send({
      name: 'New Card',
      hours_per_second: 10,
      hourly_rate: 150,
      is_default: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.hourly_rate).toBe(150);
  });

  it('POST /api/rate-cards rejects non-admin', async () => {
    const nonAdminApp = await createApp(false);
    const res = await request(nonAdminApp).post('/api/rate-cards').send({
      name: 'New Card',
      hours_per_second: 10,
    });
    expect(res.status).toBe(403);
  });

  it('POST /api/rate-cards/:id/items validates category', async () => {
    const res = await request(app).post('/api/rate-cards/rc1/items').send({
      shot_type: 'Test',
      category: 'invalid',
      hours: 1,
    });
    expect(res.status).toBe(400);
  });
});
