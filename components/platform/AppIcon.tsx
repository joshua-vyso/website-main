import type { AppIconKey } from '@/lib/platform/types';

/** Per-key tints (tile background + glyph foreground) mirroring the mobile look. */
const TINTS: Record<AppIconKey, { bg: string; fg: string }> = {
  docu: { bg: '#EAF2FC', fg: '#3E7BC4' },
  proc: { bg: '#E6F1FB', fg: '#2C5E8A' },
  margin: { bg: '#E1F5EE', fg: '#2E7D67' },
  waste: { bg: '#FBEFDD', fg: '#9A6314' },
  shift: { bg: '#ECEAFB', fg: '#5B53C0' },
  supplier: { bg: '#FBE9EE', fg: '#B0466A' },
  dash: { bg: '#EDEFF1', fg: '#6B6F68' },
};

interface AppIconProps {
  name: AppIconKey;
  /** Outer tile size in px. */
  size?: number;
}

/**
 * A small rounded tinted tile with the module's glyph. The glyph PNG is
 * transparent, so it's tinted to an arbitrary colour via CSS `mask-image`.
 */
export function AppIcon({ name, size = 26 }: AppIconProps) {
  const { bg, fg } = TINTS[name];
  const glyph = Math.round(size * 0.56);
  const maskUrl = `url(/icons-gen/${name}.png)`;

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: bg,
      }}
    >
      <span
        style={{
          width: glyph,
          height: glyph,
          backgroundColor: fg,
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    </span>
  );
}
