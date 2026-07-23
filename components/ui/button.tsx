import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const styles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-bold transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
        secondary:
          "border border-border-strong bg-surface-2 text-text-primary hover:bg-surface-3",
        ghost: "bg-transparent text-text-primary hover:bg-surface-3",
        danger: "bg-danger text-black hover:brightness-110",
        link: "min-h-0 px-0 underline hover:text-brand-hover",
      },
      size: {
        sm: "min-h-9 px-3",
        md: "min-h-11 px-4",
        lg: "min-h-12 px-5 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof styles> {
  loading?: boolean;
}
export function Button({
  className,
  variant,
  size,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(styles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
export { styles as buttonStyles };
