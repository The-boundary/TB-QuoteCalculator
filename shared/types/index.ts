// Developments
export interface Development {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Projects
export interface Project {
  id: string;
  development_id: string;
  name: string;
  kantata_id: string | null;
  status: string | null;
  is_forecasted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Kantata (read-only)
export interface KantataWorkspace {
  kantata_id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
}

// Rate Cards
export interface RateCard {
  id: string;
  name: string;
  is_default: boolean;
  hours_per_second: number;
  editing_hours_per_30s: number;
  hourly_rate: number;
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

// Quotes
export type QuoteMode = 'retainer' | 'budget';

export type QuoteStatus = 'draft' | 'negotiating' | 'awaiting_approval' | 'confirmed' | 'archived';

export interface Quote {
  id: string;
  project_id: string;
  mode: QuoteMode;
  status: QuoteStatus;
  rate_card_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteStatusLogEntry {
  id: string;
  quote_id: string;
  old_status: QuoteStatus | null;
  new_status: QuoteStatus;
  changed_by: string;
  changed_by_email: string | null;
  changed_at: string;
}

export interface QuoteVersion {
  id: string;
  quote_id: string;
  version_number: number;
  duration_seconds: number;
  shot_count: number;
  pool_budget_hours: number | null;
  pool_budget_amount: number | null;
  total_hours: number;
  hourly_rate: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface VersionModule {
  id: string;
  version_id: string;
  name: string;
  module_type: 'film' | 'supplementary';
  duration_seconds: number | null;
  shot_count: number | null;
  animation_complexity: 'regular' | 'complex';
  sort_order: number;
}

export interface VersionShot {
  id: string;
  version_id: string;
  shot_type: string;
  percentage: number;
  quantity: number;
  base_hours_each: number;
  efficiency_multiplier: number;
  adjusted_hours: number;
  sort_order: number;
  module_id?: string;
  is_companion: boolean;
  animation_override: 'regular' | 'complex' | null;
}

export const ANIMATION_COMPANION_TYPE = '__animation_companion';

export type LineItemCategory = 'service' | 'deliverable' | 'pre_production';

export interface VersionLineItem {
  id: string;
  version_id: string;
  name: string;
  category: LineItemCategory;
  hours_each: number;
  quantity: number;
  total_hours: number;
  notes: string | null;
  sort_order: number;
}

export interface QuoteVersionWithShots extends QuoteVersion {
  shots: VersionShot[];
  modules?: VersionModule[];
  line_items?: VersionLineItem[];
}

export interface QuoteWithVersions extends Quote {
  versions: QuoteVersionWithShots[];
  rate_card?: RateCard;
  project?: Project;
  status_log?: QuoteStatusLogEntry[];
}

// Film Templates
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
  percentage: number;
  efficiency_multiplier: number;
  sort_order: number;
}

export interface FilmTemplateWithShots extends FilmTemplate {
  shots: FilmTemplateShot[];
}
