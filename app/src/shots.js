// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo
// loaded; ?shot=cover shows the cover alone. `photo` picks the sample, `caption`
// the title, `layout`/`size`/`grade` the rest. window.__shotReady is set once painted.
import { SIZES, drawCover } from './cover.js';
import { freshState, loadImage, applyShotQuery } from './editor.js';

export async function runShot(shot, query) {
  const state = freshState();
  const photo = applyShotQuery(state, query);
  const photo2 = query.get('photo2') ?? (photo === 'boulevard-walk' ? 'sunset-driver' : 'boulevard-walk');
  try {
    state.photos.A = await loadImage(`samples/${photo}.jpg`);
    state.photos.B = await loadImage(`samples/${photo2}.jpg`);
    state.photos.C = await loadImage('samples/pier.jpg');
  } catch { /* a missing sample leaves its slot empty; the cover still draws */ }
  const canvas = document.getElementById('preview');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const [w, h] = SIZES[state.size];
    canvas.width = w;
    canvas.height = h;
    drawCover(canvas.getContext('2d'), w, h, state);
  } else {
    const [w, h] = SIZES[state.size];
    const scale = 960 / w;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state);
    document.getElementById('title').value = state.title;
    document.getElementById('subtitle').value = state.subtitle;
    document.getElementById('status').textContent = 'Sample photo loaded — drag it, then export.';
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
