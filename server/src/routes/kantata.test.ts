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

async function createApp() {
  const app = express();
  app.use(express.json());

  const mod = await import('./kantata.js');
  app.use('/api/kantata', mod.default);
  return app;
}

describe('kantata routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createApp();
  });

  it('GET /api/kantata/workspaces validates search length', async () => {
    const res = await request(app).get('/api/kantata/workspaces?search=a');
    expect(res.status).toBe(400);
  });

  it('GET /api/kantata/workspaces returns rows for valid search', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [{ kantata_id: '23046', title: 'Dubai Islands E', status: 'Active' }],
    });

    const res = await request(app).get('/api/kantata/workspaces?search=Dubai');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
