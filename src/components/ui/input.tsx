import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground shadow-none transition-all outline-none",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
