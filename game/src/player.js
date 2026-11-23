// Costa Verde — Alex Vega on foot, and the pedestrians who share the
// sidewalks. People are simple articulated box figures; pedestrians are the
// same figure in different colours, strolling the sidewalks and running from
// trouble.

import * as THREE from 'three';
import { AVENUES, BLOCK_CENTRES, ON_FOOT, between, pickOne, wrapAngle } from './config.js';

const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6e4530];
const SHIRTS = [0xd94f3d, 0x2e7f9e, 0xe8a13a, 0x4f9e57, 0x8a5a9e, 0xe8e0d0, 0x3a3f46];
const TROUSERS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x4a5a6a];

// A person assembled from a parts table: [size, offset, material]. The limbs
// swing while walking, driven by a phase that advances with speed.
export function buildPerson(rng, shirt, pants) {
  const figure = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: pickOne(rng, SKINS) });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x1e1a16 });
  const parts = [
    { size: [0.34, 0.34, 0.32], at: [0, 1.62, 0], mat: skinMat, name: 'head' },
    { size: [0.36, 0.12, 0.34], at: [0, 1.8, 0], mat: hairMat, name: 'hair' },
    { size: [0.62, 0.62, 0.34], at: [0, 1.11, 0], mat: shirtMat, name: 'torso' },
    { size: [0.16, 0.62, 0.18], at: [-0.4, 1.12, 0], mat: shirtMat, name: 'armL' },
    { size: [0.16, 0.62, 0.18], at: [0.4, 1.12, 0], mat: shirtMat, name: 'armR' },
    { size: [0.22, 0.8, 0.24], at: [-0.14, 0.4, 0], mat: pantsMat, name: 'legL' },
    { size: [0.22, 0.8, 0.24], at: [0.14, 0.4, 0], mat: pantsMat, name: 'legR' },
  ];
  const named = {};
  for (const part of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...part.size), part.mat);
    mesh.position.set(...part.at);
    figure.add(mesh);
    named[part.name] = mesh;
  }
  figure.userData = { ...named, phase: rng() * Math.PI * 2 };
  return figure;
}

function swingLimbs(figure, speed, dt) {
  const parts = figure.userData;
  parts.phase += dt * (1.5 + speed * 0.9);
  const amp = Math.min(0.65, 0.12 + speed * 0.06);
  const swing = amp * Math.sin(parts.phase);
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.75;
  parts.armR.rotation.x = swing * 0.75;
}

export function createPlayer(G) {
  const rng = G.rng;
  const mesh = buildPerson(rng, 0x2e7f9e, 0x2a3550);
  mesh.position.set(0, 0, 20);
  G.scene.add(mesh);

  const player = {
    mesh,
    pos: mesh.position,
    heading: 0,
    speed: 0,
    health: ON_FOOT.hp,
    inCar: false,
    car: null,
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    cameraDist: ON_FOOT.camDist,
    dead: false,
    get cash() { return G.cash; },
    set cash(v) { G.cash = v; },
    update(dt) {
      const input = G.input;
      // Drag orbits the camera around the player; the wheel zooms.
      const orbit = input.takeOrbit();
      player.cameraYaw -= orbit.dx * 0.005;
      player.cameraPitch = Math.max(0.08, Math.min(1.1, player.cameraPitch + orbit.dy * 0.004));
      player.cameraDist = Math.max(5, Math.min(20, player.cameraDist + input.takeWheel() * 0.01));

      if (player.inCar && player.car) {
        // While driving, Alex rides with the car: keep his position on the
        // car, so missions, the minimap and combat all see where he is.
        player.pos.set(player.car.pos.x, 0, player.car.pos.z);
      }
      if (player.inCar || player.dead) return;
      const cruise = input.run() ? ON_FOOT.run : ON_FOOT.walk;
      // Movement is camera-relative: W walks away from the camera.
      const fwd = new THREE.Vector3(-Math.sin(player.cameraYaw), 0, -Math.cos(player.cameraYaw));
      const right = new THREE.Vector3(Math.cos(player.cameraYaw), 0, -Math.sin(player.cameraYaw));
      const wish = new THREE.Vector3();
      if (input.forward()) wish.add(fwd);
      if (input.back()) wish.sub(fwd);
      if (input.left()) wish.sub(right);
      if (input.right()) wish.add(right);
      if (wish.lengthSq() > 0.01) {
        wish.normalize();
        player.speed += (cruise - player.speed) * Math.min(1, dt * 8);
        const trial = player.pos.clone().addScaledVector(wish, player.speed * dt);
        trial.y = 0;
        G.city.resolveCircle(trial, ON_FOOT.radius);
        player.pos.x = trial.x;
        player.pos.z = trial.z;
        const facing = Math.atan2(wish.x, wish.z);
        player.heading += wrapAngle(facing - player.heading) * Math.min(1, dt * ON_FOOT.turn);
        swingLimbs(mesh, player.speed, dt);
      } else {
        player.speed += (0 - player.speed) * Math.min(1, dt * 10);
        swingLimbs(mesh, 0, dt);
      }
      mesh.rotation.y = player.heading;
    },
    // Third-person camera: behind the player at the orbit yaw, aimed at the
    // chest. In a car the camera pulls back and rides higher.
    updateCamera(dt) {
      const anchor = player.inCar && player.car ? player.car.mesh.position : player.pos;
      const dist = player.inCar ? ON_FOOT.camDistCar : player.cameraDist;
      const high = player.inCar ? ON_FOOT.camHighCar : ON_FOOT.camHigh;
      const yaw = player.cameraYaw;
      const pitch = player.inCar ? 0.3 : player.cameraPitch;
      const offset = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        high + Math.sin(pitch) * dist * 0.6,
        Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      const goal = anchor.clone().add(offset);
      G.camera.position.lerp(goal, Math.min(1, dt * 8));
      G.camera.lookAt(anchor.x, anchor.y + 1.4, anchor.z);
    },
    damage(amount) {
      if (player.dead) return;
      player.health = Math.max(0, player.health - amount);
      if (player.health <= 0) {
        player.dead = true;
        // Go down flat, like a knocked-down pedestrian, not standing dead.
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.3;
        G.gameOver('wasted');
      }
    },
    heal(amount) {
      player.health = Math.min(ON_FOOT.hp, player.health + amount);
    },
    reset() {
      player.health = ON_FOOT.hp;
      player.dead = false;
      player.inCar = false;
      player.car = null;
      player.pos.set(0, 0, 20);
      player.heading = 0;
      player.cameraYaw = Math.PI;
      mesh.visible = true;
      mesh.rotation.x = 0;
      mesh.position.y = 0;
    },
  };
  return player;
}

// --- Pedestrians -----------------------------------------------------------
// They stroll the sidewalks, turn at intersections, and run from gunfire or
// from a car bearing down on them. Hitting one is a crime (see police.js).
export function createPedestrians(G, count = 26) {
  const rng = G.rng;
  const crowd = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = buildPerson(rng, pickOne(rng, SHIRTS), pickOne(rng, TROUSERS));
    const avenue = pickOne(rng, AVENUES);
    const block = pickOne(rng, BLOCK_CENTRES);
    const walksZ = rng() > 0.5;
    const side = rng() > 0.5 ? 9.5 : -9.5;
    mesh.position.set(
      walksZ ? avenue + side : block,
      0,
      walksZ ? block : avenue + side,
    );
    G.scene.add(mesh);
    crowd.push({
      mesh,
      pos: mesh.position,
      heading: rng() * Math.PI * 2,
      speed: between(rng, 1.1, 2),
      state: 'walk', // walk | flee | down
      timer: between(rng, 2, 8),
      health: 30,
    });
  }

  function wander(ped, dt) {
    if (ped.timer > 0) return;
    // Pick a fresh direction on the sidewalk grid.
    ped.heading = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() > 0.5 ? 0 : Math.PI);
    ped.timer = between(rng, 3, 9);
    ped.speed = between(rng, 1.1, 2);
  }

  return {
    list: crowd,
    update(dt) {
      const pp = G.player.pos;
      for (const ped of crowd) {
        if (ped.state === 'down') continue;
        ped.timer -= dt;
        const d = Math.hypot(ped.pos.x - pp.x, ped.pos.z - pp.z);
        // A car coming at them fast sends them running.
        if (G.player.inCar && G.player.car && d < 12 && Math.abs(G.player.car.speed) > 4) {
          ped.state = 'flee';
          ped.timer = 2.5;
        }
        if (ped.state === 'flee') {
          ped.heading = Math.atan2(ped.pos.x - pp.x, ped.pos.z - pp.z);
          ped.speed = 5.5;
          if (ped.timer <= 0) ped.state = 'walk';
        } else {
          wander(ped, dt);
        }
        const trial = new THREE.Vector3(
          ped.pos.x + Math.sin(ped.heading) * ped.speed * dt,
          0,
          ped.pos.z + Math.cos(ped.heading) * ped.speed * dt,
        );
        G.city.resolveCircle(trial, 0.5);
        ped.pos.x = trial.x;
        ped.pos.z = trial.z;
        ped.mesh.rotation.y = ped.heading;
        swingLimbs(ped.mesh, ped.speed, dt);
      }
    },
    // A shot or a car hit near (x, z) scares every pedestrian in earshot.
    scare(x, z, radius = 30) {
      for (const ped of crowd) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
          ped.state = 'flee';
          ped.timer = 2.5;
        }
      }
    },
    hitAt(x, z, radius = 2) {
      for (const ped of crowd) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) return ped;
      }
      return null;
    },
    knockDown(ped) {
      ped.state = 'down';
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
    },
    reset() {
      for (const ped of crowd) {
        ped.state = 'walk';
        ped.health = 30;
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
    },
  };
}
