// Neon Vice editor: owns the state, wires the controls, and lets the user drag a
// panel's photo around and zoom it right on the preview canvas.

import { SIZES, drawCover, defaultPanels, layoutPanels, panelAt } from './cover.js';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

/** A fresh editor state: three sample photos, poster layout, wide size, sunset grade. */
export function freshState() {
  return {
    layout: 'poster',
    size: 'wide',
    grade: 'sunset',
    title: 'SUNSET HEIST',
    subtitle: 'ONE LAST JOB ON THE BOULEVARD',
    titleColor: '#ffffff',
    titlePlace: 'bottom',
    photos: { A: null, B: null, C: null },
    panels: defaultPanels(),
    selected: 0,
  };
}

/** Loads the three default samples into the state's photo slots. */
export async function loadDefaultSamples(state, onDone) {
  const slots = { A: 'sunset-driver', B: 'boulevard-walk', C: 'pier' };
  for (const [slot, name] of Object.entries(slots)) {
    try {
      state.photos[slot] = await loadImage(`samples/${name}.jpg`);
    } catch { /* a missing sample just leaves the slot empty */ }
    onDone();
  }
}

/** Applies a shot query (?shot=cover|editor) to a state: photo, caption, layout, size, grade. */
export function applyShotQuery(state, query) {
  const pick = (key, fallback) => query.get(key) ?? fallback;
  state.layout = ['poster', 'duo', 'hero'].includes(pick('layout', '')) ? pick('layout') : state.layout;
  state.size = ['square', 'portrait', 'wide'].includes(pick('size', '')) ? pick('size') : state.size;
  state.grade = ['sunset', 'neon', 'clean'].includes(pick('grade', '')) ? pick('grade') : state.grade;
  state.title = pick('caption', state.title);
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('color')) state.titleColor = query.get('color');
  if (query.get('place')) state.titlePlace = query.get('place');
  return pick('photo', 'sunset-driver');
}

/**
 * Starts the editor on `canvas` with the page's controls. Returns the state and a
 * redraw function. The preview canvas draws at half export size for speed; export
 * draws the same state onto a full-size offscreen canvas.
 */
export function startEditor(canvas, state) {
  const status = document.getElementById('status');
  const panelLabel = document.getElementById('panel-label');
  const zoomInput = document.getElementById('zoom');
  const ctx = canvas.getContext('2d');

  function fitPreview() {
    const [w, h] = SIZES[state.size];
    const scale = 960 / w;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
  }

  function panels() {
    return layoutPanels(state, canvas.width, canvas.height);
  }

  function selectedPanel() {
    return state.panels[state.layout][state.selected];
  }

  function redraw() {
    fitPreview();
    drawCover(ctx, canvas.width, canvas.height, state);
    const p = selectedPanel();
    panelLabel.textContent = `Panel ${state.selected + 1} · Photo ${p.slot}`;
    zoomInput.value = String(p.zoom);
    document.querySelectorAll('[data-panel-photo]').forEach((b) => {
      b.classList.toggle('on', b.dataset.panelPhoto === p.slot);
    });
  }

  // -- photo slots: file uploads and sample picks ---------------------------
  document.querySelectorAll('[data-photo]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        state.photos[input.dataset.photo] = await loadImage(URL.createObjectURL(file));
        status.textContent = `Loaded ${file.name} into Photo ${input.dataset.photo}.`;
        redraw();
      } catch {
        status.textContent = `Could not read ${file.name}.`;
      }
    });
  });
  document.querySelectorAll('[data-sample]').forEach((select) => {
    select.addEventListener('change', async () => {
      if (!select.value) return;
      try {
        state.photos[select.dataset.sample] = await loadImage(`samples/${select.value}.jpg`);
        redraw();
      } catch {
        status.textContent = `Sample ${select.value} is missing.`;
      }
    });
  });

  // -- layout, size, grade, colour, place ----------------------------------
  const group = (attr, fn) => {
    document.querySelectorAll(`[data-${attr}]`).forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('on', b === button));
        fn(button.dataset[attr]);
        redraw();
      });
    });
  };
  group('layout', (v) => { state.layout = v; state.selected = 0; });
  group('size', (v) => { state.size = v; });
  group('grade', (v) => { state.grade = v; });
  group('color', (v) => { state.titleColor = v; });
  group('place', (v) => { state.titlePlace = v; });
  group('panel-photo', (v) => { selectedPanel().slot = v; });

  // -- caption text ----------------------------------------------------------
  document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  zoomInput.addEventListener('input', () => { selectedPanel().zoom = Number(zoomInput.value); redraw(); });

  // -- drag to pan, wheel to zoom --------------------------------------------
  let drag = null;
  const toCover = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const at = toCover(e);
    const hit = panelAt(panels(), at.x, at.y);
    if (hit < 0) return;
    state.selected = hit;
    const p = selectedPanel();
    drag = { x: at.x, y: at.y, ox: p.ox, oy: p.oy, panel: p };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const at = toCover(e);
    const ps = panels();
    const p = ps[state.selected];
    drag.panel.ox = drag.ox + (at.x - drag.x) / p.w;
    drag.panel.oy = drag.oy + (at.y - drag.y) / p.h;
    redraw();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = selectedPanel();
    p.zoom = Math.min(2.5, Math.max(1, p.zoom - Math.sign(e.deltaY) * 0.08));
    redraw();
  }, { passive: false });

  // -- export ------------------------------------------------------------------
  document.getElementById('export').addEventListener('click', () => {
    const [w, h] = SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    drawCover(off.getContext('2d'), w, h, state);
    off.toBlob((blob) => {
      if (!blob) { status.textContent = 'Export failed.'; return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-vice-${w}x${h}.png`;
      a.click();
      status.textContent = `Saved neon-vice-${w}x${h}.png (${Math.round(blob.size / 1024)} KiB).`;
    }, 'image/png');
  });

  return { state, redraw };
}
