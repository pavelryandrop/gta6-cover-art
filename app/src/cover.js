// Neon Vice cover renderer: draws the whole poster onto any 2D canvas context at any
// size, from one state object. No network, no fonts to load: the lettering is drawn
// with the system heavy sans, condensed and outlined on the canvas itself.

/** Export sizes in pixels, keyed by the editor's size choice. */
export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

/** Colour grades: a photo filter plus a tint the panels wear. */
export const GRADES = {
  sunset: { filter: 'saturate(1.3) contrast(1.06)', top: 'rgba(255, 140, 70, 0.10)', bottom: 'rgba(255, 45, 120, 0.26)', accent: '#ffd60a' },
  neon: { filter: 'saturate(1.45) contrast(1.08)', top: 'rgba(70, 220, 255, 0.16)', bottom: 'rgba(255, 60, 200, 0.22)', accent: '#5ff2ff' },
  clean: { filter: 'saturate(1.1) contrast(1.02)', top: 'rgba(0, 0, 0, 0)', bottom: 'rgba(20, 6, 32, 0.10)', accent: '#ffffff' },
};

/** A deterministic speck generator, so the same state always draws the same grain. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Default per-panel photo slots, zoom and offsets for each layout. Small panels
 * start slightly pulled up, so a portrait photo keeps its subject's head in frame. */
export function defaultPanels() {
  const panel = (slot, zoom = 1.15, oy = 0) => ({ slot, zoom, ox: 0, oy });
  return {
    poster: [panel('A', 1.15), panel('B', 1.05, -0.08), panel('C', 1.05, 0.05)],
    duo: [panel('A', 1.15), panel('B', 1.05, -0.05)],
    hero: [panel('A', 1.1)],
  };
}

/** Where the caption band and the panel zone sit, for a title at the top or bottom. */
function zones(titlePlace, h) {
  if (titlePlace === 'top') return { caption: { y: h * 0.03, h: h * 0.24 }, panels: { y: h * 0.29, h: h * 0.66 } };
  return { caption: { y: h * 0.7, h: h * 0.27 }, panels: { y: h * 0.05, h: h * 0.63 } };
}

/**
 * Panel geometry in cover coordinates for a layout: each panel's rect, its slight
 * tilt in degrees, and its photo slot, zoom and offset from the state.
 */
export function layoutPanels(state, w, h) {
  const z = zones(state.titlePlace, h);
  const py = z.panels.y;
  const ph = z.panels.h;
  const cfgs = state.panels[state.layout];
  if (state.layout === 'duo') {
    return [
      { ...cfgs[0], x: w * 0.045, y: py, w: w * 0.44, h: ph, rot: -1 },
      { ...cfgs[1], x: w * 0.515, y: py, w: w * 0.44, h: ph, rot: 1 },
    ];
  }
  if (state.layout === 'hero') {
    return [{ ...cfgs[0], x: 0, y: 0, w, h, rot: 0, full: true }];
  }
  return [
    { ...cfgs[0], x: w * 0.045, y: py, w: w * 0.585, h: ph, rot: 0 },
    { ...cfgs[1], x: w * 0.655, y: py, w: w * 0.3, h: ph * 0.48, rot: -2 },
    { ...cfgs[2], x: w * 0.655, y: py + ph * 0.52, w: w * 0.3, h: ph * 0.48, rot: 1.5 },
  ];
}

/** The panel (if any) whose rotated rect holds the point (x, y) in cover coordinates. */
export function panelAt(panels, x, y) {
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const a = (-p.rot * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(rx) <= p.w / 2 && Math.abs(ry) <= p.h / 2) return i;
  }
  return -1;
}

/** A striped sunset disc, drawn once on its own canvas so the stripes cut only the disc. */
function sunCanvas(radius) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(radius * 2 + 4);
  const g = c.getContext('2d');
  const cx = c.width / 2;
  const cy = c.height / 2;
  const glow = g.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  glow.addColorStop(0, '#fff6c2');
  glow.addColorStop(0.55, '#ffb347');
  glow.addColorStop(1, '#ff5e78');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, radius, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  let y = cy + radius * 0.05;
  let band = radius * 0.03;
  while (y < cy + radius) {
    g.fillRect(0, y, c.width, band);
    y += band + radius * 0.11;
    band *= 1.45;
  }
  return c;
}

/** One palm silhouette, trunk leaning `lean` (-1..1) with fronds fanning from its crown. */
function drawPalm(ctx, x, baseY, size, lean, color) {
  const topX = x + lean * size * 0.25;
  const topY = baseY - size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * size * 0.08, baseY - size * 0.55, topX, topY);
  ctx.stroke();
  // Fronds fan from just below horizontal-left, over the crown, to just below
  // horizontal-right; each arches up, then droops at its tip.
  ctx.lineWidth = Math.max(2, size * 0.04);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const ang = Math.PI * (1.11 + t * 0.78);
    const reach = size * (0.38 + (i % 2) * 0.08);
    const ex = topX + Math.cos(ang) * reach;
    const ey = topY + Math.sin(ang) * reach * 0.75 + size * 0.18;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo((topX + ex) / 2, Math.min(topY, (topY + ey) / 2) - size * 0.1, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** The sunset sky behind the panels: gradient, glow, striped sun, palm silhouettes. */
function drawSky(ctx, w, h, state) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1c0b36');
  sky.addColorStop(0.45, '#571a63');
  sky.addColorStop(0.68, '#b4236b');
  sky.addColorStop(0.85, '#ff7a3d');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.68, h * 0.55, 10, w * 0.68, h * 0.55, w * 0.55);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.4)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  // The striped sun sits low in the caption band's free corner, so it is never
  // hidden behind a panel: bottom-left for a bottom title, top-right for a top one.
  const r = Math.min(w, h) * 0.055;
  const sunX = state.titlePlace === 'top' ? w * 0.92 : w * 0.075;
  const sunY = state.titlePlace === 'top' ? h * 0.12 : h * 0.88;
  const sun = sunCanvas(r);
  ctx.drawImage(sun, sunX - r - 2, sunY - r - 2);
  drawPalm(ctx, w * 0.035, h * 0.995, h * 0.17, 0.6, '#221031');
  drawPalm(ctx, w * 0.965, h * 0.995, h * 0.14, -0.6, '#221031');
}

/** A photo cover-filling a rect, with the panel's zoom and offset. */
function drawPhotoInto(ctx, img, rect, zoom, ox, oy, filter) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * base;
  const ph = img.naturalHeight * base;
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h;
  ctx.save();
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

/** The grade tint and vignette a panel wears over its photo. */
function gradePanel(ctx, rect, grade) {
  const tint = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  tint.addColorStop(0, grade.top);
  tint.addColorStop(1, grade.bottom);
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const vg = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(15, 4, 28, 0)');
  vg.addColorStop(1, 'rgba(15, 4, 28, 0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** One panel: photo clipped to its (possibly tilted) rect, grade, and white border. */
function drawPanel(ctx, panel, img, grade, w) {
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((panel.rot * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  if (img) {
    drawPhotoInto(ctx, img, panel, panel.zoom, panel.ox, panel.oy, grade.filter);
  } else {
    ctx.fillStyle = '#3a1c56';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  }
  gradePanel(ctx, panel, grade);
  ctx.restore();
  if (!panel.full) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    ctx.lineWidth = Math.max(4, w * 0.0035);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.restore();
  }
}

/** The heavy condensed title and its subtitle, fitted to the caption band. */
function drawCaption(ctx, w, h, state) {
  const grade = GRADES[state.grade];
  const z = zones(state.titlePlace, h);
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim().toUpperCase();
  const titleY = z.caption.y + z.caption.h * 0.42;
  const subY = z.caption.y + z.caption.h * 0.82;
  if (title) {
    let size = h * 0.105;
    const family = '"Arial Black", "DejaVu Sans", sans-serif';
    ctx.font = `900 ${size}px ${family}`;
    while (ctx.measureText(title).width * 0.84 > w * 0.86 && size > h * 0.03) {
      size *= 0.96;
      ctx.font = `900 ${size}px ${family}`;
    }
    ctx.save();
    ctx.translate(w / 2, titleY);
    ctx.scale(0.84, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `900 ${size}px ${family}`;
    ctx.strokeStyle = '#2a0a33';
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(title, 0, 0);
    const fill = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, state.titleColor);
    fill.addColorStop(1, state.titleColor);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.045;
    ctx.fillStyle = fill;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }
  if (sub) {
    const size = Math.max(13, h * 0.026);
    ctx.save();
    ctx.font = `700 ${size}px "DejaVu Sans", sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, h * 0.004)}px`; } catch { /* older canvas: no letter spacing */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.accent;
    const tw = ctx.measureText(sub).width;
    ctx.fillText(sub, w / 2, subY);
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(2, h * 0.003);
    const bar = w * 0.055;
    const gap = w * 0.02;
    ctx.beginPath();
    ctx.moveTo(w / 2 - tw / 2 - gap - bar, subY);
    ctx.lineTo(w / 2 - tw / 2 - gap, subY);
    ctx.moveTo(w / 2 + tw / 2 + gap, subY);
    ctx.lineTo(w / 2 + tw / 2 + gap + bar, subY);
    ctx.stroke();
    ctx.restore();
  }
}

/** Film grain: deterministic specks so the same state always draws the same cover. */
function drawGrain(ctx, w, h) {
  const rnd = mulberry32(w * 7 + h * 13 + 99);
  ctx.save();
  for (let i = 0; i < 900; i++) {
    const v = rnd();
    ctx.globalAlpha = 0.028 + v * 0.03;
    ctx.fillStyle = v > 0.5 ? '#ffffff' : '#0a0416';
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  ctx.restore();
}

/**
 * Draws the whole cover for `state` onto `ctx` at `w` x `h`: sky, panels, caption,
 * frame and grain. `state.photos` holds the loaded images by slot letter.
 */
export function drawCover(ctx, w, h, state) {
  const grade = GRADES[state.grade];
  const panels = layoutPanels(state, w, h);
  if (state.layout === 'hero') {
    const img = state.photos[panels[0].slot];
    if (img) drawPhotoInto(ctx, img, panels[0], panels[0].zoom, panels[0].ox, panels[0].oy, grade.filter);
    else { ctx.fillStyle = '#3a1c56'; ctx.fillRect(0, 0, w, h); }
    const scrim = ctx.createLinearGradient(0, state.titlePlace === 'top' ? 0 : h * 0.5, 0, state.titlePlace === 'top' ? h * 0.5 : h);
    if (state.titlePlace === 'top') {
      scrim.addColorStop(0, 'rgba(20, 6, 32, 0.78)');
      scrim.addColorStop(1, 'rgba(20, 6, 32, 0)');
    } else {
      scrim.addColorStop(0, 'rgba(20, 6, 32, 0)');
      scrim.addColorStop(1, 'rgba(20, 6, 32, 0.78)');
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);
    gradePanel(ctx, panels[0], grade);
  } else {
    drawSky(ctx, w, h, state);
    for (const p of panels) drawPanel(ctx, p, state.photos[p.slot], grade, w);
  }
  drawCaption(ctx, w, h, state);
  ctx.save();
  ctx.lineWidth = Math.max(4, w * 0.0035);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeRect(w * 0.012, h * 0.012, w * 0.976, h * 0.976);
  ctx.restore();
  drawGrain(ctx, w, h);
}
