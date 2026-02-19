import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Supabase-style Input Component
 *
 * Design tokens:
 * - Background: rgba(250, 250, 250, 0.027) - nearly transparent
 * - Border: border-stronger (#393939)
 * - Height: 34px (default), 26px (small)
 * - Border radius: 6px
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Supabase input styling
          'flex h-[34px] w-full rounded-md px-3 py-2 text-sm transition-all duration-200',
          // Colors
          'bg-[rgba(250,250,250,0.027)] border border-sb-border-stronger text-sb-text',
          // Placeholder
          'placeholder:text-sb-text-muted',
          // Focus state
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sb-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sb-bg focus-visible:border-transparent',
          // File input
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-sb-text',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
