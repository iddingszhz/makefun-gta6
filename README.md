# Costa Verde

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game that runs entirely offline in a desktop
browser. No Rockstar names, characters, maps or assets — this is a city of
its own: **Costa Verde**, a sun-soaked fictional coastal city.

## The story

Alex Vega is back in Costa Verde with empty pockets and one contact: Mara.
Steal cars, run her jobs, dodge the police — and pull off the big score.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and play with keyboard and mouse:

- **WASD** — move on foot / drive
- **Shift** — run
- **E** — enter / exit a car (stealing one raises your wanted level)
- **Click** — shoot the pistol, **R** — reload
- **Drag mouse** — orbit the camera, **wheel** — zoom
- **Space** — handbrake
- **M** — next story job (or a courier side job when the story is done)
- **P / Esc** — pause

## What's in the game

- **A 3D city**: 9×9 street grid, procedural buildings with lit windows,
  palms, streetlights, a beach and a marina — all generated from a seed.
- **On foot and by car**: third-person character, arcade driving, traffic
  that drives the streets, parked cars to steal.
- **Wanted 0–5 stars**: stealing, hitting pedestrians and ramming police
  raise the heat; police cars chase and ram; stay out of sight and it cools.
  Get wasted or busted and the run ends.
- **Five story missions**: steal and deliver a car, a timed courier rush,
  reach 3 stars then lose the heat, a pickup under pursuit, and the big
  score — rob the Sunrise Mart and escape a 4-star chase. Plus repeatable
  courier side jobs for cash in free roam.
- **Combat**: hitscan pistol with muzzle flash, ammo and reload;
  pedestrians flee, police notice.
- **HUD**: minimap with player arrow, police dots and mission beacon,
  wanted stars, cash, health, speed, objective line, clock.
- **Sound**: fully synthesized WebAudio — engine hum, police siren,
  gunshots, crashes, pickup blips. No audio files.
- **Save**: cash and jobs completed persist in localStorage.

## Tech

Three.js (vendored as `game/vendor/three.module.min.js`), plain ES modules,
no build step, zero network requests. Screenshots are staged with
`?shot=chase|drive|mission|foot&seed=N`, which plays the real game forward
into the frame.

## Files

| File | Job |
| --- | --- |
| `game/src/main.js` | Boot, loop, screens, save, screenshot scenes |
| `game/src/config.js` | Tuning numbers, city layout, mission data |
| `game/src/city.js` | The city: streets, buildings, palms, places |
| `game/src/player.js` | Alex on foot, camera, pedestrians |
| `game/src/vehicles.js` | Cars, traffic AI, stealing, driving |
| `game/src/police.js` | Wanted level, pursuit, busted / wasted |
| `game/src/missions.js` | Five story jobs + courier side jobs |
| `game/src/combat.js` | Pistol, hitscan, ammo |
| `game/src/hud.js` | HUD, minimap, banners, screens |
| `game/src/audio.js` | Synthesized WebAudio sounds |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/textures.js` | Canvas-generated textures |

## License

MIT — see `LICENSE`.
