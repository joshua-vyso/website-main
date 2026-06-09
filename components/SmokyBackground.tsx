"use client";
import { useRef, useEffect, useCallback } from "react";

// ── Shared vertex shader ───────────────────────────────────────────────────────
const VERT = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

// ── Dark mode fragment shader ──────────────────────────────────────────────────
// Black background. White + orange + grey wisps. Clear centre so white logo pops.
const FRAG_DARK = `
  precision highp float;
  uniform float u_time;
  uniform vec2  u_resolution;
  uniform vec2  u_mouse;
  uniform float u_speed;
  uniform float u_intensity;
  uniform float u_complexity;

  float rand(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(rand(i),rand(i+vec2(1,0)),u.x),
               mix(rand(i+vec2(0,1)),rand(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;++i){v+=a*noise(p);p=m*p;a*=0.5;}
    return v;
  }

  void main(){
    vec2 uv  = (gl_FragCoord.xy*2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    vec2 muv = (u_mouse*2.0 - 1.0);
    muv.x   *= u_resolution.x / u_resolution.y;

    vec2 p = uv * u_complexity;
    float t = u_time * 0.18 * u_speed;

    float q = fbm(p - t);
    vec2  r = vec2(fbm(p + q + vec2(1.7,9.2) - t),
                   fbm(p + q + vec2(8.3,2.8) - t));
    vec2  d = r * u_intensity;

    // Gentle mouse drift
    float md = length(uv - muv);
    d -= normalize(uv - muv) * 0.055 / (md + 0.35);

    float val = fbm(p + d);

    // Colour — black background, dark grey + orange wisps only (no white)
    float colorNoise = fbm(p * 0.75 + vec2(3.5, 8.1) - t * 0.55);
    vec3 darkGrey1  = vec3(0.22, 0.20, 0.19);  // very dark warm grey
    vec3 darkGrey2  = vec3(0.42, 0.39, 0.36);  // medium dark grey
    vec3 orangeWisp = vec3(0.745, 0.365, 0.137); // hsl(22,69%,44%)
    vec3 deepOrange = vec3(0.50, 0.21, 0.05);   // deep burnt orange
    vec3 wisp = mix(
      mix(darkGrey1, darkGrey2, colorNoise * 0.85),
      mix(orangeWisp, deepOrange, (1.0 - colorNoise) * 0.45),
      colorNoise * colorNoise * 0.65
    );

    float smoke = smoothstep(0.28, 0.70, val);

    // Clear centre — reduces smoke where the logo lives so white letters pop
    float centerDist  = length(uv * vec2(1.0, 0.80));
    float centerClear = smoothstep(0.0, 0.40, centerDist);
    smoke *= centerClear;

    vec3 col = wisp * smoke * u_intensity;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Light mode fragment shader ─────────────────────────────────────────────────
// Transparent background — orange + grey wisps float over white sections.
const FRAG_LIGHT = `
  precision highp float;
  uniform float u_time;
  uniform vec2  u_resolution;
  uniform vec2  u_mouse;
  uniform float u_speed;
  uniform float u_intensity;
  uniform float u_complexity;

  float rand(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(rand(i),rand(i+vec2(1,0)),u.x),
               mix(rand(i+vec2(0,1)),rand(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<5;++i){v+=a*noise(p);p=m*p;a*=0.5;}
    return v;
  }

  void main(){
    vec2 uv  = (gl_FragCoord.xy*2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    vec2 muv = (u_mouse*2.0 - 1.0);
    muv.x   *= u_resolution.x / u_resolution.y;

    vec2 p = uv * u_complexity;
    float t = u_time * 0.14 * u_speed;

    float q = fbm(p - t);
    vec2  r = vec2(fbm(p + q + vec2(1.7,9.2) - t),
                   fbm(p + q + vec2(8.3,2.8) - t));
    vec2  d = r * u_intensity;

    // Very gentle mouse drift in light mode
    float md = length(uv - muv);
    d -= normalize(uv - muv) * 0.03 / (md + 0.5);

    float val = fbm(p + d);

    // Colour — orange + warm grey, blended by secondary noise
    float colorNoise = fbm(p * 0.7 + vec2(4.1, 6.5) - t * 0.4);
    vec3 orangeWisp = vec3(0.745, 0.365, 0.137);  // base orange
    vec3 warmGrey   = vec3(0.58, 0.54, 0.50);
    vec3 wisp = mix(warmGrey, orangeWisp, colorNoise * colorNoise * 0.6);

    float smoke = smoothstep(0.35, 0.72, val);

    // Gentle vignette to fade edges
    smoke *= 1.0 - 0.35 * pow(length(uv), 2.0);

    // Semi-transparent output
    float alpha = smoke * u_intensity * 0.22;

    gl_FragColor = vec4(wisp, alpha);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  speed?:      number;
  intensity?:  number;
  complexity?: number;
  mode?:       "dark" | "light";
  style?:      React.CSSProperties;
}

export function SmokyBackground({
  speed      = 0.55,
  intensity  = 1.6,
  complexity = 2.2,
  mode       = "dark",
  style,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const mouseTarget  = useRef({ x: 0.5, y: 0.5 });
  const mouseCurrent = useRef({ x: 0.5, y: 0.5 });
  const rafRef       = useRef<number>(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    mouseTarget.current = {
      x:     (e.clientX - r.left)  / r.width,
      y: 1 - (e.clientY - r.top)   / r.height,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (
      canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")
    ) as WebGLRenderingContext | null;
    if (!gl) return;

    // Light mode: enable transparency blending
    if (mode === "light") {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    const compile = (src: string, type: number) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };

    const FRAG = mode === "dark" ? FRAG_DARK : FRAG_LIGHT;

    const vert = compile(VERT, gl.VERTEX_SHADER);
    const frag = compile(FRAG, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert); gl.attachShader(prog, frag);
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res:   gl.getUniformLocation(prog, "u_resolution"),
      time:  gl.getUniformLocation(prog, "u_time"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      spd:   gl.getUniformLocation(prog, "u_speed"),
      int:   gl.getUniformLocation(prog, "u_intensity"),
      cplx:  gl.getUniformLocation(prog, "u_complexity"),
    };

    const t0 = performance.now();
    const LERP = 0.035;

    const render = () => {
      if (canvas.width  !== canvas.clientWidth)  canvas.width  = canvas.clientWidth;
      if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;

      mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * LERP;
      mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * LERP;

      if (mode === "light") {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res,   canvas.width, canvas.height);
      gl.uniform1f(u.time,  (performance.now() - t0) * 0.001);
      gl.uniform2f(u.mouse, mouseCurrent.current.x, mouseCurrent.current.y);
      gl.uniform1f(u.spd,   speed);
      gl.uniform1f(u.int,   intensity);
      gl.uniform1f(u.cplx,  complexity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };
    render();

    window.addEventListener("mousemove", onMouseMove);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      if (!gl.isContextLost()) {
        gl.deleteProgram(prog);
        gl.deleteShader(vert); gl.deleteShader(frag);
        gl.deleteBuffer(buf);
      }
    };
  }, [speed, intensity, complexity, mode, onMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:   "absolute",
        inset:      0,
        width:      "100%",
        height:     "100%",
        display:    "block",
        zIndex:     0,
        background: mode === "dark" ? "#000" : "transparent",
        ...style,
      }}
    />
  );
}
