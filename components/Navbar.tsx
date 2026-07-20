"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Menu,
  Rocket,
  Sparkles,
  Sprout,
  Truck,
  UtensilsCrossed,
  Workflow,
} from "lucide-react";
import { LiquidButton }  from "./ui/liquid-button";
import { GradientText }  from "./ui/gradient-text";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { NavLoginLink } from "./platform/MarketingAuth";

export const LOGO_LEFT_PAD = 40;
export const NAV_LOGO_W    = 120;
const NAV_H                = 64;
const ASPECT               = 900 / 350;
const NAV_LOGO_H           = NAV_LOGO_W / ASPECT;

const NAV_ITEMS = [
  { label: "Home",    href: "/"        },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ",     href: "/faq"     },
];

const PLATFORM_LINKS = [
  {
    label:       "Platform overview",
    description: "One connected operating layer, configured around your business.",
    href:        "/platform",
    Icon:        LayoutGrid,
  },
  {
    label:       "OrderFlow",
    description: "Move from incoming order to fulfilment and invoicing in one flow.",
    href:        "/platform#orderflow",
    Icon:        Workflow,
  },
  {
    label:       "Vyso AI",
    description: "Find answers and take action across your operational data.",
    href:        "/platform/vyso-ai",
    Icon:        Sparkles,
  },
];

const AUDIENCE_LINKS = [
  {
    label:       "Become a founding client",
    description: "Help shape Vyso with close, hands-on support.",
    href:        "/founding-client",
    Icon:        Rocket,
  },
  {
    label:       "Vyso for SMEs",
    description: "Practical systems for growing South African teams.",
    href:        "/platform/vyso-for-smes",
    Icon:        Building2,
  },
];

const INDUSTRY_LINKS = [
  { label: "Restaurants",    href: "/industries/restaurants",    Icon: UtensilsCrossed },
  { label: "Food suppliers", href: "/industries/food-suppliers", Icon: Truck            },
  { label: "Farms",          href: "/industries/farms",          Icon: Sprout           },
];

const LINK_STYLE: React.CSSProperties = {
  fontFamily:     "var(--font-body, var(--font-sans))",
  fontSize:       "0.88rem",
  fontWeight:     500,
  color:          "#0d0d0d",
  textDecoration: "none",
  letterSpacing:  "0.01em",
  transition:     "color 0.15s",
  whiteSpace:     "nowrap",
};

const MENU_LABEL_STYLE: React.CSSProperties = {
  fontFamily:     "var(--font-body, var(--font-sans))",
  fontSize:       "0.66rem",
  fontWeight:     700,
  color:          "#8a8a8a",
  letterSpacing:  "0.16em",
  textTransform:  "uppercase",
};

const MOBILE_LINK_STYLE: React.CSSProperties = {
  fontFamily:     "var(--font-body, var(--font-sans))",
  fontSize:       "0.9rem",
  fontWeight:     500,
  color:          "#0d0d0d",
  textDecoration: "none",
  display:        "flex",
  alignItems:     "center",
  gap:            "0.65rem",
  minHeight:      44,
  padding:        "0.55rem 0.75rem",
  borderRadius:   10,
  width:          "100%",
};

interface NavbarProps { visible?: boolean }

export function Navbar({ visible = true }: NavbarProps) {
  const [scrolledDown, setScrolledDown] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 80) {
        setScrolledDown(false);
      } else if (y > lastY.current + 4) {
        setScrolledDown(true);
        setPlatformOpen(false);
      } else if (y < lastY.current - 4) {
        setScrolledDown(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navShown = !scrolledDown;

  return (
    <header
      style={{
        position:       "fixed",
        top:            0,
        left:           0,
        right:          0,
        height:         NAV_H,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        paddingLeft:    "clamp(16px, 4vw, 40px)",
        paddingRight:   "clamp(16px, 4vw, 40px)",
        background:     "transparent",
        zIndex:         500,
        opacity:        visible ? 1 : 0,
        pointerEvents:  visible ? "auto" : "none",
        transition:     "opacity 0.25s ease",
      }}
    >
      {/* Logo */}
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

      {/* ── Desktop: centre nav ─────────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="hidden md:flex"
        style={{
          position:      "absolute",
          left:          "50%",
          gap:           "clamp(1.15rem, 2.2vw, 2.2rem)",
          transform:     navShown
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(-6px)",
          opacity:       navShown ? 1 : 0,
          pointerEvents: navShown ? "auto" : "none",
          transition:    "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <Link
          href={NAV_ITEMS[0].href}
          style={LINK_STYLE}
          onMouseEnter={e => (e.currentTarget.style.color = "hsl(22,69%,44%)")}
          onMouseLeave={e => (e.currentTarget.style.color = "#0d0d0d")}
        >
          {NAV_ITEMS[0].label}
        </Link>

        <DropdownMenu open={platformOpen} onOpenChange={setPlatformOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-4"
              style={{
                ...LINK_STYLE,
                display:     "inline-flex",
                alignItems:  "center",
                gap:         4,
                padding:     0,
                border:      0,
                background:  "transparent",
                cursor:      "pointer",
                color:       platformOpen ? "hsl(22,69%,44%)" : "#0d0d0d",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "hsl(22,69%,44%)")}
              onMouseLeave={e => {
                if (!platformOpen) e.currentTarget.style.color = "#0d0d0d";
              }}
            >
              Platform
              <ChevronDown
                size={13}
                strokeWidth={1.8}
                aria-hidden="true"
                style={{
                  transform:  platformOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="center"
            sideOffset={16}
            collisionPadding={16}
            aria-label="Platform navigation"
            className="z-[600] overflow-x-hidden overflow-y-auto p-0"
            style={{
              width:                "min(760px, calc(100vw - 32px))",
              maxHeight:            "calc(100vh - 88px)",
              overflowX:            "hidden",
              overflowY:            "auto",
              zIndex:               600,
              background:           "rgba(255,255,255,0.76)",
              backdropFilter:       "blur(30px) saturate(1.9)",
              WebkitBackdropFilter: "blur(30px) saturate(1.9)",
              border:               "1px solid rgba(255,255,255,0.76)",
              borderRadius:         22,
              padding:              0,
              boxShadow: [
                "inset 0 1.5px 0 rgba(255,255,255,0.92)",
                "inset 0 -1px 0 rgba(0,0,0,0.04)",
                "0 0 0 0.5px rgba(255,255,255,0.34)",
                "0 22px 64px rgba(0,0,0,0.14)",
              ].join(", "),
            }}
          >
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "minmax(0, 1.65fr) minmax(220px, 0.85fr)",
              }}
            >
              <div style={{ padding: "1.25rem" }}>
                <p style={{ ...MENU_LABEL_STYLE, margin: "0 0 0.65rem 0.3rem" }}>
                  Platform
                </p>

                <div style={{ display: "grid", gap: "0.3rem" }}>
                  {PLATFORM_LINKS.map(({ label, description, href, Icon }) => (
                    <DropdownMenuItem key={href} asChild className="cursor-pointer p-0 focus:bg-transparent">
                      <Link
                        href={href}
                        className="group/mega hover:bg-white/50 focus:bg-white/60"
                        style={{
                          display:             "grid",
                          gridTemplateColumns: "38px minmax(0,1fr) 16px",
                          alignItems:           "center",
                          gap:                  "0.8rem",
                          padding:              "0.72rem",
                          borderRadius:         14,
                          color:                "#0d0d0d",
                          textDecoration:       "none",
                          transition:           "background 0.16s ease",
                        }}
                      >
                        <span style={{
                          width:          38,
                          height:         38,
                          display:        "flex",
                          alignItems:     "center",
                          justifyContent: "center",
                          borderRadius:   11,
                          color:          "hsl(22,69%,42%)",
                          background:     "hsl(22 69% 44% / 0.10)",
                          border:         "1px solid hsl(22 69% 44% / 0.12)",
                        }}>
                          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{
                            display:       "block",
                            fontFamily:    "var(--font-body, var(--font-sans))",
                            fontSize:      "0.88rem",
                            fontWeight:    650,
                            letterSpacing: "-0.01em",
                          }}>
                            {label}
                          </span>
                          <span style={{
                            display:    "block",
                            marginTop:  2,
                            fontFamily: "var(--font-body, var(--font-sans))",
                            fontSize:   "0.73rem",
                            lineHeight:  1.4,
                            color:      "#727272",
                          }}>
                            {description}
                          </span>
                        </span>
                        <ChevronRight
                          size={14}
                          strokeWidth={1.8}
                          aria-hidden="true"
                          style={{ color: "#aaa" }}
                        />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "0.85rem 0 1rem" }} />

                <p style={{ ...MENU_LABEL_STYLE, margin: "0 0 0.65rem 0.3rem" }}>
                  Work with Vyso
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                  {AUDIENCE_LINKS.map(({ label, description, href, Icon }) => (
                    <DropdownMenuItem key={href} asChild className="cursor-pointer p-0 focus:bg-transparent">
                      <Link
                        href={href}
                        className="hover:bg-white/60 focus:bg-white/70"
                        style={{
                          display:       "block",
                          minHeight:     104,
                          padding:       "0.85rem",
                          borderRadius:  14,
                          border:        "1px solid rgba(255,255,255,0.72)",
                          background:    "rgba(255,255,255,0.34)",
                          color:         "#0d0d0d",
                          textDecoration:"none",
                          boxShadow:     "inset 0 1px 0 rgba(255,255,255,0.72)",
                          transition:    "background 0.16s ease",
                        }}
                      >
                        <Icon size={17} strokeWidth={1.8} color="hsl(22,69%,42%)" aria-hidden="true" />
                        <span style={{
                          display:    "block",
                          marginTop:  "0.55rem",
                          fontFamily: "var(--font-body, var(--font-sans))",
                          fontSize:   "0.82rem",
                          fontWeight: 650,
                        }}>
                          {label}
                        </span>
                        <span style={{
                          display:    "block",
                          marginTop:  3,
                          fontFamily: "var(--font-body, var(--font-sans))",
                          fontSize:   "0.69rem",
                          lineHeight: 1.35,
                          color:      "#777",
                        }}>
                          {description}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>

              <div style={{
                padding:    "1.25rem",
                background: "rgba(255,255,255,0.30)",
                borderLeft: "1px solid rgba(255,255,255,0.72)",
              }}>
                <p style={{ ...MENU_LABEL_STYLE, margin: "0 0 0.65rem 0.3rem" }}>
                  Industries
                </p>
                <div style={{ display: "grid", gap: "0.3rem" }}>
                  {INDUSTRY_LINKS.map(({ label, href, Icon }) => (
                    <DropdownMenuItem key={href} asChild className="cursor-pointer p-0 focus:bg-transparent">
                      <Link
                        href={href}
                        className="hover:bg-white/50 focus:bg-white/60"
                        style={{
                          display:       "flex",
                          alignItems:    "center",
                          gap:           "0.7rem",
                          minHeight:     46,
                          padding:       "0.65rem 0.7rem",
                          borderRadius:  12,
                          color:         "#0d0d0d",
                          textDecoration:"none",
                          fontFamily:    "var(--font-body, var(--font-sans))",
                          fontSize:      "0.84rem",
                          fontWeight:    600,
                          transition:    "background 0.16s ease",
                        }}
                      >
                        <Icon size={16} strokeWidth={1.8} color="hsl(22,69%,42%)" aria-hidden="true" />
                        <span style={{ flex: 1 }}>{label}</span>
                        <ChevronRight size={13} strokeWidth={1.8} color="#aaa" aria-hidden="true" />
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "1rem 0" }} />

                <p style={{ ...MENU_LABEL_STYLE, margin: "0 0 0.65rem 0.3rem" }}>
                  Explore
                </p>
                {[
                  { label: "Pricing", href: "/pricing" },
                  { label: "Frequently asked questions", href: "/faq" },
                  { label: "Talk to Vyso", href: "/contact" },
                ].map(({ label, href }) => (
                  <DropdownMenuItem key={href} asChild className="cursor-pointer p-0 focus:bg-transparent">
                    <Link
                      href={href}
                      className="hover:bg-white/50 focus:bg-white/60"
                      style={{
                        display:       "flex",
                        alignItems:    "center",
                        justifyContent:"space-between",
                        minHeight:     40,
                        padding:       "0.5rem 0.7rem",
                        borderRadius:  10,
                        color:         "#555",
                        textDecoration:"none",
                        fontFamily:    "var(--font-body, var(--font-sans))",
                        fontSize:      "0.8rem",
                        fontWeight:    550,
                      }}
                    >
                      {label}
                      <ChevronRight size={12} strokeWidth={1.8} color="#aaa" aria-hidden="true" />
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {NAV_ITEMS.slice(1).map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            style={LINK_STYLE}
            onMouseEnter={e => (e.currentTarget.style.color = "hsl(22,69%,44%)")}
            onMouseLeave={e => (e.currentTarget.style.color = "#0d0d0d")}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* ── Desktop: Log in + CTA button ────────────────────────────────────── */}
      <div className="hidden md:flex md:items-center md:gap-6">
        <NavLoginLink />
        <LiquidButton asChild variant="default" size="md">
          <Link
            href="/contact"
            style={{
              textDecoration: "none",
              fontFamily:     "var(--font-sans)",
              fontWeight:     500,
              letterSpacing:  "0.06em",
              flexShrink:     0,
            }}
          >
            <GradientText as="span">Contact us</GradientText>
          </Link>
        </LiquidButton>
      </div>

      {/* ── Mobile: hamburger dropdown ──────────────────────────────────────── */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Open menu"
              style={{
                display:              "flex",
                alignItems:           "center",
                justifyContent:       "center",
                width:                42,
                height:               42,
                borderRadius:         12,
                border:               "1px solid rgba(255,255,255,0.68)",
                background:           "rgba(255,255,255,0.52)",
                backdropFilter:       "blur(22px) saturate(1.9)",
                WebkitBackdropFilter: "blur(22px) saturate(1.9)",
                boxShadow:            [
                  "inset 0 1.5px 0 rgba(255,255,255,0.88)",
                  "inset 0 -1px 0 rgba(0,0,0,0.04)",
                  "0 0 0 0.5px rgba(255,255,255,0.30)",
                  "0 4px 16px rgba(0,0,0,0.08)",
                ].join(", "),
                cursor:               "pointer",
                color:                "#0d0d0d",
              }}
            >
              <Menu size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className="z-[600] overflow-y-auto"
            style={{
              width:                "min(340px, calc(100vw - 24px))",
              maxHeight:            "calc(100vh - 88px)",
              overflowY:            "auto",
              zIndex:               600,
              background:           "rgba(255,255,255,0.72)",
              backdropFilter:       "blur(28px) saturate(1.9)",
              WebkitBackdropFilter: "blur(28px) saturate(1.9)",
              border:               "1px solid rgba(255,255,255,0.68)",
              borderRadius:         16,
              padding:              "0.4rem",
              boxShadow:            [
                "inset 0 1.5px 0 rgba(255,255,255,0.88)",
                "0 0 0 0.5px rgba(255,255,255,0.30)",
                "0 16px 48px rgba(0,0,0,0.12)",
              ].join(", "),
            }}
          >
            <DropdownMenuItem asChild className="cursor-pointer p-0">
              <Link href="/" style={MOBILE_LINK_STYLE}>Home</Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel style={{ ...MENU_LABEL_STYLE, padding: "0.65rem 0.75rem 0.35rem" }}>
              Platform
            </DropdownMenuLabel>
            {PLATFORM_LINKS.map(({ label, href, Icon }) => (
              <DropdownMenuItem key={href} asChild className="cursor-pointer p-0">
                <Link
                  href={href}
                  style={MOBILE_LINK_STYLE}
                >
                  <Icon size={16} strokeWidth={1.8} color="hsl(22,69%,42%)" aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuLabel style={{ ...MENU_LABEL_STYLE, padding: "0.8rem 0.75rem 0.35rem" }}>
              Work with Vyso
            </DropdownMenuLabel>
            {AUDIENCE_LINKS.map(({ label, href, Icon }) => (
              <DropdownMenuItem key={href} asChild className="cursor-pointer p-0">
                <Link href={href} style={MOBILE_LINK_STYLE}>
                  <Icon size={16} strokeWidth={1.8} color="hsl(22,69%,42%)" aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuLabel style={{ ...MENU_LABEL_STYLE, padding: "0.8rem 0.75rem 0.35rem" }}>
              Industries
            </DropdownMenuLabel>
            {INDUSTRY_LINKS.map(({ label, href, Icon }) => (
              <DropdownMenuItem key={href} asChild className="cursor-pointer p-0">
                <Link href={href} style={MOBILE_LINK_STYLE}>
                  <Icon size={16} strokeWidth={1.8} color="hsl(22,69%,42%)" aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            {NAV_ITEMS.slice(1).map(({ label, href }) => (
              <DropdownMenuItem key={href} asChild className="cursor-pointer p-0">
                <Link href={href} style={MOBILE_LINK_STYLE}>{label}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer p-0">
              <Link
                href="/login"
                style={MOBILE_LINK_STYLE}
              >
                Log in →
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer p-0">
              <Link
                href="/contact"
                style={{
                  ...MOBILE_LINK_STYLE,
                  fontWeight:     600,
                  color:          "hsl(22,69%,44%)",
                }}
              >
                Contact us →
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Navbar;
