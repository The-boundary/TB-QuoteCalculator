import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-sb-border-stronger bg-[rgba(250,250,250,0.027)] px-3 py-2 text-sm text-sb-text placeholder:text-sb-text-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sb-brand focus-visible:ring-offset-2 focus-visible:ring-offset-sb-bg focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Textarea.displayName = "Textarea"

export { Textarea }
