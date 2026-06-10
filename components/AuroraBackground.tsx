"use client";

// Pre-inversion blues chosen so CSS `filter:invert(1)` on a white page yields warm oranges/ambers:
//   #177fbf → #e88040  (medium orange)
//   #379fdf → #c86020  (burnt orange)
//   #0f4f9f → #f0b060  (amber)
//   #0d6dbb → #f29244  (warm orange)
// Two stacked copies of the gradient + a blurred animated copy recreate the
// sweeping-beam effect from the original Aceternity AuroraBackground component.

const AURORA = [
  "repeating-linear-gradient(",
  "  100deg,",
  "  #177fbf 10%,",
  "  #379fdf 15%,",
  "  #0f4f9f 20%,",
  "  #0d6dbb 25%,",
  "  #177fbf 30%",
  ")",
].join("");

// Two background-image layers stacked — doubles the colour intensity
const DOUBLE = `${AURORA}, ${AURORA}`;

// Radial mask: concentrated at the top-right corner, fading toward bottom-left
const RADIAL_MASK =
  "radial-gradient(ellipse 80% 80% at 100% 0%, black 10%, transparent 70%)";

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  showRadialGradient?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function AuroraBackground({
  children,
  showRadialGradient = true,
  className = "",
  style,
}: AuroraBackgroundProps) {
  const mask = showRadialGradient ? RADIAL_MASK : undefined;

  return (
    <>
      {/* Fixed aurora — stays pinned as user scrolls, sits behind all content */}
      <div
        aria-hidden="true"
        style={{
          position:      "fixed",
          inset:         0,
          zIndex:        0,
          overflow:      "hidden",
          pointerEvents: "none",
          maskImage:           mask,
          WebkitMaskImage:     mask,
        }}
      >
        {/* Static layer — large background-size reveals only a slice of the diagonal gradient */}
        <div
          style={{
            position:           "absolute",
            inset:              0,
            backgroundImage:    DOUBLE,
            backgroundSize:     "300% 200%",
            backgroundPosition: "50% 50%",
            filter:             "blur(10px) invert(1)",
            opacity:            0.55,
          }}
        />

        {/* Animated layer — scrolls through the gradient at a different speed */}
        <div
          className="animate-aurora"
          style={{
            position:           "absolute",
            inset:              0,
            backgroundImage:    DOUBLE,
            backgroundSize:     "200% 100%",
            backgroundPosition: "50% 50%",
            filter:             "blur(10px) invert(1)",
            opacity:            0.35,
          }}
        />
      </div>

      {/* Page content above aurora */}
      <div
        className={className}
        style={{ position: "relative", zIndex: 1, backgroundColor: "#ffffff", ...style }}
      >
        {children}
      </div>
    </>
  );
}
