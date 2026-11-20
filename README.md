# Costa Verde — a make.fun gta6-01 entry

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/reward.svg)](https://make.fun/c/gta6-01)

A complete open-world crime game that runs fully offline in a desktop
browser. It borrows nothing from any commercial game — no names, no
characters, no maps, no assets. The city is its own: **Costa Verde**, a
fictional coastal town in the sun.

## Premise

Alex Vega returns to Costa Verde broke, with a single contact left: Mara.
To get back on his feet he steals cars, runs her jobs, stays ahead of the
police, and works toward one big score.

## Running it

Any static server will do. The one in the repo is the quickest way:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no packages to install for the game itself, no network
requests once the page loads. Three.js is vendored at
`game/vendor/three.module.min.js`.

## Controls

| Keys | What they do |
| --- | --- |
| WASD / arrows | Move on foot, or drive when in a car |
| Shift | Run |
| E | Get in / out of a car (taking one raises the wanted level) |
| Mouse click | Fire the pistol |
| R | Reload |
| Mouse drag / wheel | Orbit the camera / zoom |
| Space | Handbrake |
| M | Start the next story job (or a courier side job once the story is done) |
| N | Start a courier side job |
| P / Esc | Pause |

## What the game has

- **A living 3D city.** A 9×9 street grid with procedural buildings (lit
  windows, shop awnings), palm trees, streetlights, a beach and a marina.
  Everything is generated from a seed, so `?seed=N` rebuilds the same city.
- **On foot and behind the wheel.** A third-person character with arcade
  driving, traffic that follows the street grid, and parked cars waiting to
  be stolen.
- **A wanted level, 0–5 stars.** Stealing, hitting pedestrians and ramming
  police cars raise the heat. Police cars chase and ram; stay out of sight
  and the heat cools off. Get wasted or busted and the run ends.
- **Five story jobs from Mara.** Steal and deliver a car; a timed courier
  rush; reach 3 stars and then lose the heat; a pickup under pursuit; and
  the big score — rob the Sunrise Mart and escape a 4-star chase. Courier
  side jobs keep paying in free roam.
- **Combat.** A hitscan pistol with a muzzle flash, a magazine and a reload;
  pedestrians flee from gunfire and the police notice.
- **A full HUD.** Minimap with the player arrow, police dots and the mission
  beacon; wanted stars; cash; health; speed; an objective line; a clock.
- **Synthesized sound.** Engine hum, a police siren, gunshots, crashes and
  pickup blips, all made with WebAudio. No audio files.
- **A save.** Cash and completed jobs persist in localStorage.

## Screenshots

The four staged frames in `screenshots/` are real renders of the game,
staged with `?shot=chase|drive|mission|foot&seed=N`, which plays the game
forward into the frame instead of posing a diorama.

## Layout

- `game/index.html` — page, HUD markup, screens, import map
- `game/src/main.js` — boot, the loop, screens, save, screenshot staging
- `game/src/config.js` — tuning numbers, city layout, job data, the RNG
- `game/src/city.js` — streets, buildings, palms, lamps, named places
- `game/src/player.js` — Alex on foot, the camera, pedestrians
- `game/src/vehicles.js` — the car factory, traffic, stealing, driving
- `game/src/police.js` — the wanted level, pursuit, busted / wasted
- `game/src/missions.js` — the five story jobs and courier side jobs
- `game/src/combat.js` — the pistol, hitscan, ammo
- `game/src/hud.js` — HUD, minimap, banners, screens
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/textures.js` — canvas-painted textures
- `main.ts` — the entry program: copies the game and screenshots, writes the dossier
- `serve.ts` — a tiny static server for local play

## License

MIT — see `LICENSE`.
