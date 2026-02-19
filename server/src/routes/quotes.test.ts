import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dbQuery / dbTransaction before importing routes
const mockDbQuery = vi.fn();
const mockDbTransaction = vi.fn();

vi.mock('../services/supabase.js', () => ({
  dbQuery: (...args: any[]) => mockDbQuery(...args),
  dbTransaction: (...args: any[]) => mockDbTransaction(...args),
  getAuthSupabaseClient: () => null,
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Build a minimal app with auth stubbed
async function createApp() {
  const app = express();
  app.use(express.json());

  // Stub auth middleware — inject a default user
  app.use((req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@the-boundary.com',
      role: 'admin',
      aud: 'authenticated',
      appAccess: { role_slug: 'admin', is_admin: true },
    };
    next();
  });

  const mod = await import('./quotes.js');
  app.use('/api/quotes', mod.default);
  return app;
}

describe('quotes routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp();
  });

  describe('GET /api/quotes', () => {
    it('returns empty array when no quotes', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/quotes');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns enriched quotes with version info', async () => {
      const quotes = [{ id: 'q1', client_name: 'Acme', project_name: 'Launch', status: 'draft' }];
      const versions = [
        {
          id: 'v1',
          quote_id: 'q1',
          version_number: 1,
          duration_seconds: 60,
          pool_budget_hours: 1040,
          total_hours: 100,
        },
      ];

      // First call: quotes query
      mockDbQuery.mockResolvedValueOnce({ rows: quotes });
      // Second call: versions query
      mockDbQuery.mockResolvedValueOnce({ rows: versions });

      const res = await request(app).get('/api/quotes');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].latest_version).toBeDefined();
      expect(res.body[0].version_count).toBe(1);
    });
  });

  describe('POST /api/quotes', () => {
    it('rejects invalid payload', async () => {
      const res = await request(app).post('/api/quotes').send({ client_name: '' });
      expect(res.status).toBe(400);
    });

    it('creates quote with valid payload', async () => {
      const rateCard = { hours_per_second: 17.33, editing_hours_per_30s: 100 };
      const createdQuote = {
        id: 'q1',
        client_name: 'Acme',
        project_name: 'X',
        status: 'draft',
        rate_card_id: 'rc1',
      };
      const createdVersion = { id: 'v1', quote_id: 'q1', version_number: 1, duration_seconds: 60 };

      mockDbTransaction.mockImplementation(async (fn: any) => {
        const mockClient = {
          query: vi.fn()
            // 1st call: SELECT rate card
            .mockResolvedValueOnce({ rows: [rateCard] })
            // 2nd call: INSERT quote
            .mockResolvedValueOnce({ rows: [createdQuote] })
            // 3rd call: INSERT version
            .mockResolvedValueOnce({ rows: [createdVersion] }),
        };
        return fn(mockClient);
      });

      const res = await request(app).post('/api/quotes').send({
        client_name: 'Acme',
        project_name: 'X',
        rate_card_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe('q1');
      expect(res.body.versions).toHaveLength(1);
    });
  });

  describe('PUT /api/quotes/:id/status', () => {
    it('rejects invalid status value', async () => {
      const res = await request(app).put('/api/quotes/q1/status').send({ status: 'bogus' });
      expect(res.status).toBe(400);
    });

    it('allows admin to approve', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'q1', status: 'approved' }],
      });

      const res = await request(app).put('/api/quotes/q1/status').send({ status: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });

    it('rejects non-admin approval', async () => {
      // Override the auth middleware for this test
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, _res, next) => {
        req.user = {
          id: 'user-id',
          email: 'user@the-boundary.com',
          role: 'user',
          aud: 'authenticated',
          appAccess: { role_slug: 'user', is_admin: false },
        };
        next();
      });
      const mod = await import('./quotes.js');
      nonAdminApp.use('/api/quotes', mod.default);

      const res = await request(nonAdminApp)
        .put('/api/quotes/q1/status')
        .send({ status: 'approved' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/quotes/:id', () => {
    it('soft-deletes by setting status to archived', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'q1', status: 'archived' }],
      });

      const res = await request(app).delete('/api/quotes/q1');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('archived');
    });
  });
});
