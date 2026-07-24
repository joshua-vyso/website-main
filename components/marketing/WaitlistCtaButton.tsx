"use client";

import * as React from "react";
import { useState } from "react";
import { WaitlistModal } from "./WaitlistModal";

/**
 * Thin client-boundary wrapper so server-rendered marketing pages can render a
 * "Join Waitlist" call to action without themselves becoming client components.
 * Drop-in replacement for the `<Link href="/contact">…</Link>` CTAs it
 * supersedes: accepts the same className/style/children/hover-handler props
 * (and forwards a ref, so it composes with `asChild`-style wrappers such as
 * `LiquidButton` and Radix `DropdownMenuItem`), just renders a <button> that
 * opens `WaitlistModal` instead of navigating.
 */
export interface WaitlistCtaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const WaitlistCtaButton = React.forwardRef<HTMLButtonElement, WaitlistCtaButtonProps>(
  ({ children, onClick, type, ...props }, ref) => {
    const [open, setOpen] = useState(false);

    return (
      <>
        <button
          ref={ref}
          type={type ?? "button"}
          {...props}
          onClick={e => {
            onClick?.(e);
            if (!e.defaultPrevented) setOpen(true);
          }}
        >
          {children}
        </button>
        {open && <WaitlistModal onClose={() => setOpen(false)} />}
      </>
    );
  }
);

WaitlistCtaButton.displayName = "WaitlistCtaButton";

export default WaitlistCtaButton;
