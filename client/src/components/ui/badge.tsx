import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Supabase-style Badge Component
 *
 * Design tokens:
 * - Default: Brand green on dark bg
 * - Status variants: Success, warning, error, info
 * - Outline: Transparent with border
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] leading-4 gap-1 font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-sb-brand focus:ring-offset-2 focus:ring-offset-sb-bg",
  {
    variants: {
      variant: {
        // Default: Brand green badge
        default:
          "border-sb-brand/30 bg-sb-brand-300 text-sb-brand",
        // Secondary: Dark surface
        secondary:
          "border-sb-border bg-sb-surface-200 text-sb-text-light",
        // Outline: Transparent
        outline:
          "border-sb-border-strong bg-transparent text-sb-text-muted",
        // Destructive: Red
        destructive:
          "border-red-800 bg-red-950 text-red-400",
        // Success: Cyan
        success:
          "border-cyan-800 bg-cyan-950 text-cyan-400",
        // Warning: Amber
        warning:
          "border-amber-800 bg-amber-950 text-amber-400",
        // Info: Blue
        info:
          "border-blue-800 bg-blue-950 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
