// ── Rate Cards ──────────────────────────────────────────────

export interface RateCard {
  id: string;
  name: string;
  is_default: boolean;
  hours_per_second: number;
  editing_hours_per_30s: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RateCardItem {
  id: string;
  rate_card_id: string;
  shot_type: string;
  category: 'scene' | 'animation' | 'post' | 'material';
  hours: number;
  sort_order: number;
}

export interface RateCardWithItems extends RateCard {
  items: RateCardItem[];
}

// ── Quotes ──────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'archived';

export interface Quote {
  id: string;
  client_name: string;
  project_name: string;
  status: QuoteStatus;
  rate_card_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteVersion {
  id: string;
  quote_id: string;
  version_number: number;
  duration_seconds: number;
  pool_budget_hours: number;
  total_hours: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface VersionShot {
  id: string;
  version_id: string;
  shot_type: string;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
}

export interface QuoteVersionWithShots extends QuoteVersion {
  shots: VersionShot[];
}

export interface QuoteWithVersions extends Quote {
  versions: QuoteVersionWithShots[];
  rate_card?: RateCard;
}

// ── Film Templates ─────────────────────────────────────────

export interface FilmTemplate {
  id: string;
  name: string;
  duration_seconds: number;
  description: string | null;
  rate_card_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilmTemplateShot {
  id: string;
  template_id: string;
  shot_type: string;
  quantity: number;
  efficiency_multiplier: number;
  sort_order: number;
}

export interface FilmTemplateWithShots extends FilmTemplate {
  shots: FilmTemplateShot[];
}

// ── API Payloads ────────────────────────────────────────────

export interface CreateQuotePayload {
  client_name: string;
  project_name: string;
  rate_card_id: string;
}

export interface CreateVersionPayload {
  duration_seconds: number;
  notes?: string;
  shots: Array<{
    shot_type: string;
    quantity: number;
    base_hours_each: number;
    efficiency_multiplier: number;
    sort_order: number;
  }>;
}

export interface UpdateVersionShotsPayload {
  shots: Array<{
    shot_type: string;
    quantity: number;
    base_hours_each: number;
    efficiency_multiplier: number;
    sort_order: number;
  }>;
  duration_seconds: number;
}

// ── Auth ────────────────────────────────────────────────────

export interface AppAccess {
  app_slug: string;
  role_name: string;
  role_slug: string;
  is_admin: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  appAccess: AppAccess | null;
}
