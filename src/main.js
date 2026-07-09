import './style.css';
import {
  Application,
  Assets,
  BlurFilter,
  Graphics,
  Rectangle,
  Sprite,
  SCALE_MODES
} from 'pixi.js';


// Offscreen donor canvas
const donor = document.createElement('canvas');

let w = 0;
let h = 0;
let dpr = 1;

function resize() {
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  w = window.innerWidth;
  h = window.innerHeight;

  donor.width = Math.floor(w * dpr);
  donor.height = Math.floor(h * dpr);
}
window.addEventListener('resize', resize);
resize();

// Color palettes
const colorsBg = ['#ECA0D9', '#A3ECD6', '#A9A3EC'];
const colorsFg = ['#FFB689', '#FFF390', '#9DD9F9'];

(async () => {
    const app = new Application();

    await app.init({ resizeTo: window });

    document.body.appendChild(app.canvas);

    const radius = 150;
    const blurSize = 10;

    const firstCanvas = await Assets.load(`${import.meta.env.BASE_URL}assets/img/mesh-373.png`);
    const secondCanvas = await Assets.load(`${import.meta.env.BASE_URL}assets/img/mesh-37.png`);    

    const some_bg = new Sprite(firstCanvas);
    some_bg.width = app.screen.width;
    some_bg.height = app.screen.height;
    app.stage.addChild(some_bg);

    const background = new Sprite(secondCanvas);
    app.stage.addChild(background);
    background.width = app.screen.width;
    background.height = app.screen.height;

    const circle = new Graphics()
        .circle(radius + blurSize, radius + blurSize, radius).fill({ color: 0xff0000 });

    circle.filters = [new BlurFilter(blurSize)];

    const bounds = new Rectangle(0, 0, (radius + blurSize) * 2, (radius + blurSize) * 2);
    const texture = app.renderer.generateTexture(circle, SCALE_MODES.NEAREST, 1, bounds);
    const focus = new Sprite(texture);

    app.stage.addChild(focus);
    background.mask = focus;

    app.stage.interactive = true;
    app.stage.on('mousemove', pointerMove);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    function pointerMove(event) {
        focus.position.x = event.data.global.x - focus.width / 2;
        focus.position.y = event.data.global.y - focus.height / 2;
    }
}) (); 

/*function drawLens() {
  const r = 115;          // radius
  const pad = 12;         // extra sampling area to avoid filter edges

  // Smooth cursor + compute velocity
  cx = lerp(cx, tx, 0.18);
  cy = lerp(cy, ty, 0.18);

  vx = lerp(vx, tx - lastTx, 0.25);
  vy = lerp(vy, ty - lastTy, 0.25);
  lastTx = tx;
  lastTy = ty;

  // Use velocity to offset sampling => “colors move in direction”
  // Tune strength here:
  const push = 0.55;
  const sx = cx - vx * push;
  const sy = cy - vy * push;

  // 1) Clip to circle
  vctx.save();
  vctx.beginPath();
  vctx.arc(cx, cy, r, 0, Math.PI * 2);
  vctx.clip();

  // 2) Draw the sampled region from donor with blur/saturation
  vctx.filter = 'blur(10px) saturate(1.25) contrast(1.05)';
  vctx.drawImage(
    donor,
    (sx - r - pad) * dpr, (sy - r - pad) * dpr, (2 * (r + pad)) * dpr, (2 * (r + pad)) * dpr, // source
    cx - r - pad, cy - r - pad, 2 * (r + pad), 2 * (r + pad)                                   // dest
  );
  vctx.filter = 'none';

  // 3) Chromatic aberration (RGB split): draw same sample shifted with blend
  vctx.globalCompositeOperation = 'screen';

  // red tint layer
  vctx.globalAlpha = 0.35;
  vctx.drawImage(
    donor,
    (sx - r - pad - 3) * dpr, (sy - r - pad) * dpr, (2 * (r + pad)) * dpr, (2 * (r + pad)) * dpr,
    cx - r - pad - 3, cy - r - pad, 2 * (r + pad), 2 * (r + pad)
  );
  vctx.fillStyle = 'rgba(255,60,80,0.12)';
  vctx.fillRect(cx - r - pad, cy - r - pad, 2 * (r + pad), 2 * (r + pad));

  // blue tint layer
  vctx.globalAlpha = 0.35;
  vctx.drawImage(
    donor,
    (sx - r - pad + 3) * dpr, (sy - r - pad) * dpr, (2 * (r + pad)) * dpr, (2 * (r + pad)) * dpr,
    cx - r - pad + 3, cy - r - pad, 2 * (r + pad), 2 * (r + pad)
  );
  vctx.fillStyle = 'rgba(70,140,255,0.12)';
  vctx.fillRect(cx - r - pad, cy - r - pad, 2 * (r + pad), 2 * (r + pad));

  // reset blend
  vctx.globalAlpha = 1;
  vctx.globalCompositeOperation = 'source-over';

  vctx.restore();

  // 4) Lens ring + shadow (outside clip)
  vctx.save();
  vctx.beginPath();
  vctx.arc(cx, cy, r, 0, Math.PI * 2);

  vctx.shadowColor = 'rgba(0,0,0,0.25)';
  vctx.shadowBlur = 35;
  vctx.fillStyle = 'rgba(255,255,255,0.05)';
  vctx.fill();

  vctx.shadowBlur = 0;
  vctx.lineWidth = 1;
  vctx.strokeStyle = 'rgba(255,255,255,0.35)';
  vctx.stroke();

  vctx.beginPath();
  vctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  vctx.strokeStyle = 'rgba(255,255,255,0.14)';
  vctx.stroke();
  vctx.restore();
}

let start = performance.now();

function frame(now) {
  const t = (now - start) / 1000;

  bgx = lerp(bgx, clamp(vx * 6, -120, 120), 0.02);
  bgy = lerp(bgy, clamp(vy * 6, -120, 120), 0.02);

  vctx.drawImage(donor, 0, 0, w, h);

  drawLens();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame); */