// Costa Verde — the gta6-01 entry point (Node 22, standard library only).
//
// The game itself is plain static files in this directory's game/ folder: a
// desktop browser opens game/index.html offline (its ES modules and the
// vendored Three.js under game/vendor/, zero network requests). This program
// hands the entry in: it copies game/ and screenshots/ from beside this file
// into /output and writes /output/dossier.json — the summary the judge reads
// — using the vendored make.fun library.
//
// The game is an original 3D open-world crime game: a coastal city to explore
// on foot and by car, traffic and pedestrians, cars to steal and drive, a
// wanted level with police who respond, five story missions, combat, a HUD
// with a minimap, a title screen and a save.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes.
const LIMITS = {
  textBytes: 163840,
  shots: 4,
  shotBytes: 262144,
  gameFiles: 993,
  gameBytes: 50331648,
  gamePathBytes: 1000,
};

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function listShots() {
  const dir = join(root, 'screenshots');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => /\.(png|jpe?g)$/i.test(name));
}

// The judge reads screenshots/ from beside this file, so a missing or
// oversized set must fail here with a plain message, not at submit.
function assertShots() {
  const shots = listShots();
  if (shots.length === 0 || shots.length > LIMITS.shots) {
    throw new Error(`expected 1-${LIMITS.shots} screenshots in screenshots/, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(root, 'screenshots', name)).size;
    if (size > LIMITS.shotBytes) {
      throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
}

function emitDossier() {
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: LIMITS.textBytes,
      screenshots: { max: LIMITS.shots, max_bytes: LIMITS.shotBytes },
      game_max_files: LIMITS.gameFiles,
      game_max_bytes: LIMITS.gameBytes,
      game_path_max_bytes: LIMITS.gamePathBytes,
    }),
  );
}

function main() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(root, 'screenshots'))) {
    cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  }
  assertShots();
  emitDossier();
}

main();
