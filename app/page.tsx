"use client";

import { useState, useCallback } from "react";
import { BounceDot }               from "@/components/BounceDot";
import { Navbar }                  from "@/components/Navbar";
import { HeroSection }             from "@/components/HeroSection";
import { SystemsShowcase }         from "@/components/sections/SystemsShowcase";
import { HowItWorks }              from "@/components/sections/HowItWorks";
import { AppsShowcase }            from "@/components/sections/AppsShowcase";
import { PricingSection }          from "@/components/sections/PricingSection";
import { TrustStrip }              from "@/components/sections/TrustStrip";
import { SiteFooter }              from "@/components/sections/SiteFooter";
import { WebGLShaderBackground }   from "@/components/WebGLShaderBackground";

const SECTIONS = [
  HeroSection,
  SystemsShowcase,
  HowItWorks,
  AppsShowcase,
  PricingSection,
  TrustStrip,
  SiteFooter,
];

export default function Home() {
  const [siteVisible, setSiteVisible] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setSiteVisible(true);
  }, []);

  return (
    <>
      {/* Intro animation */}
      <BounceDot onComplete={handleAnimationComplete} />

      <div
        style={{
          opacity:       siteVisible ? 1 : 0,
          transition:    "opacity 0.5s ease",
          pointerEvents: siteVisible ? "auto" : "none",
        }}
      >
        {/* Global shader line — fixed behind everything */}
        <WebGLShaderBackground global />

        {/* Fixed navbar */}
        <Navbar />

        {/* Continuous scroll — no z-index on main so mix-blend-mode on hero
            text can reach through to blend against the shader canvas */}
        <main style={{ paddingTop: 64 }}>
          {SECTIONS.map((Section, i) => (
            <Section key={i} />
          ))}
        </main>
      </div>
    </>
  );
}
