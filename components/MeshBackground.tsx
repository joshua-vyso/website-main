const BLOBS = [
  // Top-right — warm amber
  {
    w: "72vw", h: "72vw",
    top: "-20%", right: "-15%",
    color: "radial-gradient(circle at center, rgba(254,186,100,0.60) 0%, transparent 65%)",
    blur: 70,
    animation: "mesh-blob-1 16s ease-in-out infinite",
    delay: "0s",
  },
  // Bottom-left — deep orange
  {
    w: "62vw", h: "62vw",
    bottom: "-15%", left: "-10%",
    color: "radial-gradient(circle at center, rgba(234,100,40,0.42) 0%, transparent 65%)",
    blur: 75,
    animation: "mesh-blob-2 14s ease-in-out infinite",
    delay: "-5s",
  },
  // Centre-left — light peach
  {
    w: "50vw", h: "50vw",
    top: "25%", left: "15%",
    color: "radial-gradient(circle at center, rgba(255,220,170,0.55) 0%, transparent 65%)",
    blur: 65,
    animation: "mesh-blob-3 18s ease-in-out infinite",
    delay: "-9s",
  },
  // Top-left — golden
  {
    w: "44vw", h: "44vw",
    top: "0%", left: "-8%",
    color: "radial-gradient(circle at center, rgba(252,165,73,0.50) 0%, transparent 65%)",
    blur: 80,
    animation: "mesh-blob-4 15s ease-in-out infinite",
    delay: "-3s",
  },
  // Bottom-right — soft rust
  {
    w: "40vw", h: "40vw",
    bottom: "5%", right: "5%",
    color: "radial-gradient(circle at center, rgba(220,115,55,0.45) 0%, transparent 65%)",
    blur: 68,
    animation: "mesh-blob-5 20s ease-in-out infinite",
    delay: "-11s",
  },
];

export function MeshBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          style={{
            position:       "absolute",
            width:          b.w,
            height:         b.h,
            top:            b.top,
            bottom:         b.bottom,
            left:           b.left,
            right:          b.right,
            borderRadius:   "50%",
            background:     b.color,
            filter:         `blur(${b.blur}px)`,
            animation:      b.animation,
            animationDelay: b.delay,
            willChange:     "transform",
          }}
        />
      ))}
    </div>
  );
}
