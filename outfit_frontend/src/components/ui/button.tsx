import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "btn-primary-glow hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(0,135,235,0.30)] active:translate-y-0",
        destructive:
          "bg-[color:var(--danger)] text-white shadow-[0_12px_28px_rgba(194,65,12,0.18)] hover:bg-[color:var(--danger)]/90",
        outline:
          "btn-secondary-glass hover:-translate-y-0.5 hover:border-[color:var(--accent)]/35 hover:text-[color:var(--accent)]",
        secondary:
          "btn-secondary-glass hover:-translate-y-0.5 hover:border-[color:var(--accent)]/25",
        ghost: "text-[color:var(--text-2)] hover:bg-white/58 hover:text-[color:var(--text)]",
        link: "text-[color:var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-full px-3 text-xs",
        lg: "h-12 rounded-full px-8",
        icon: "h-9 w-9",
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
