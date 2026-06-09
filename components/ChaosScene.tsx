"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// ─── Content Data ───────────────────────────────────────────────────────────────

const MESSAGES = [
  "bru how much chicken we have left",
  "supplier said delivery tmrw maybe 🤷",
  "we ran out of chips again",
  "can someone check the stock??",
  "R2400 wastage this week already",
  "ahmed not answering his phone",
  "did anyone log the wastage today",
  "how much did we order last time??",
  "guys the freezer is broken again",
  "who placed the order last week??",
  "still waiting on the invoice",
  "R850 missing from the float",
  "we need more foil containers",
  "check the fridge temp NOW",
  "supplier not picking up since monday",
  "who gave the wrong qty again",
  "URGENT — delivery not arrived",
  "half the menu is 86'd",
  "what happened to the sauces??",
  "did anyone count the rice today",
  "we're short on packaging AGAIN",
  "this sheet hasn't been updated in 3 weeks",
  "nobody told me we ran out",
  "just say if you used it pls",
  "the wastage column is blank again??",
];

const TEXT_FRAGMENTS = [
  "R???", "0 units", "last updated: never", "supplier: unknown",
  "+27 82 ···", "sheet2 (2) final FINAL.xlsx", "see tab 3 maybe?",
  "stock_v7_REAL.xlsx", "#REF!", "####", "N/A", "formula error",
  "#DIV/0!", "R0.00", "qty: ???", "reorder: maybe",
  "inv_march_FINAL2.xlsx", "check tab 6", "updated: 3 weeks ago",
  "▲ 340% wastage", "float: R???", "delivery: overdue",
  "ahmed_sheet_v3.xlsx", "temp: ERR",
];

const ALERT_VARIANTS = [
  "⚠ stock low", "! no reorder", "? supplier silent",
  "⚠ freezer temp high", "! order overdue", "! wastage limit hit",
  "? last count: unknown", "⚠ float discrepancy", "! invoice missing",
  "? delivery ETA: none", "⚠ menu items 86'd", "! supplier unreachable",
];

type SpreadsheetPool = { headers: [string, string, string]; rows: [string, string, string][] };

const SPREADSHEET_POOLS: SpreadsheetPool[] = [
  { headers: ["Item", "Qty", "Waste"],       rows: [["Chicken","#REF!","####"],["Chips","R???","N/A"],["Sauce","0 units","R???"]] },
  { headers: ["Item", "Qty", "Waste"],       rows: [["Beef","####","0 units"],["Veg","N/A","#REF!"],["Oil","R???","####"]] },
  { headers: ["Product", "Stock", "Reorder"],rows: [["Rice","R???","N/A"],["Bread","#REF!","0 units"],["Salt","####","R???"]] },
  { headers: ["Product", "Stock", "Reorder"],rows: [["Wings","0 units","R???"],["Buns","#REF!","####"],["Coleslaw","N/A","#REF!"]] },
  { headers: ["SKU", "Units", "Status"],     rows: [["PKG-01","####","expired?"],["FOIL","R???","N/A"],["BAGS","0 units","#REF!"]] },
  { headers: ["Ingredient", "Cost", "Supplier"],rows:[["Cooking Oil","R???","????"],["Seasoning","#REF!","N/A"],["Flour","0 units","####"]] },
  { headers: ["Item", "Last Ordr", "Float"], rows: [["Drinks","3 wks ago","R???"],["Napkins","####","N/A"],["Containers","R???","#REF!"]] },
  { headers: ["Date", "Count", "Variance"],  rows: [["Mon","#REF!","R340"],["Tue","N/A","####"],["Wed","0 units","???"]] },
];

type ElementType = "bubble" | "spreadsheet" | "alert" | "text";

// ─── Utils ──────────────────────────────────────────────────────────────────────

const r  = (min: number, max: number) => Math.random() * (max - min) + min;
const ri = (min: number, max: number) => Math.floor(r(min, max + 0.999));
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)];

// ─── Element Factories ──────────────────────────────────────────────────────────

const MONO = "'Space Mono', 'Courier New', Courier, monospace";
const BASE = "position:absolute;pointer-events:none;will-change:transform;z-index:10;";

function makeBubble(): HTMLElement {
  const rnd = Math.random();
  const isGreen = rnd < 0.35;
  const isBlue  = !isGreen && rnd < 0.60;
  const bg    = isGreen ? "#25D366" : isBlue ? "#007AFF" : "#FFFFFF";
  const color = isGreen || isBlue ? "#FFFFFF" : "#000000";
  const tail  = isGreen || isBlue ? "right" : "left";
  const el = document.createElement("div");
  el.style.cssText = `
    ${BASE}
    max-width:224px;min-width:128px;
    background:${bg};border:2px solid #000000;border-radius:16px;
    border-bottom-${tail}-radius:0;
    padding:10px 14px;font-family:${MONO};font-size:12px;font-weight:700;
    color:${color};line-height:1.55;
  `;
  el.textContent = pick(MESSAGES);
  return el;
}

function makeSpreadsheet(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `${BASE}border:2px solid #000;background:#FFF;`;
  const pool = pick(SPREADSHEET_POOLS);
  const table = document.createElement("table");
  table.style.cssText = `border-collapse:collapse;font-family:${MONO};font-size:10px;font-weight:700;color:#000;`;
  const thead = document.createElement("thead");
  const hRow  = document.createElement("tr");
  pool.headers.forEach(h => {
    const th = document.createElement("th");
    th.style.cssText = "background:#C9A84C;border:1px solid #000;padding:3px 9px;text-align:left;font-weight:700;letter-spacing:0.02em;";
    th.textContent = h;
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  pool.rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      td.style.cssText = "border:1px solid #000;padding:3px 9px;background:#FFF;";
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function makeAlert(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    ${BASE}display:flex;align-items:center;gap:7px;
    background:#000;color:#FFF;font-family:${MONO};font-size:11px;font-weight:700;
    padding:5px 13px;border-radius:9999px;white-space:nowrap;letter-spacing:0.03em;
  `;
  const dot = document.createElement("span");
  dot.className = "vyso-pulse";
  dot.style.cssText = "width:7px;height:7px;background:#ef4444;border-radius:50%;display:inline-block;flex-shrink:0;";
  const text = document.createElement("span");
  text.textContent = pick(ALERT_VARIANTS);
  el.appendChild(dot);
  el.appendChild(text);
  return el;
}

function makeText(): HTMLElement {
  const sizes = ["10px","11px","12px","13px","14px","15px","16px"];
  const el = document.createElement("div");
  el.style.cssText = `
    ${BASE}font-family:${MONO};font-size:${pick(sizes)};font-weight:700;
    color:#000000;white-space:nowrap;letter-spacing:0.02em;
  `;
  el.textContent = pick(TEXT_FRAGMENTS);
  return el;
}

// ─── Canvas Mesh Spaghettification ──────────────────────────────────────────────

const MESH_G       = 60_000_000;
const MESH_SWIRL   = 0.45;
const MESH_SOFT_SQ = 100 * 100;

type MeshVert = { x: number; y: number; vx: number; vy: number };

async function captureElementImage(el: HTMLElement, w: number, h: number): Promise<HTMLImageElement | null> {
  try {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = 'relative';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.transform = 'none';
    clone.style.willChange = 'auto';
    clone.style.zIndex = '0';
    const svgStr =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;">` +
      clone.outerHTML +
      `</div></foreignObject></svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      const t = setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 1500);
      img.onload = () => { clearTimeout(t); URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { clearTimeout(t); URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch { return null; }
}

function drawTexturedTri(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement, imgW: number, imgH: number,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
) {
  const det = sx0*(sy1-sy2) + sx1*(sy2-sy0) + sx2*(sy0-sy1);
  if (Math.abs(det) < 0.001) return;
  const inv = 1 / det;
  const a = (dx0*(sy1-sy2) + dx1*(sy2-sy0) + dx2*(sy0-sy1)) * inv;
  const b = (dy0*(sy1-sy2) + dy1*(sy2-sy0) + dy2*(sy0-sy1)) * inv;
  const c = (dx0*(sx2-sx1) + dx1*(sx0-sx2) + dx2*(sx1-sx0)) * inv;
  const d = (dy0*(sx2-sx1) + dy1*(sx0-sx2) + dy2*(sx1-sx0)) * inv;
  const e = (dx0*(sx1*sy2-sx2*sy1) + dx1*(sx2*sy0-sx0*sy2) + dx2*(sx0*sy1-sx1*sy0)) * inv;
  const f = (dy0*(sx1*sy2-sx2*sy1) + dy1*(sx2*sy0-sx0*sy2) + dy2*(sx0*sy1-sx1*sy0)) * inv;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0); ctx.lineTo(dx1, dy1); ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, imgW, imgH);
  ctx.restore();
}

function canvasSuck(
  elements: HTMLElement[],
  centerX: number,
  centerY: number,
  onAllDone: () => void
): () => void {
  if (elements.length === 0) { onAllDone(); return () => {}; }

  const canvas = document.createElement("canvas");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = "position:fixed;top:0;left:0;z-index:200;pointer-events:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  interface Mesh {
    el:        HTMLElement;
    img:       HTMLImageElement | null;
    imgW:      number;
    imgH:      number;
    verts:     MeshVert[];
    colors:    string[];
    rows:      number;
    cols:      number;
    delay:     number;
    initDist:  number;
    activated: boolean;
    done:      boolean;
    hasBorder: boolean;
  }

  const meshes: Mesh[] = [];

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;

    const cols = Math.max(8,  Math.min(24, Math.round(rect.width  / 10)));
    const rows = Math.max(5,  Math.min(18, Math.round(rect.height /  8)));
    const computed  = window.getComputedStyle(el);
    const bg        = computed.backgroundColor;
    const hasTable  = !!el.querySelector("table");
    const hasBorder = parseFloat(computed.borderWidth) > 0;

    const colors: string[] = [];
    for (let ri = 0; ri < rows; ri++) {
      const yFrac = (ri + 0.5) / rows;
      for (let ci = 0; ci < cols; ci++) {
        colors.push(hasTable
          ? (yFrac < 0.3 ? "#C9A84C" : ri % 2 === 0 ? "#FFFFFF" : "#F0EAD6")
          : bg);
      }
    }

    const verts: MeshVert[] = [];
    for (let ri = 0; ri <= rows; ri++) {
      for (let ci = 0; ci <= cols; ci++) {
        verts.push({
          x:  rect.left + (ci / cols) * rect.width,
          y:  rect.top  + (ri / rows) * rect.height,
          vx: 0, vy: 0,
        });
      }
    }

    const initDist = Math.hypot(
      rect.left + rect.width  / 2 - centerX,
      rect.top  + rect.height / 2 - centerY,
    );

    meshes.push({
      el, img: null, imgW: Math.ceil(rect.width), imgH: Math.ceil(rect.height),
      verts, colors, rows, cols, delay: 0, initDist,
      activated: false, done: false, hasBorder,
    });
  }

  meshes.sort((a, b) => b.initDist - a.initDist);
  meshes.forEach((m, i) => { m.delay = (i / meshes.length) * 0.55 + r(-0.04, 0.04); });

  let startT: number | null = null;
  let lastT:  number | null = null;
  let doneCount = 0;
  let rafId = 0;
  let cancelled = false;

  function tick(now: number) {
    if (cancelled) return;
    if (startT === null) startT = now;
    const elapsed = (now - startT) / 1000;
    const dt = Math.min(lastT === null ? 0 : (now - lastT) / 1000, 0.033);
    lastT = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const mesh of meshes) {
      if (mesh.done) continue;
      const me = elapsed - mesh.delay;
      if (me <= 0) continue;

      if (!mesh.activated) {
        mesh.activated = true;
        gsap.set(mesh.el, { opacity: 0 });
      }

      let sumDist = 0;
      for (const v of mesh.verts) {
        const dx = centerX - v.x, dy = centerY - v.y;
        const d2 = dx*dx + dy*dy, d = Math.sqrt(d2);
        sumDist += d;
        if (d < 20) { v.x = centerX; v.y = centerY; v.vx = 0; v.vy = 0; continue; }
        const id = 1 / d;
        const f = MESH_G / (d2 + MESH_SOFT_SQ);
        v.vx = (v.vx + f * id * (dx - dy * MESH_SWIRL) * dt) * 0.97;
        v.vy = (v.vy + f * id * (dy + dx * MESH_SWIRL) * dt) * 0.97;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
      }

      const avgD = sumDist / mesh.verts.length;
      const distFade = Math.min(1, avgD / 30);
      // Far elements get more time: initDist ≥ 500px → fadeStart ≈ 3.0s, near → 1.8s
      const fadeStart = 1.8 + Math.min(1.2, mesh.initDist / 500);
      const timeFade  = me < fadeStart ? 1 : Math.max(0, 1 - (me - fadeStart) / 0.8);
      const opacity   = Math.min(distFade, timeFade);

      if (opacity <= 0 || me > fadeStart + 0.8) {
        mesh.done = true; doneCount++;
      } else {
        renderMesh(ctx, mesh, opacity);
      }
    }

    if (doneCount >= meshes.length) { canvas.remove(); onAllDone(); return; }
    rafId = requestAnimationFrame(tick);
  }

  // Capture screenshots of all elements, then kick off the physics loop
  (async () => {
    const captures = await Promise.allSettled(
      meshes.map(m => captureElementImage(m.el, m.imgW, m.imgH))
    );
    if (cancelled) return;
    meshes.forEach((m, i) => {
      const res = captures[i];
      if (res.status === 'fulfilled') m.img = res.value;
    });
    rafId = requestAnimationFrame(tick);
  })();

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    canvas.remove();
    meshes.forEach(m => { if (m.activated) gsap.set(m.el, { opacity: 1 }); });
  };
}

function renderMesh(
  ctx: CanvasRenderingContext2D,
  mesh: { verts: MeshVert[]; colors: string[]; rows: number; cols: number; hasBorder: boolean; img: HTMLImageElement | null; imgW: number; imgH: number },
  opacity: number
): void {
  const { verts, colors, rows, cols, hasBorder, img, imgW, imgH } = mesh;
  const W1 = cols + 1;
  ctx.save();
  ctx.globalAlpha = opacity;

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const tl = ri * W1 + ci, tr = tl + 1;
      const bl = (ri + 1) * W1 + ci, br = bl + 1;

      if (img) {
        // Textured: map each quad's source image slice onto the deformed quad via 2 affine triangles
        const sx0 = (ci / cols) * imgW,     sy0 = (ri / rows) * imgH;
        const sx1 = ((ci+1)/cols) * imgW,   sy1 = sy0;
        const sx2 = sx1,                     sy2 = ((ri+1)/rows) * imgH;
        const sx3 = sx0,                     sy3 = sy2;
        drawTexturedTri(ctx, img, imgW, imgH,
          sx0, sy0, sx1, sy1, sx2, sy2,
          verts[tl].x, verts[tl].y, verts[tr].x, verts[tr].y, verts[br].x, verts[br].y);
        drawTexturedTri(ctx, img, imgW, imgH,
          sx0, sy0, sx2, sy2, sx3, sy3,
          verts[tl].x, verts[tl].y, verts[br].x, verts[br].y, verts[bl].x, verts[bl].y);
      } else {
        ctx.beginPath();
        ctx.moveTo(verts[tl].x, verts[tl].y);
        ctx.lineTo(verts[tr].x, verts[tr].y);
        ctx.lineTo(verts[br].x, verts[br].y);
        ctx.lineTo(verts[bl].x, verts[bl].y);
        ctx.closePath();
        const color = colors[ri * cols + ci];
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
  }

  if (hasBorder) {
    ctx.beginPath();
    for (let ci = 0; ci <= cols; ci++) {
      const v = verts[ci];
      ci === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y);
    }
    for (let ri = 1; ri <= rows; ri++) ctx.lineTo(verts[ri * W1 + cols].x, verts[ri * W1 + cols].y);
    for (let ci = cols - 1; ci >= 0; ci--) ctx.lineTo(verts[rows * W1 + ci].x, verts[rows * W1 + ci].y);
    for (let ri = rows - 1; ri > 0; ri--) ctx.lineTo(verts[ri * W1].x, verts[ri * W1].y);
    ctx.closePath();
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.stroke();
  }

  ctx.restore();
}

// ─── Component ──────────────────────────────────────────────────────────────────

interface ChaosSceneProps {
  onSuckComplete?: () => void;
}

export function ChaosScene({ onSuckComplete }: ChaosSceneProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const activeEls       = useRef<HTMLElement[]>([]);
  const allTweens       = useRef<gsap.core.Tween[]>([]);
  const allTimeouts     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const circleRef       = useRef<HTMLDivElement | null>(null);
  const cancelSpiralRef = useRef<(() => void) | null>(null);
  const onSuckCompleteRef = useRef(onSuckComplete);
  onSuckCompleteRef.current = onSuckComplete;
  const MAX_ELS = 42;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (!document.getElementById("vyso-chaos-css")) {
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap";
      document.head.appendChild(link);
      const style = document.createElement("style");
      style.id = "vyso-chaos-css";
      style.textContent = `
        @keyframes vysoPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.25;transform:scale(0.65)}}
        .vyso-pulse{animation:vysoPulse 1.1s ease-in-out infinite}
      `;
      document.head.appendChild(style);
    }

    function showCircle() {
      const circle = document.createElement("div");
      circle.style.cssText = `
        position:fixed;width:48px;height:48px;border-radius:50%;
        background:#000000;top:calc(50% - 24px);left:calc(50% - 24px);
        z-index:300;pointer-events:none;will-change:transform;
      `;
      document.body.appendChild(circle);
      circleRef.current = circle;
      gsap.fromTo(circle,
        { scale: 0 },
        { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.5)",
          onComplete: () => onSuckCompleteRef.current?.() }
      );
    }

    function spawn(type?: ElementType) {
      const pool: ElementType[] = [
        "bubble","bubble","bubble","spreadsheet","spreadsheet","alert","alert","text",
      ];
      const elType = type ?? pick(pool);
      const el =
        elType === "bubble"      ? makeBubble()      :
        elType === "spreadsheet" ? makeSpreadsheet() :
        elType === "alert"       ? makeAlert()       :
                                   makeText();

      if (activeEls.current.length >= MAX_ELS) {
        const oldest = activeEls.current.shift()!;
        const t = gsap.to(oldest, { opacity: 0, duration: 0.3, onComplete: () => oldest.remove() });
        allTweens.current.push(t);
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      el.style.left = `${r(0.04, 0.84) * vw}px`;
      el.style.top  = `${r(0.04, 0.86) * vh}px`;
      container.appendChild(el);
      activeEls.current.push(el);

      const rot      = r(-20, 20);
      const useScale = Math.random() > 0.45;

      if (useScale) {
        const t = gsap.fromTo(el,
          { scale: 0, rotation: rot, opacity: 1 },
          { scale: 1, rotation: rot * 0.3, duration: 0.62, ease: "back.out(1.4)" }
        );
        allTweens.current.push(t);
      } else {
        const edge = ri(0, 3);
        const dx = edge === 1 ?  vw * 0.65 : edge === 3 ? -vw * 0.65 : r(-vw * 0.35, vw * 0.35);
        const dy = edge === 0 ? -vh * 0.55 : edge === 2 ?  vh * 0.55 : r(-vh * 0.35, vh * 0.35);
        const t = gsap.fromTo(el,
          { x: dx, y: dy, rotation: rot, opacity: 1 },
          { x: 0,  y: 0,  rotation: rot * 0.3, duration: 0.68, ease: "back.out(1.4)" }
        );
        allTweens.current.push(t);
      }

      const tid = setTimeout(() => {
        if (!el.isConnected) return;
        const t1 = gsap.to(el, {
          x: `+=${r(-10, 10)}`, y: `+=${r(-8, 8)}`,
          duration: r(2.5, 4.5), ease: "sine.inOut", repeat: -1, yoyo: true,
        });
        allTweens.current.push(t1);
        if (Math.random() < 0.33) {
          const t2 = gsap.to(el, {
            rotation: r(-5, 5), duration: r(3, 6), ease: "sine.inOut", repeat: -1, yoyo: true,
          });
          allTweens.current.push(t2);
        }
      }, 720);
      allTimeouts.current.push(tid);
    }

    // ── Spawn schedule ───────────────────────────────────────────────────────────
    const schedule: [number, ElementType][] = [
      [0,"bubble"],[400,"spreadsheet"],[700,"bubble"],[800,"bubble"],
      [880,"alert"],[960,"text"],[1100,"bubble"],[1200,"bubble"],
      [1280,"alert"],[1320,"spreadsheet"],[1400,"bubble"],[1440,"text"],
      [1520,"alert"],[1600,"bubble"],[1680,"spreadsheet"],[1760,"bubble"],
      [1840,"text"],[1920,"alert"],
    ];
    schedule.forEach(([ms, type]) => {
      allTimeouts.current.push(setTimeout(() => spawn(type), ms));
    });
    let t = 2000;
    while (t <= 4000) {
      const time = t;
      allTimeouts.current.push(setTimeout(() => spawn(), time));
      t += ri(80, 120);
    }

    // ── Reveal sequence at 5s ────────────────────────────────────────────────────
    const revealTid = setTimeout(() => {
      allTweens.current.forEach(tw => tw.kill());
      allTweens.current = [];

      const centerX = window.innerWidth  / 2;
      const centerY = window.innerHeight / 2;
      const elements = activeEls.current.filter(el => el.isConnected);
      if (elements.length === 0) { showCircle(); return; }

      cancelSpiralRef.current = canvasSuck(elements, centerX, centerY, showCircle);
    }, 5000);

    allTimeouts.current.push(revealTid);

    return () => {
      allTimeouts.current.forEach(clearTimeout);
      allTweens.current.forEach(tw => tw.kill());
      cancelSpiralRef.current?.();
      activeEls.current.forEach(el => el.remove());
      circleRef.current?.remove();
      activeEls.current = [];
      allTweens.current = [];
      allTimeouts.current = [];
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden bg-white"
      style={{ zIndex: 50 }}
      aria-hidden="true"
    />
  );
}
