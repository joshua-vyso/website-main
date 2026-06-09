// ─── Logo geometry ────────────────────────────────────────────────────────────

export const SLOGAN = "Your operations partner, reimagined.";

export const DOT_SIZE           = 140;
const        SCALE              = DOT_SIZE / 191;
export const VYS_W              = Math.round(671.5 * SCALE);
export const VYS_H              = Math.round(249   * SCALE);
export const WYSO_HALF_W        = Math.round((VYS_W + DOT_SIZE - Math.round(49.5 * SCALE)) / 2);
export const DOT_SLIDE          = Math.round(311   * SCALE);
export const LOGO_BOTTOM_OFFSET = VYS_H - DOT_SIZE / 2;

// ─── Dark scene ───────────────────────────────────────────────────────────────

export const DARK_WORDS       = ["SYSTEMS", "AUTOMATIONS", "ANALYTICS"] as const;
export const WORD_SPAWN_RATES = [250, 200, 100];   // ms between chaos elements, per word index
export const WORD_SIZE        = 80;                 // px — height of one word slot

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const MONO    = "'Space Mono','Courier New',Courier,monospace";
export const DISPLAY = "'Alumni Sans','Arial Narrow',sans-serif";
