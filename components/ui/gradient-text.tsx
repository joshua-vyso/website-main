"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}

function GradientText({
  className,
  children,
  as: Component = "span",
  ...props
}: GradientTextProps) {
  return (
    <Component
      className={cn(
        "bg-clip-text text-transparent",
        "bg-[linear-gradient(135deg,hsl(var(--color-2)),hsl(var(--color-1)),hsl(var(--color-3)))]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export { GradientText };
