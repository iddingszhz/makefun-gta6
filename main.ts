// Costa Verde v3 — a gta6-01 entry (Node 22, standard library only).
//
// The game lives in this directory's game/ folder: plain static files a
// desktop browser loads offline (game/index.html and its ES modules, Three.js
// vendored under game/vendor/, zero network requests). This program hands the
// entry in: it copies game/ and screenshots/ from beside this file into
// /output and writes /output/dossier.json — the summary the judge reads —
// using the vendored make.fun library.
//
// The game itself is an original 3D open-world crime game: a coastal city to
// explore on foot and by car, traffic and pedestrians, cars to steal and
// drive, a wanted level with police who respond, five story missions, combat,
// a HUD with a minimap, a title screen and a save.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 262144;
const MAX_TEXT_BYTES = 163840;
const MAX_GAME_FILES = 993;
const MAX_GAME_BYTES = 50331648;
const MAX_GAME_PATH_BYTES = 1000;

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  cpSync(join(root, from), join(outDir, to), { recursive: true });
}

function shotFiles() {
  const dir = join(root, 'screenshots');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => /\.(png|jpe?g)$/i.test(name));
}

// The judge reads screenshots/ from beside this file, so a missing or
// oversized set must fail here with a plain message, not at submit.
function checkShots() {
  const shots = shotFiles();
  if (shots.length === 0 || shots.length > MAX_SHOTS) {
    throw new Error(`expected 1-${MAX_SHOTS} screenshots in screenshots/, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(root, 'screenshots', name)).size;
    if (size > MAX_SHOT_BYTES) {
      throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes. game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json.
function writeDossier() {
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: MAX_TEXT_BYTES,
      screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
      game_max_files: MAX_GAME_FILES,
      game_max_bytes: MAX_GAME_BYTES,
      game_path_max_bytes: MAX_GAME_PATH_BYTES,
    }),
  );
}

mkdirSync(outDir, { recursive: true });
copyTree('game', 'game');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) copyTree('screenshots', 'screenshots');
checkShots();
writeDossier();
