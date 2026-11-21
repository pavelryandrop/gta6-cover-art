// Neon Vice entry point: a `?shot=` query sets up a fixed scene for a screenshot,
// otherwise the editor starts with the three sample photos loaded.
import { freshState, loadDefaultSamples, startEditor } from './editor.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const query = new URLSearchParams(location.search);
const shot = query.get('shot');

if (shot) {
  runShot(shot, query);
} else {
  const state = freshState();
  const { redraw } = startEditor(canvas, state);
  redraw();
  loadDefaultSamples(state, redraw);
}
