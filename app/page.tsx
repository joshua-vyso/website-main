"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic                     from "next/dynamic";
import { BounceDot }               from "@/components/BounceDot";
import { Navbar }                  from "@/components/Navbar";
import { HeroSection }             from "@/components/HeroSection";
import { SystemsShowcase }         from "@/components/sections/SystemsShowcase";
import { HowItWorks }              from "@/components/sections/HowItWorks";
import { AppsShowcase }            from "@/components/sections/AppsShowcase";
import { PricingSection }          from "@/components/sections/PricingSection";
import { TrustStrip }              from "@/components/sections/TrustStrip";
import { ContactSection }          from "@/components/sections/ContactSection";
import { SiteFooter }              from "@/components/sections/SiteFooter";

// The WebGL background pulls in three.js (~650KB) and only runs in the browser,
// so it's lazy-loaded (ssr:false) — it no longer blocks the homepage's initial
// JS/first paint, and streams in just behind the intro animation.
const WebGLShaderBackground = dynamic(
  () => import("@/components/WebGLShaderBackground").then((m) => m.WebGLShaderBackground),
  { ssr: false },
);

const SECTIONS: [React.ComponentType, string][] = [
  [HeroSection,      "hero"        ],
  [SystemsShowcase,  "systems"     ],
  [HowItWorks,       "how-it-works"],
  [AppsShowcase,     "our-toolkit" ],
  [PricingSection,   "pricing"     ],
  [TrustStrip,       "trust"       ],
  [ContactSection,   "contact"     ],
];

export default function Home() {
  const [siteVisible, setSiteVisible] = useState(false);

  // Lock body scroll while the intro is playing so the user can't
  // accidentally scroll away from hero before the animation finishes.
  useEffect(() => {
    if (!siteVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [siteVisible]);

  const handleAnimationComplete = useCallback(() => {
    // Snap back to the top before revealing the site so the user
    // always lands on the hero no matter where scroll drifted during the intro.
    window.scrollTo({ top: 0, behavior: "instant" });
    setSiteVisible(true);
  }, []);

  return (
    <>
      <BounceDot onComplete={handleAnimationComplete} />

      <div
        style={{
          opacity:       siteVisible ? 1 : 0,
          transition:    "opacity 0.5s ease",
          pointerEvents: siteVisible ? "auto" : "none",
        }}
      >
        <WebGLShaderBackground global />
        <Navbar />

        <main style={{ paddingTop: 64 }}>
          {SECTIONS.map(([Section, id]) => (
            <div key={id} id={id}>
              <Section />
            </div>
          ))}
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
