# Neon Vice — Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badge/gta6-cover-art-01/pavelryandrop/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badge/gta6-cover-art-01/pavelryandrop/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn your photos into a sunset-boulevard poster in the style of GTA 6's cover art — a multi-panel poster with bold caption lettering and a Vice City sunset or neon colour grade — and export it as a PNG to share.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Everything runs offline in desktop Chrome: open `app/index.html` from any static server. No uploads, no network requests — photos are read on your own machine.

## How it works

1. **Photos** — load up to three of your own photos (or pick a sample). Each panel of the cover uses one of them.
2. **Layout & size** — Poster (3 panels), Duo (2 panels) or Hero (one full-bleed photo); export at 1080 × 1080, 1080 × 1350 or 1920 × 1080.
3. **Selected panel** — click a panel in the preview to select it, drag its photo to reposition it, scroll or use the slider to zoom, and pick which photo fills it.
4. **Caption** — write the title and subtitle, pick a title colour and put the title at the top or bottom.
5. **Export PNG** — one click saves the cover at full export size.

The cover is drawn on a canvas in `app/src/cover.js`: a striped sunset disc and palm silhouettes drawn from scratch, the photo panels with a sunset / neon / clean grade, and heavy condensed lettering with an outline, gradient fill and drop shadow. Nothing in it copies Rockstar Games — no logo, artwork or font — the whole design is original.

## Files

- `app/index.html` — the editor page
- `app/style.css` — the editor's dark neon styling
- `app/src/cover.js` — the cover renderer (sky, sun, palms, panels, caption, grain)
- `app/src/editor.js` — state, controls, drag-to-pan, zoom, export
- `app/src/shots.js` — fixed `?shot=` scenes for screenshots
- `app/src/main.js` — entry point
- `app/samples/` — sample photos (two made with an image model, two from the kit, free to use)
- `main.ts` — hands the entry in: copies `app/` and `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — tiny static server for trying the app locally

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

An original design, not affiliated with Rockstar Games. MIT licensed — see [LICENSE](LICENSE).
