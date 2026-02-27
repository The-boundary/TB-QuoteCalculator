import { describe, it, expect } from 'vitest';
import type {
  Development,
  FilmTemplateShot,
  KantataWorkspace,
  Project,
  Quote,
  QuoteStatus,
  QuoteStatusLogEntry,
  QuoteVersion,
  RateCard,
  VersionShot,
} from './index';

describe('shared types', () => {
  describe('Development', () => {
    it('has required fields', () => {
      const dev: Development = {
        id: 'uuid',
        name: 'Dubai Islands E',
        client_name: 'Nakheel',
        description: null,
        created_by: 'uuid',
        created_at: '',
        updated_at: '',
      };
      expect(dev.name).toBe('Dubai Islands E');
    });
  });

  describe('Project', () => {
    it('supports forecasted project', () => {
      const p: Project = {
        id: 'uuid',
        development_id: 'uuid',
        name: 'Masterplan Film',
        kantata_id: null,
        status: null,
        is_forecasted: true,
        created_by: 'uuid',
        created_at: '',
        updated_at: '',
      };
      expect(p.is_forecasted).toBe(true);
      expect(p.kantata_id).toBeNull();
    });

    it('supports kantata-linked project', () => {
      const p: Project = {
        id: 'uuid',
        development_id: 'uuid',
        name: 'Masterplan Film',
        kantata_id: '23046',
        status: 'active',
        is_forecasted: false,
        created_by: 'uuid',
        created_at: '',
        updated_at: '',
      };
      expect(p.kantata_id).toBe('23046');
    });
  });

  describe('QuoteStatus', () => {
    it('includes new statuses', () => {
      const statuses: QuoteStatus[] = [
        'draft',
        'negotiating',
        'awaiting_approval',
        'confirmed',
        'archived',
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('Quote', () => {
    it('has project_id and mode', () => {
      const q: Quote = {
        id: 'uuid',
        project_id: 'uuid',
        mode: 'retainer',
        status: 'draft',
        rate_card_id: 'uuid',
        created_by: 'uuid',
        created_at: '',
        updated_at: '',
      };
      expect(q.mode).toBe('retainer');
      expect(q.project_id).toBeDefined();
    });
  });

  describe('QuoteStatusLogEntry', () => {
    it('tracks status changes', () => {
      const entry: QuoteStatusLogEntry = {
        id: 'uuid',
        quote_id: 'uuid',
        old_status: 'draft',
        new_status: 'negotiating',
        changed_by: 'uuid',
        changed_by_email: 'stan@the-boundary.com',
        changed_at: '',
      };
      expect(entry.new_status).toBe('negotiating');
    });
  });

  describe('VersionShot', () => {
    it('has percentage field', () => {
      const shot: VersionShot = {
        id: 'uuid',
        version_id: 'uuid',
        shot_type: 'Aerial',
        percentage: 40,
        quantity: 6,
        base_hours_each: 60,
        efficiency_multiplier: 1,
        adjusted_hours: 360,
        sort_order: 0,
        is_companion: false,
        animation_override: null,
      };
      expect(shot.percentage).toBe(40);
    });
  });

  describe('QuoteVersion', () => {
    it('has shot_count and hourly_rate', () => {
      const v: QuoteVersion = {
        id: 'uuid',
        quote_id: 'uuid',
        version_number: 1,
        duration_seconds: 60,
        shot_count: 15,
        pool_budget_hours: null,
        pool_budget_amount: null,
        total_hours: 120,
        hourly_rate: 125,
        notes: null,
        created_by: 'uuid',
        created_at: '',
      };
      expect(v.shot_count).toBe(15);
      expect(v.pool_budget_hours).toBeNull();
    });
  });

  describe('RateCard', () => {
    it('has hourly_rate', () => {
      const rc: RateCard = {
        id: 'uuid',
        name: 'DHRE 2025',
        is_default: true,
        hours_per_second: 17.33,
        editing_hours_per_30s: 100,
        hourly_rate: 125,
        created_by: 'uuid',
        created_at: '',
        updated_at: '',
      };
      expect(rc.hourly_rate).toBe(125);
    });
  });

  describe('FilmTemplateShot', () => {
    it('uses percentage instead of quantity', () => {
      const shot: FilmTemplateShot = {
        id: 'uuid',
        template_id: 'uuid',
        shot_type: 'Aerial',
        percentage: 40,
        efficiency_multiplier: 1,
        sort_order: 0,
      };
      expect(shot.percentage).toBe(40);
      expect((shot as { quantity?: number }).quantity).toBeUndefined();
    });
  });

  describe('KantataWorkspace', () => {
    it('has kantata fields', () => {
      const ws: KantataWorkspace = {
        kantata_id: '23046',
        title: 'Dubai Islands Phase E',
        status: 'Active',
        start_date: '2026-01-01',
        due_date: '2026-06-30',
      };
      expect(ws.kantata_id).toBe('23046');
    });
  });
});
