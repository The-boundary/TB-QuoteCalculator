import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Supabase-style Button Component
 *
 * Exact styles from Supabase design system:
 * - Primary: Brand green bg (#006239) with subtle green border
 * - Secondary: Dark surface (#242424) with gray border
 * - Ghost: Transparent with hover bg
 * - Destructive: Red for dangerous actions
 */
const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sb-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sb-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary: Brand cyan button (TB Green style)
        default:
          "bg-sb-brand-500 text-white border border-sb-brand/30 shadow-sm hover:bg-sb-brand-500/80 hover:border-sb-brand hover:glow-brand active:bg-sb-brand-500/70",

        // Destructive: Red for dangerous actions
        destructive:
          "bg-red-600 text-white border border-red-500/30 shadow-sm hover:bg-red-700 hover:border-red-500 active:bg-red-800",

        // Outline: Transparent with border (Supabase secondary style)
        outline:
          "bg-sb-surface-200 text-white border border-sb-border-strong shadow-sm hover:border-sb-border-muted active:bg-sb-surface-300",

        // Secondary: Same as outline for Supabase consistency
        secondary:
          "bg-sb-surface-200 text-white border border-sb-border-strong shadow-sm hover:border-sb-border-muted active:bg-sb-surface-300",

        // Ghost: Transparent with hover state
        ghost:
          "bg-transparent text-sb-text-muted hover:bg-sb-surface-300 hover:text-sb-brand-link active:bg-sb-surface-400",

        // Link: Text link style
        link:
          "text-sb-brand-link underline-offset-4 hover:underline hover:text-sb-brand",

        // Success: Same as primary (brand green)
        success:
          "bg-sb-brand-500 text-white border border-sb-brand/30 shadow-sm hover:bg-sb-brand-500/80 hover:border-sb-brand active:bg-sb-brand-500/70",
      },
      size: {
        // Default: 38px height (Supabase standard)
        default: "h-[38px] px-4 py-2",
        // Small: 26px height
        sm: "h-[26px] rounded-md px-3 text-xs",
        // Large: 42px height
        lg: "h-[42px] rounded-md px-6",
        // Icon: Square button
        icon: "h-[38px] w-[38px]",
        // Icon small
        "icon-sm": "h-[26px] w-[26px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
