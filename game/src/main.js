// Costa Verde — boot and the one loop: read input, step the world, paint it.
// Screens: title -> play -> paused / game over. Missions start with M.
// ?seed=N fixes the city; ?shot=chase|drive|foot|mission stages a screenshot
// scene instead of the title screen and sets window.__shotReady when painted.
import * as THREE from 'three';
import { CAR, MISSION_DEFS, PLAYER, createRng } from './config.js';
import { createInput, ACT_CONFIRM, ACT_INTERACT, ACT_PAUSE, ACT_RELOAD, ACT_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createPlayer, createPedestrians } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';

const SAVE_KEY = 'costa-verde.save';
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8e8);
scene.fog = new THREE.Fog(0xa8c6de, 220, 620);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, 34);

const sun = new THREE.DirectionalLight(0xfff1cf, 2.6);
sun.position.set(120, 180, 60);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd8f0, 0x9c8a6a, 0.9));

// --- The shared game context every module reads and writes -----------------
const G = {
  scene,
  camera,
  renderer,
  rng: createRng(seed),
  state: 'title',
  time: 0,
  playTime: 0,
  input: null,
  audio: null,
  city: null,
  player: null,
  peds: null,
  vehicles: null,
  police: null,
  combat: null,
  missions: null,
  hud: null,
  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: G.player.cash,
        missionsIndex: G.missions.nextIndex,
        missionsCompleted: G.missions.completed,
      }));
    } catch { /* private mode: the game still plays, it just does not save */ }
  },
  loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  gameOver(kind) {
    if (G.state === 'over') return;
    G.state = 'over';
    G.audio.busted();
    G.save();
    G.hud.setGameOver(kind, G.player.cash, G.missions.completed);
    G.hud.showScreen('over');
  },
};

G.input = createInput(canvas);
G.audio = createAudio();
G.city = createCity(scene, G.rng);
G.player = createPlayer(G);
G.peds = createPedestrians(G);
G.vehicles = createVehicles(G);
G.police = createPolice(G);
G.combat = createCombat(G);
G.missions = createMissions(G);
G.hud = createHud(G);

G.player.cash = 0;
const saved = G.loadSave();
if (saved) {
  G.player.cash = saved.cash || 0;
  G.missions.loadProgress(saved.missionsIndex || 0, saved.missionsCompleted || 0);
}
G.hud.setCash(G.player.cash);
G.hud.setWanted(0);
G.hud.setHealth(PLAYER.maxHealth);
G.hud.setAmmo(12, 60);

// --- Interactions ----------------------------------------------------------
function tryInteract() {
  if (G.state !== 'play' || G.player.dead) return;
  if (G.player.inCar) {
    G.vehicles.exitCar();
    return;
  }
  const car = G.vehicles.nearestStealable(G.player.pos.x, G.player.pos.z);
  if (car) {
    const firstTheft = !car.stolenByPlayer;
    G.vehicles.steal(car);
    if (firstTheft) G.police.commitCrime(1, 'You stole a car!');
  }
}

function startGame() {
  G.audio.unlock();
  G.state = 'play';
  G.hud.showScreen(null);
  G.hud.setObjective('Welcome to Costa Verde — press M for your first job.');
}

function restartGame() {
  G.player.reset();
  G.vehicles.reset();
  G.peds.reset();
  G.police.reset();
  G.combat.reset();
  G.missions.reset();
  G.player.cash = 0;
  G.playTime = 0;
  G.hud.setCash(0);
  G.hud.setHealth(PLAYER.maxHealth);
  G.hud.setObjective('Welcome to Costa Verde — press M for your first job.');
  G.state = 'play';
  G.hud.showScreen(null);
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  G.state = 'play';
  G.hud.showScreen(null);
});
document.getElementById('btn-restart').addEventListener('click', restartGame);
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && G.state === 'play') {
    if (G.missions.active) {
      G.hud.flash('Finish the current job first — or lose it by getting busted.');
    } else if (G.missions.nextIndex < MISSION_DEFS.length) {
      G.missions.startNext();
    } else {
      G.missions.startSideJob();
    }
  }
  if (event.code === 'KeyN' && G.state === 'play') G.missions.startSideJob();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'play') {
    G.state = 'pause';
    G.hud.showScreen('pause');
  }
});

// --- Screenshot scenes -----------------------------------------------------
// Each scene builds a real game state (real car, real police, real mission)
// and lets the loop run it, so the frame is the game itself, not a diorama.
function stageShot(name) {
  G.state = 'play';
  G.hud.showScreen(null);
  if (name === 'chase') {
    // In a car, mid-chase: 3 stars, two police cars on the tail, mission beacon ahead.
    const car = G.vehicles.parked[0];
    G.player.pos.set(car.pos.x, 0, car.pos.z);
    G.vehicles.steal(car);
    car.pos.set(-140, 0, 0);
    car.heading = Math.PI / 2;
    car.speed = 24;
    G.police.setStars(3);
    G.missions.startNext(); // Hot Wheels: steal done, deliver to the garage
    G.hud.setObjective('Hot Wheels: Deliver the car to Mara\'s Garage');
    G.player.cameraYaw = Math.PI / 2 + Math.PI;
  } else if (name === 'drive') {
    const car = G.vehicles.parked[1];
    G.player.pos.set(car.pos.x, 0, car.pos.z);
    G.vehicles.steal(car);
    // Start far from the garage (the mission target), or the job would
    // complete itself during staging.
    car.pos.set(-70, 0, -210);
    car.heading = Math.PI / 2;
    car.speed = 18;
    G.missions.startNext();
    G.player.cameraYaw = Math.PI / 2 + Math.PI;
  } else if (name === 'mission') {
    // On foot at the Sunrise Mart, robbing the big score with 4 stars closing in.
    G.missions.loadProgress(4, 4); // jump to the final job for the frame
    G.player.pos.set(64, 0, -140);
    G.player.heading = Math.PI / 2;
    G.police.setStars(4);
    G.missions.startNext(); // The Big Score: beacon on the store, ahead of the player
    G.player.cameraYaw = Math.PI / 2 + Math.PI;
  } else {
    // 'foot': on foot in a busy plaza, pedestrians and traffic around.
    G.player.pos.set(0, 0, 20);
    G.player.heading = Math.PI;
    G.missions.startNext();
    G.player.cameraYaw = Math.PI;
  }
  // Let the world settle for a couple of seconds of simulation before the shot.
  for (let i = 0; i < 120; i += 1) stepWorld(1 / 60);
  // Frame the shot: the staging loop bleeds speed off, so set a cruising
  // speed here, and put the police where the camera can see them.
  if (name === 'chase' || name === 'drive') {
    const car = G.player.car;
    if (car) car.speed = name === 'chase' ? 22 : 20;
  }
  if (name === 'chase') {
    const car = G.player.car;
    const cops = G.police.list;
    // A rear three-quarter camera: the player's car, the road ahead, and the
    // tail car behind it all read in one frame.
    G.player.cameraYaw = Math.PI / 2 + Math.PI + 0.55;
    if (car && cops[0]) {
      // One police car head-on far ahead, so the chase reads in the frame;
      // the rest stay on the player's tail and show on the minimap.
      cops[0].pos.set(car.pos.x + 62, 0, car.pos.z + 3);
      cops[0].heading = -Math.PI / 2;
      cops[0].speed = 20;
    }
    if (car && cops[1]) {
      cops[1].pos.set(car.pos.x - 30, 0, car.pos.z - 3);
      cops[1].heading = Math.PI / 2;
      cops[1].speed = 22;
    }
  }
}

// --- The loop --------------------------------------------------------------
let last = performance.now();
let shotReadyTimer = 0;

function stepWorld(dt) {
  G.time += dt;
  G.playTime += dt;
  G.player.update(dt);
  G.vehicles.update(dt);
  G.peds.update(dt);
  G.police.update(dt);
  G.combat.update(dt);
  G.missions.update(dt);
  G.player.updateCamera(dt);
  G.audio.update(G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) : 0, G.police.stars);
  G.hud.update(dt);
  G.hud.setHealth(G.player.health);
  G.hud.setSpeed(G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) * 3.6 : 0, G.player.inCar);
  G.hud.setClock(G.playTime);
  G.hud.drawMinimap();
  const kick = G.hud.takeKick();
  if (kick) {
    camera.position.x += (Math.random() - 0.5) * kick * 40;
    camera.position.y += (Math.random() - 0.5) * kick * 40;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'play') {
    const actions = G.input.takeActions();
    if (actions & ACT_INTERACT) tryInteract();
    if (actions & ACT_SHOOT) G.combat.shoot();
    if (actions & ACT_RELOAD) G.combat.reload();
    if (actions & ACT_PAUSE) {
      G.state = 'pause';
      G.hud.showScreen('pause');
    }
    if (actions & ACT_CONFIRM && G.player.dead) restartGame();
    stepWorld(dt);
  } else if (G.state === 'title') {
    // Slow orbit around the city centre behind the title screen.
    G.time += dt;
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 180, 70, Math.cos(a) * 180);
    camera.lookAt(0, 0, 0);
    G.city.beacon.rotation.y += dt;
  } else if (G.state === 'over') {
    const actions = G.input.takeActions();
    if (actions & ACT_CONFIRM) restartGame();
  }
  // The beacon ring pulses even when paused.
  G.city.beacon.children[1].scale.setScalar(1 + Math.sin(G.time * 4) * 0.12);
  renderer.render(scene, camera);
  if (shot) {
    shotReadyTimer += dt;
    if (shotReadyTimer > 0.5) window.__shotReady = true;
  }
}

if (shot) {
  stageShot(shot);
} else {
  G.hud.showScreen('title');
}
// Exposed only so automated play-tests can read the live state; the game
// never reads it back.
window.__game = G;
requestAnimationFrame(frame);
