# Costa Verde — a make.fun gta6-01 entry

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/iddingszhz/makefun-gta6/reward.svg)](https://make.fun/c/gta6-01)

Costa Verde is a full open-world crime game that plays entirely offline in a
desktop browser. Nothing in it comes from a commercial game: the city, the
people, the cars, the story and the art are all original. The setting is
**Costa Verde**, a fictional town on a sunny coast.

You play Alex Vega, back in town with no money and one person still willing
to take his calls: Mara. He steals cars, takes her jobs, keeps the police
off his back, and builds toward a single big score.

## How to play

Any static file server works. The one included in this repo is the fastest
way in:

```sh
node serve.ts
# then open http://localhost:8080
```

There is no build step and nothing to install to run the game, and once the
page has loaded it makes no network requests at all. Three.js is vendored at
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
| M | Start the next story job |
| N | Start a courier side job |
| P / Esc | Pause |

## Inside the game

- **A city that feels alive.** Nine avenues by nine, with buildings that
  grow lit windows and striped awnings, palms and lamps along the streets,
  and a beach and marina at the edges. It is all generated from a seed, so
  `?seed=N` rebuilds the same city every time.
- **Feet and wheels.** A third-person character on foot and arcade driving
  behind the wheel, with traffic that follows the street grid and parked
  cars waiting to be taken.
- **Heat, 0–5 stars.** Stealing a car, knocking a pedestrian down or
  ramming a police car raises the wanted level. Police cars chase and ram;
  break line of sight and the heat cools off. Get wasted or busted and the
  run is over.
- **Five jobs from Mara.** Deliver a stolen car to the garage; a timed
  courier rush across three checkpoints; reach 3 stars and then shake the
  heat off; a pickup under pursuit; and the big score — rob the Sunrise
  Mart and escape a 4-star chase. Courier side jobs keep paying between
  story jobs.
- **Combat.** A hitscan pistol with a visible tracer, a magazine and a
  reload. Pedestrians run from gunfire, and the police take notice.
- **The HUD.** A minimap with the player arrow, police dots and the mission
  beacon; wanted stars; cash; health; speed; an objective line; a clock.
- **Sound, synthesized.** An engine hum, a police siren, gunshots, crashes
  and pickup blips, all made with WebAudio. There are no audio files.
- **A save.** Cash and completed jobs persist in localStorage.

## Screenshots

The four staged frames in `screenshots/` are real renders of the game,
produced with `?shot=chase|drive|mission|foot&seed=N`, which plays the game
forward into the frame rather than posing a diorama.

## File layout

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
