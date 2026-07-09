import { Application, BlurFilter, Texture, Sprite } from 'pixi.js';

/**
 * Glass bubble texture (transparent center + rim + highlights)
 */
function makeGlassBubbleTexture({ size = 256 } = {}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  ctx.clearRect(0, 0, size, size);

  // Outer rim (dark edge, center stays transparent)
  const rim = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r);
  rim.addColorStop(0.0, 'rgba(255,255,255,0.00)');
  rim.addColorStop(0.70, 'rgba(0,0,0,0.00)');
  rim.addColorStop(0.88, 'rgba(0,0,0,0.10)');
  rim.addColorStop(1.00, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner subtle shading
  const inner = ctx.createRadialGradient(
    cx - r * 0.18,
    cy - r * 0.18,
    r * 0.10,
    cx,
    cy,
    r
  );
  inner.addColorStop(0.0, 'rgba(255,255,255,0.08)');
  inner.addColorStop(0.55, 'rgba(255,255,255,0.02)');
  inner.addColorStop(1.0, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
  ctx.fill();

  // Highlight arc
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(2, size * 0.012);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1, size * 0.008);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI * 1.10, Math.PI * 1.42);
  ctx.stroke();

  ctx.restore();

  // Tiny sheen
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = Math.max(1, size * 0.007);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, Math.PI * 0.52, Math.PI * 0.70);
  ctx.stroke();
  ctx.restore();

  return Texture.from(c);
}

// --------------------------------------
// PIXI overlay (bubble cursor)
// --------------------------------------
const app = new Application();
await app.init({
  resizeTo: window,
  backgroundAlpha: 0,
  antialias: true,
});

document.body.style.margin = '0';
document.body.appendChild(app.canvas);

app.canvas.style.position = 'fixed';
app.canvas.style.inset = '0';
app.canvas.style.pointerEvents = 'none';
app.canvas.style.cursor = 'none';

// Bubble sprite
const bubbleTex = makeGlassBubbleTexture({ size: 384 }); // bigger & sharper
const bubble = new Sprite(bubbleTex);
bubble.anchor.set(0.5);
bubble.scale.set(0.65);
app.stage.addChild(bubble);

// Blur (soft, but not “glow”)
const blur = new BlurFilter({ strength: 3, quality: 1 });
blur.padding = 24; // avoid clipped blur edges
bubble.filters = [blur];

// --------------------------------------
// WEBGL2 background (mesh gradient)
// --------------------------------------
const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="c"></canvas> in HTML');
}

canvas.style.position = 'fixed';
canvas.style.inset = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.display = 'block';
canvas.style.cursor = 'none';

const gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) throw new Error('WebGL2 not supported');

const vert = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const frag = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_mouse;   // 0..1
uniform float u_time;

float blob(vec2 uv, vec2 p, float r) {
  float d = length(uv - p);
  return smoothstep(r, r * 0.35, d);
}

mat2 rot(float a){
  float s = sin(a), c = cos(a);
  return mat2(c,-s,s,c);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float t = u_time * 0.35;
  vec2 m = u_mouse;

  // smaller mouse radius
  float md = length(uv - m);
  float mouseInfluence = 1.0 - smoothstep(0.0, 0.35, md);
  mouseInfluence = pow(mouseInfluence, 2.2);

  // noise warp (global)
  float n = fbm(uv * 2.2 + vec2(t * 0.05, -t * 0.25));
  vec2 nWarp = vec2(
    fbm(uv * 2.2 + 10.0 + t * 0.25),
    fbm(uv * 2.2 + 20.0 - t * 0.22)
  ) - 0.5;

  uv += nWarp * (0.030 + 0.045 * mouseInfluence) * (0.6 + 0.4 * n);

  // sinus warp (subtle)
  vec2 warp = vec2(
    sin((uv.y + t) * 6.0) + sin((uv.y - t) * 2.7),
    sin((uv.x - t) * 5.0) + sin((uv.x + t) * 3.1)
  ) * 0.01;

  uv += warp;

  // control points
  vec2 p1 = vec2(0.20, 0.25) + rot(t*0.7)  * vec2(0.07, 0.02);
  vec2 p2 = vec2(0.80, 0.30) + rot(-t*0.6) * vec2(0.06, 0.03);
  vec2 p3 = vec2(0.30, 0.80) + rot(t*0.5)  * vec2(0.04, 0.05);
  vec2 p4 = vec2(0.75, 0.75) + rot(-t*0.8) * vec2(0.05, 0.04);

  // IMPORTANT: move multiple points (so not only one color moves)
  p1 = mix(p1, m, mouseInfluence * 0.10);
  p2 = mix(p2, m, mouseInfluence * 0.20);
  p3 = mix(p3, m, mouseInfluence * 0.09);
  p4 = mix(p4, m, mouseInfluence * 0.12);

  float b1 = blob(uv, p1, 0.62);
  float b2 = blob(uv, p2, 0.55);
  float b3 = blob(uv, p3, 0.68);
  float b4 = blob(uv, p4, 0.60);

  // correct palette (your 4 colors)
  vec3 c1 = vec3(0.9255, 0.6275, 0.8510); // #ECA0D9
  vec3 c2 = vec3(0.6392, 0.9255, 0.8392); // #A3ECD6
  vec3 c3 = vec3(0.6627, 0.6392, 0.9255); // #A9A3EC
  vec3 c4 = vec3(1.0000, 0.7137, 0.5373); // #FFB689

  float sum = b1 + b2 + b3 + b4 + 1e-5;
  vec3 col = (c1*b1 + c2*b2 + c3*b3 + c4*b4) / sum;

  // vignette
  float v = smoothstep(1.2, 0.2, length(v_uv - 0.5));
  col *= 0.85 + 0.25 * v;

  // stronger grain (and actually applied BEFORE output)
  vec3 grain = vec3(
    hash(gl_FragCoord.xy * 0.7 + u_time * 40.0),
    hash(gl_FragCoord.xy * 0.7 + 100.0 + u_time * 40.0),
    hash(gl_FragCoord.xy * 0.7 + 200.0 + u_time * 40.0)
  ) - 0.5;

  col += grain * 0.02;

  outColor = vec4(col, 1.0);
}
`;

function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
  }
  return sh;
}

function createProgram(vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'Program link error');
  }
  return p;
}

const program = createProgram(vert, frag);
gl.useProgram(program);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1,
  ]),
  gl.STATIC_DRAW
);

const aPosLoc = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(aPosLoc);
gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(program, 'u_resolution');
const uMouse = gl.getUniformLocation(program, 'u_mouse');
const uTime = gl.getUniformLocation(program, 'u_time');

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}
window.addEventListener('resize', resize);
resize();

// --------------------------------------
// Shared mouse state (pixels + UV)
// --------------------------------------
let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let pos = { ...target };

// use window pointer events (Pixi canvas is pointerEvents:none)
window.addEventListener('pointermove', (e) => {
  target.x = e.clientX;
  target.y = e.clientY;
});

const start = performance.now();

function frame(now) {
  const t = (now - start) / 1000;

  // smooth bubble follow
  const ease = 0.18;
  pos.x += (target.x - pos.x) * ease;
  pos.y += (target.y - pos.y) * ease;
  bubble.position.set(pos.x, pos.y);

  // IMPORTANT: WebGL mouse uses SMOOTHED pos, and must be 0..1 with Y flipped
  const mouseUvX = pos.x / window.innerWidth;
  const mouseUvY = 1.0 - pos.y / window.innerHeight;

  resize();

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform2f(uMouse, mouseUvX, mouseUvY);
  gl.uniform1f(uTime, t);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);