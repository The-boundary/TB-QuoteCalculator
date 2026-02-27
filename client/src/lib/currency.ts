/**
 * Centralised currency formatting.
 * Currently GBP-only. When multi-currency is needed, add a currencyCode param
 * and read it from the rate card.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
