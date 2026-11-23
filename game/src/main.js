// Costa Verde — boot and the one loop: read input, step the world, paint it.
// Screens: title -> play -> paused / game over. Missions start with M.
// ?seed=N fixes the city; ?shot=chase|drive|foot|mission stages a screenshot
// scene instead of the title screen and sets window.__shotReady when painted.

import * as THREE from 'three';
import { JOBS, ON_FOOT, makeRng } from './config.js';
import { ACT_CONFIRM, ACT_INTERACT, ACT_PAUSE, ACT_RELOAD, ACT_SHOOT, ACT_SIDEJOB, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createPlayer, createPedestrians } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot');
const shotName = shot && ['chase', 'drive', 'foot', 'mission'].includes(shot) ? shot : null;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 4, 30);

// The shared game state. Modules are built in dependency order — city first
// (it owns collision), then the actors, then the systems that watch them.
const G = {
  rng: makeRng(seed),
  scene,
  camera,
  time: 0,
  cash: 0,
  phase: 'title', // title | play | pause | over
  overKind: null,
  shotReady: false,
};

function buildWorld() {
  G.input = createInput(canvas);
  G.audio = createAudio();
  G.city = createCity(G);
  G.player = createPlayer(G);
  G.peds = createPedestrians(G);
  G.vehicles = createVehicles(G);
  G.police = createPolice(G);
  G.missions = createMissions(G);
  G.combat = createCombat(G);
  G.hud = createHud(G);
}
buildWorld();

function bindScreens() {
  document.getElementById('btn-start').addEventListener('click', () => {
    G.audio.unlock();
    startPlay();
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    G.phase = 'play';
    G.hud.showScreen(null);
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    restartRun();
  });
}
bindScreens();

// --- Save / load -----------------------------------------------------------
// Only cash and jobs completed are saved; the world itself is rebuilt fresh
// from the seed every time, so a save can never be inconsistent with it.
G.save = () => {
  try {
    localStorage.setItem('costa-verde-save', JSON.stringify({ cash: G.cash, done: G.missions.done }));
  } catch { /* private mode or no storage: the game still plays */ }
};
G.load = () => {
  try {
    const raw = localStorage.getItem('costa-verde-save');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') G.cash = data.cash;
    if (typeof data.done === 'number') {
      G.missions.done = Math.min(data.done, JOBS.length);
      G.missions.nextIndex = G.missions.done;
    }
  } catch { /* a corrupt save is ignored, not a crash */ }
};
G.load();
G.hud.setCash(G.cash);
G.hud.setMissions(G.missions.done, JOBS.length);

G.gameOver = (kind) => {
  if (G.phase === 'over') return;
  G.phase = 'over';
  G.overKind = kind;
  // The run is over: stop the engine and siren loops, and make sure a held
  // Space does not restart the run — only Enter (or the button) does.
  G.audio.stop();
  if (G.player.inCar) G.vehicles.exitCar();
  G.hud.setGameOver(kind, G.cash, G.missions.done);
  G.hud.showScreen('over');
};

function restartRun() {
  G.cash = 0;
  G.time = 0;
  G.player.reset();
  G.vehicles.reset();
  G.peds.reset();
  G.police.reset();
  G.missions.reset();
  G.combat.reset();
  G.hud.setCash(0);
  G.hud.setHealth(100);
  G.hud.setAmmo(G.combat.ammo, G.combat.spare);
  G.hud.setObjective('Talk to Mara — press M for the next job.');
  G.hud.setMissions(0, JOBS.length);
  G.hud.setWanted(0);
  G.hud.setBustedProgress(0);
  G.phase = 'play';
  G.hud.showScreen(null);
}

function startPlay() {
  G.phase = 'play';
  G.hud.showScreen(null);
  G.hud.setObjective('Talk to Mara — press M for the next job.');
  G.hud.showMissionCard('Costa Verde', 'You are Alex Vega. Mara has work for you — press M to take the first job.');
}

// --- Screenshot staging ----------------------------------------------------
// ?shot=... builds a fixed scene from the live game: chase shows a police
// pursuit with 3 stars and an active job; drive shows Alex driving; foot
// shows Alex on foot with a wanted level; mission shows the courier run.
function stageScene(name) {
  G.phase = 'play';
  G.hud.showScreen(null);
  if (name === 'chase') {
    G.missions.beginJob();
    const car = G.vehicles.parked[0] || G.vehicles.traffic[0];
    G.player.pos.set(car.pos.x + 2, 0, car.pos.z + 2);
    G.vehicles.enterCar(car);
    // A clear stretch of avenue, well north of the garage, so the car does
    // not drive straight into it before the frame is taken.
    car.pos.set(0, 0, 120);
    car.heading = Math.PI;
    car.speed = 25;
    G.police.addHeat(3, 'screenshot');
    G.police.update(0); // spawn the units now, so they can be placed
    G.police.list.forEach((c, i) => {
      // Behind the car and offset to either side, so both units read as a
      // chase instead of piling onto the player's bumper.
      c.pos.set(i === 0 ? 8 : -8, 0, 140);
      c.heading = Math.PI;
      c.speed = 20;
    });
    G.player.cameraYaw = Math.PI;
  } else if (name === 'drive') {
    const car = G.vehicles.parked[0] || G.vehicles.traffic[0];
    G.player.pos.set(car.pos.x + 2, 0, car.pos.z + 2);
    G.vehicles.enterCar(car);
    car.pos.set(-40, 0, -70);
    car.heading = Math.PI / 2;
    car.speed = 26;
    G.player.cameraYaw = Math.PI / 2;
    G.hud.setObjective('Free roam — explore Costa Verde, steal a car, take a job.');
  } else if (name === 'foot') {
    // On the avenue north of the garage, so the camera does not end up
    // pressed against the garage wall.
    G.player.pos.set(0, 0, 90);
    G.player.heading = 0;
    G.player.cameraYaw = Math.PI;
    G.police.addHeat(1, 'screenshot');
    G.hud.setObjective('On foot — find a car, or press M for a job.');
  } else if (name === 'mission') {
    G.missions.beginJob();
    const job = G.missions.active;
    if (job && job.id === 'hot-wheels') {
      const car = G.vehicles.parked[0] || G.vehicles.traffic[0];
      G.player.pos.set(car.pos.x + 2, 0, car.pos.z + 2);
      G.vehicles.enterCar(car);
      car.pos.set(0, 0, 60);
      car.heading = 0;
      car.speed = 20;
      // The camera rides north of the car looking south, down the open
      // avenue — the garage stays behind the camera, out of the frame.
      G.player.cameraYaw = Math.PI;
    }
  }
}

// --- Input -----------------------------------------------------------------
function handleActions(actions) {
  if (G.phase === 'title') {
    if (actions & ACT_CONFIRM) startPlay();
    return;
  }
  if (G.phase === 'over') {
    if (actions & ACT_CONFIRM) restartRun();
    return;
  }
  if (actions & ACT_PAUSE) {
    if (G.phase === 'play') {
      G.phase = 'pause';
      G.hud.showScreen('pause');
    } else if (G.phase === 'pause') {
      G.phase = 'play';
      G.hud.showScreen(null);
    }
    return;
  }
  if (G.phase !== 'play') return;
  if (actions & ACT_INTERACT) {
    if (G.player.inCar) {
      G.vehicles.exitCar();
    } else {
      const car = G.vehicles.nearestStealable();
      if (car) {
        G.vehicles.enterCar(car);
        if (!G.missions.active) G.police.addHeat(1, 'Car stolen');
      } else if (G.missions.sideJob) {
        // E near a courier beacon also works, but driving through it does.
      } else if (!G.missions.active) {
        G.missions.beginJob();
      }
    }
  }
  if (actions & ACT_SHOOT) G.combat.fire();
  if (actions & ACT_RELOAD) G.combat.startReload();
  if (actions & ACT_SIDEJOB) {
    if (!G.missions.active && !G.missions.sideJob) G.missions.startSideJob();
  }
}

// --- The loop --------------------------------------------------------------
let last = performance.now();
let painted = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const actions = G.input.takeActions();
  handleActions(actions);

  if (G.phase === 'play') {
    G.time += dt;
    G.player.update(dt);
    G.vehicles.update(dt);
    G.police.update(dt);
    G.peds.update(dt);
    G.missions.update(dt);
    G.combat.update(dt);
    G.hud.update(dt);
    G.audio.update(
      G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) : 0,
      G.police.wanted,
    );
    G.player.updateCamera(dt);
    G.hud.setHealth(G.player.health);
    G.hud.setAmmo(G.combat.ammo, G.combat.spare, G.combat.reloading);
    G.hud.setSpeed(
      G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) * 3.6 : 0,
      G.player.inCar,
    );
    G.hud.setClock(G.time);
    G.hud.drawMinimap();
    // A courier run starts itself while free-roaming, so the city always
    // has something to do between story jobs.
    if (!G.missions.active && !G.missions.sideJob && G.missions.done > 0 && G.missions.nextIndex >= JOBS.length) {
      G.missions.startSideJob();
    }
    if (G.missions.active) {
      const job = G.missions.active;
      if (job.timer > 0) {
        G.hud.setObjective(`${job.title}: ${Math.ceil(job.timer)}s left`);
      }
    }
  } else if (G.phase === 'title') {
    // The title screen orbits the city slowly, so the menu is alive.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 120, 45, Math.cos(t * 0.05) * 120);
    camera.lookAt(0, 0, 0);
    G.hud.drawMinimap();
  } else if (G.phase === 'pause' || G.phase === 'over') {
    G.hud.drawMinimap();
  }

  renderer.render(scene, camera);
  painted += 1;
  if (shotName && painted >= 3 && !G.shotReady) {
    G.shotReady = true;
    window.__shotReady = true;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (shotName) {
  stageScene(shotName);
} else {
  G.hud.showScreen('title');
}

// Debug and test handle, plus a few aliases the play-test probes use.
Object.defineProperty(G, 'state', {
  get() { return G.phase; },
  set(v) { G.phase = v; },
});
Object.defineProperty(G, 'playTime', { get() { return G.time; } });
window.__G = G;
window.__game = G;
requestAnimationFrame(frame);
