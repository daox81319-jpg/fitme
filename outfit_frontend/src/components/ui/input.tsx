import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[16px] border border-white/75 bg-white/68 px-4 py-2 text-base text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus-visible:border-[color:var(--accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/18 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
