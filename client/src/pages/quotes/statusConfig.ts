import type { QuoteStatus } from '../../../../shared/types';

export type StatusConfig = {
  label: string;
  variant: 'default' | 'secondary' | 'warning' | 'success' | 'info' | 'destructive' | 'outline';
};

export const STATUS_CONFIG: Record<QuoteStatus, StatusConfig> = {
  draft: { label: 'Draft', variant: 'secondary' },
  negotiating: { label: 'Negotiating', variant: 'warning' },
  awaiting_approval: { label: 'Awaiting Approval', variant: 'info' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  archived: { label: 'Archived', variant: 'outline' },
};
