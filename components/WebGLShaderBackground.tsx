"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Full-screen WebGL shader background.
 * Moving sine-wave line rendered in the Vyso burnt-orange palette.
 *
 * Props:
 *   global — when true renders position:fixed filling the full viewport,
 *            acting as a persistent site-wide background layer.
 */
export function WebGLShaderBackground({ global: isGlobal = false }: { global?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef<{
    scene:       THREE.Scene | null;
    camera:      THREE.OrthographicCamera | null;
    renderer:    THREE.WebGLRenderer | null;
    mesh:        THREE.Mesh | null;
    uniforms:    Record<string, { value: unknown }> | null;
    animationId: number | null;
  }>({
    scene: null, camera: null, renderer: null,
    mesh: null, uniforms: null, animationId: null,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const r = refs.current;

    /* ── Vertex shader (unchanged from original) ────────────────────── */
    const vertexShader = `
      attribute vec3 position;
      void main() { gl_Position = vec4(position, 1.0); }
    `;

    /* ── Fragment shader — white background, dark line with pink/blue/orange fringes ── */
    const fragmentShader = `
      precision highp float;
      uniform vec2  resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float d  = length(p) * distortion;

        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        // Per-channel line brightness (same formula as original)
        float bR = clamp(0.05 / abs(p.y + sin((rx + time) * xScale) * yScale), 0.0, 1.5);
        float bG = clamp(0.05 / abs(p.y + sin((gx + time) * xScale) * yScale), 0.0, 1.5);
        float bB = clamp(0.05 / abs(p.y + sin((bx + time) * xScale) * yScale), 0.0, 1.5);

        // Start with white
        vec3 col = vec3(1.0);

        // Dark core — G channel (no displacement) drives the black line
        col -= vec3(bG * 0.92);

        // Orange/pink fringe — R displaced to the right
        // Subtracting blue & some green leaves warm orange-pink on white
        col.g -= bR * 0.52;
        col.b -= bR * 0.88;

        // Blue/violet fringe — B displaced to the left
        // Subtracting red & some green leaves blue-violet on white
        col.r -= bB * 0.78;
        col.g -= bB * 0.42;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    r.scene    = new THREE.Scene();
    r.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.renderer.setClearColor(new THREE.Color(0xffffff));
    r.camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);

    r.uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time:       { value: 0.0 },
      xScale:     { value: 1.0 },
      yScale:     { value: 0.5 },
      distortion: { value: 0.05 },
    };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(
      new Float32Array([
        -1, -1, 0,  1, -1, 0,  -1, 1, 0,
         1, -1, 0, -1,  1, 0,   1, 1, 0,
      ]), 3,
    ));

    r.mesh = new THREE.Mesh(geo, new THREE.RawShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: r.uniforms as THREE.ShaderMaterialParameters["uniforms"],
      side: THREE.DoubleSide,
    }));
    r.scene.add(r.mesh);

    const resize = () => {
      if (!r.renderer || !r.uniforms) return;
      r.renderer.setSize(window.innerWidth, window.innerHeight, false);
      (r.uniforms.resolution.value as number[]) = [window.innerWidth, window.innerHeight];
    };

    const animate = () => {
      if (r.uniforms) (r.uniforms.time.value as number) += 0.01;
      if (r.renderer && r.scene && r.camera) r.renderer.render(r.scene, r.camera);
      r.animationId = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      if (r.animationId) cancelAnimationFrame(r.animationId);
      window.removeEventListener("resize", resize);
      if (r.mesh) {
        r.scene?.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
      }
      r.renderer?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      isGlobal ? "fixed" : "absolute",
        inset:         0,
        width:         isGlobal ? "100vw" : "100%",
        height:        isGlobal ? "100vh" : "100%",
        display:       "block",
        pointerEvents: "none",
        // -1 so the canvas sits below all flow content without needing
        // a competing z-index on the page, which lets mix-blend-mode
        // on text elements reach through to blend against the shader.
        zIndex:        isGlobal ? -1 : 0,
      }}
    />
  );
}
