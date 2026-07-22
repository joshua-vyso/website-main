/** Vyso wordmark (shared SVG geometry) for platform surfaces. */
export function VysoMark({ width = 96, color = '#171A17' }: { width?: number; color?: string }) {
  const height = width * (350 / 900);
  return (
    <svg viewBox="175 455 900 350" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width, height, display: 'block' }}>
      <path d="M221 504L338 694L455 504H417L338 632L261.5 504H221Z" fill={color} />
      <path d="M467 504L536.5 618H538.5L556.5 588L502 504H467Z" fill={color} />
      <path d="M658.5 504H620.097L473 752L510 751L658.5 504Z" fill={color} />
      <path
        d="M853 519.5H715.922C688.275 519.5 673.529 535.533 673.529 557.674C673.529 581.827 690.118 597.93 717.765 597.93H777.667C805.314 597.93 820.98 615.039 820.98 638.186C820.98 661.334 803.471 676.5 778.588 676.5C699.863 676.5 579 676.5 579 676.5"
        stroke={color}
        strokeWidth={33}
        strokeMiterlimit={10}
        strokeLinejoin="round"
      />
      <path d="M892.5 503.5H853V535.5C865.982 519.464 878.253 512.228 892.5 503.5Z" fill={color} />
      <path d="M580 692.5L578.5 660.5L559 692.5H559.512H580Z" fill={color} />
      <circle cx="938.5" cy="599.5" r="95.5" fill={color} />
    </svg>
  );
}
