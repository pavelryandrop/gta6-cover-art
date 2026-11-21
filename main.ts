// Neon Vice Cover Studio: the program that hands this entry in.
//
// It runs on Node 22 with the standard library only, in a container with no
// network, a read-only repository and a writable /output. It copies the app
// (app/, plain static files a desktop browser loads offline) and the screenshots
// (screenshots/, 3 or 4 renders of the app) into /output, then writes
// /output/dossier.json with make.fun's vendored library, the summary the judge
// reads. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the app locally first with `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** The directory this file lives in: the repository root. */
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
/** Where the entry goes: the grader's /output, or MAKEFUN_OUTPUT_DIR elsewhere. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function copyTree(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
}

ensureDir(outputDir);
copyTree(join(repoRoot, 'app'), join(outputDir, 'app'));
ensureDir(join(outputDir, 'screenshots'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
}

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes; the
// other caps refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in app/ or 48 MiB of app files in all,
// or a path under app/ over 1000 bytes; app/ counts beside /output's own
// 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
