export const CATEGORIES = ['scene', 'animation', 'post', 'material'] as const;

export function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1);
}
