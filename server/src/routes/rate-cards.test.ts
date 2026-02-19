import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockDbQuery = vi.fn();

vi.mock('../services/supabase.js', () => ({
  dbQuery: (...args: any[]) => mockDbQuery(...args),
  dbTransaction: vi.fn(),
  getAuthSupabaseClient: () => null,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function createApp(isAdmin = true) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@the-boundary.com',
      role: isAdmin ? 'admin' : 'user',
      aud: 'authenticated',
      appAccess: { role_slug: isAdmin ? 'admin' : 'user', is_admin: isAdmin },
    };
    next();
  });
  return import('./rate-cards.js').then((mod) => {
    app.use('/api/rate-cards', mod.default);
    return app;
  });
}

describe('rate-cards routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp();
  });

  describe('GET /api/rate-cards', () => {
    it('returns list of rate cards', async () => {
      const cards = [{ id: 'rc1', name: 'DHRE 2025', hours_per_second: 17.33, is_default: true }];
      mockDbQuery.mockResolvedValueOnce({ rows: cards });

      const res = await request(app).get('/api/rate-cards');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('DHRE 2025');
    });
  });

  describe('POST /api/rate-cards', () => {
    it('creates rate card as admin', async () => {
      const created = { id: 'rc1', name: 'New Card', hours_per_second: 10, is_default: false };
      mockDbQuery.mockResolvedValueOnce({ rows: [created] });

      const res = await request(app)
        .post('/api/rate-cards')
        .send({ name: 'New Card', hours_per_second: 10 });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Card');
    });

    it('rejects non-admin', async () => {
      const nonAdminApp = await createApp(false);
      const res = await request(nonAdminApp)
        .post('/api/rate-cards')
        .send({ name: 'New Card', hours_per_second: 10 });
      expect(res.status).toBe(403);
    });

    it('rejects invalid payload', async () => {
      const res = await request(app)
        .post('/api/rate-cards')
        .send({ name: '', hours_per_second: -1 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/rate-cards/:id/items', () => {
    it('adds item as admin', async () => {
      const item = { id: 'i1', shot_type: 'Wide Shot', category: 'scene', hours: 12 };
      mockDbQuery.mockResolvedValueOnce({ rows: [item] });

      const res = await request(app)
        .post('/api/rate-cards/rc1/items')
        .send({ shot_type: 'Wide Shot', category: 'scene', hours: 12 });
      expect(res.status).toBe(201);
      expect(res.body.shot_type).toBe('Wide Shot');
    });

    it('rejects invalid category', async () => {
      const res = await request(app)
        .post('/api/rate-cards/rc1/items')
        .send({ shot_type: 'Test', category: 'invalid', hours: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/rate-cards/:id/items/:itemId', () => {
    it('deletes item as admin', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app).delete('/api/rate-cards/rc1/items/i1');
      expect(res.status).toBe(204);
    });
  });
});
