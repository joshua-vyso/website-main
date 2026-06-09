"use client";

import Link from "next/link";
import { LiquidButton }  from "./ui/liquid-button";
import { GradientText }  from "./ui/gradient-text";

// Must match morphToNav.ts constants so the logo crossfade is seamless
export const LOGO_LEFT_PAD = 40;
export const NAV_LOGO_W    = 120;
const NAV_H                = 64;
const ASPECT               = 900 / 350;
const NAV_LOGO_H           = NAV_LOGO_W / ASPECT;

interface NavbarProps {
  visible?: boolean;
}

export function Navbar({ visible = true }: NavbarProps) {
  return (
    <header
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: NAV_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: LOGO_LEFT_PAD,
        paddingRight: LOGO_LEFT_PAD,
        background: "transparent",
        zIndex: 500,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* Logo — exact position matches morphToNav animation endpoint */}
      <Link href="/" aria-label="Vyso home" style={{ lineHeight: 0, flexShrink: 0 }}>
        <svg
          viewBox="175 455 900 350"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: NAV_LOGO_W, height: NAV_LOGO_H, display: "block" }}
        >
          <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z" fill="black"/>
          <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z" fill="black"/>
          <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z" fill="black"/>
          <path d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
            stroke="black" strokeWidth="33" strokeMiterlimit="10" strokeLinejoin="round"/>
          <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z" fill="black"/>
          <path d="M853 536V535.5M853 503V503.5M853 503.5H892.5C878.253 512.228 865.982 519.464 853 535.5M853 503.5V535.5" stroke="black"/>
          <path d="M580 692.5L578.5 660.5L559 692.5H559.512H580Z" fill="black"/>
          <path d="M559.512 692.5H559L578.5 660.5L580 660M578.5 660.5L580 692.5V693M580 692.5H559" stroke="black"/>
          <path d="M938.5 696C991.243 696 1034 652.795 1034 599.5C1034 546.205 991.243 503 938.5 503C885.757 503 843 546.205 843 599.5C843 652.795 885.757 696 938.5 696Z" fill="black"/>
        </svg>
      </Link>

      {/* Single CTA */}
      <LiquidButton asChild variant="default" size="md">
        <Link
          href="/contact"
          style={{
            textDecoration: "none",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            letterSpacing: "0.06em",
          }}
        >
          <GradientText as="span">Request an audit</GradientText>
        </Link>
      </LiquidButton>
    </header>
  );
}

export default Navbar;
