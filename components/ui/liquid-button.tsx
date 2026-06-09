"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const liquidButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center cursor-pointer gap-2",
    "whitespace-nowrap rounded-full font-medium",
    "transition-transform duration-200",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    "hover:scale-[1.03] active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "text-primary",
        dark:    "text-[#0d0d0d]",
        white:   "text-white",
        blue:    "text-[#3375AE]",
      },
      size: {
        sm:  "h-8  px-4  text-xs  gap-1.5",
        md:  "h-9  px-5  text-sm",
        lg:  "h-11 px-7  text-sm",
        xl:  "h-13 px-9  text-base",
        xxl: "h-14 px-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "lg",
    },
  }
);

// Lightweight, background-reactive glass rim
const GLASS_SHADOW = [
  "0 0 0 1px rgba(255,255,255,0.28)",      // subtle white outline
  "0 4px 20px rgba(0,0,0,0.07)",           // soft drop shadow
  "inset 0 1.5px 0 rgba(255,255,255,0.70)", // top gleam
  "inset 0 -1px 0 rgba(0,0,0,0.06)",       // bottom micro-shade
].join(",");

function GlassInner() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 rounded-full overflow-hidden pointer-events-none"
      style={{
        backdropFilter:         "blur(20px) saturate(1.8)",
        WebkitBackdropFilter:   "blur(20px) saturate(1.8)",
        background:             "rgba(255,255,255,0.12)",
        boxShadow:              GLASS_SHADOW,
      }}
    />
  );
}

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidButtonVariants> {
  asChild?: boolean;
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant, size, asChild = false, children, style, ...props }, ref) => {

    // asChild: clone the child element, merging LiquidButton's classes + glass overlay
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return React.cloneElement(child, {
        ...child.props,
        className: cn(
          liquidButtonVariants({ variant, size }),
          child.props.className,
          className,
        ),
        style: { ...style, ...child.props.style },
        children: (
          <>
            <GlassInner />
            <span className="relative z-10 flex items-center gap-[0.5em]">
              {child.props.children}
            </span>
          </>
        ),
      });
    }

    return (
      <button
        ref={ref}
        className={cn(liquidButtonVariants({ variant, size }), className)}
        style={style}
        {...props}
      >
        <GlassInner />
        <span className="relative z-10 flex items-center gap-[0.5em]">
          {children}
        </span>
      </button>
    );
  }
);

LiquidButton.displayName = "LiquidButton";

/** No-op kept for API compatibility — glass now uses native backdrop-filter. */
export function LiquidGlassFilter() { return null; }

export { liquidButtonVariants };
