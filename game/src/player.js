// Costa Verde v3 — Alex Vega on foot, plus the pedestrians who share the
// sidewalks. People are simple articulated box figures; pedestrians are the
// same figure in different colours, walking the sidewalks and fleeing trouble.

import * as THREE from 'three';
import { AVENUES, BLOCK_CENTRES, ON_FOOT, between, pickOne } from './config.js';

const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6e4530];
const SHIRTS = [0xd94f3d, 0x2e7f9e, 0xe8a13a, 0x4f9e57, 0x8a5a9e, 0xe8e0d0, 0x3a3f46];
const TROUSERS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x4a5a6a];

// A person from boxes: legs, torso, arms, head. Limbs swing when walking.
export function buildPerson(rng, shirt, pants) {
  const g = new THREE.Group();
  const skin = pickOne(rng, SKINS);
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pantsMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), shirtMat);
  torso.position.y = 1.11;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirtMat);
  armL.position.set(-0.4, 1.12, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  head.position.y = 1.62;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x1e1a16 }));
  hair.position.y = 1.8;
  g.add(legL, legR, torso, armL, armR, head, hair);
  g.userData = { legL, legR, armL, armR, phase: rng() * Math.PI * 2 };
  return g;
}

function animateWalk(figure, speed, dt) {
  const u = figure.userData;
  u.phase += dt * speed * 1.6;
  const swing = Math.min(0.7, speed * 0.09) * Math.sin(u.phase);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
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
    update(dt) {
      const input = G.input;
      // Orbit: drag rotates the camera around the player; wheel zooms.
      const orbit = input.takeOrbit();
      player.cameraYaw -= orbit.dx * 0.005;
      player.cameraPitch = Math.max(0.08, Math.min(1.1, player.cameraPitch + orbit.dy * 0.004));
      player.cameraDist = Math.max(5, Math.min(20, player.cameraDist + input.takeWheel() * 0.01));

      if (player.inCar || player.dead) return;
      const target = input.run() ? ON_FOOT.run : ON_FOOT.walk;
      let mx = 0;
      let mz = 0;
      if (input.forward()) { mx -= Math.sin(player.cameraYaw); mz -= Math.cos(player.cameraYaw); }
      if (input.back()) { mx += Math.sin(player.cameraYaw); mz += Math.cos(player.cameraYaw); }
      if (input.left()) { mx -= Math.cos(player.cameraYaw); mz += Math.sin(player.cameraYaw); }
      if (input.right()) { mx += Math.cos(player.cameraYaw); mz -= Math.sin(player.cameraYaw); }
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        player.speed += (target - player.speed) * Math.min(1, dt * 8);
        const trial = new THREE.Vector3(
          player.pos.x + mx * player.speed * dt,
          0,
          player.pos.z + mz * player.speed * dt,
        );
        G.city.resolveCircle(trial, ON_FOOT.radius);
        player.pos.x = trial.x;
        player.pos.z = trial.z;
        const want = Math.atan2(mx, mz);
        player.heading += wrapAngle(want - player.heading) * Math.min(1, dt * ON_FOOT.turn);
        animateWalk(mesh, player.speed, dt);
      } else {
        player.speed += (0 - player.speed) * Math.min(1, dt * 10);
        animateWalk(mesh, 0, dt);
      }
      mesh.rotation.y = player.heading;
    },
    // Third-person camera: behind the player at the orbit yaw, looking at the chest.
    updateCamera(dt) {
      const anchor = player.inCar && player.car ? player.car.mesh.position : player.pos;
      const dist = player.inCar ? ON_FOOT.camDistCar : player.cameraDist;
      const high = player.inCar ? ON_FOOT.camHighCar : ON_FOOT.camHigh;
      const yaw = player.cameraYaw;
      const pitch = player.inCar ? 0.3 : player.cameraPitch;
      const cx = anchor.x + Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = anchor.z + Math.cos(yaw) * Math.cos(pitch) * dist;
      const cy = anchor.y + high + Math.sin(pitch) * dist * 0.6;
      const cam = G.camera;
      const k = Math.min(1, dt * 8);
      cam.position.x += (cx - cam.position.x) * k;
      cam.position.y += (cy - cam.position.y) * k;
      cam.position.z += (cz - cam.position.z) * k;
      cam.lookAt(anchor.x, anchor.y + 1.4, anchor.z);
    },
    damage(amount) {
      if (player.dead) return;
      player.health = Math.max(0, player.health - amount);
      if (player.health <= 0) {
        player.dead = true;
        // Go down like a knocked-down pedestrian, instead of standing dead.
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
    const alongZ = rng() > 0.5;
    mesh.position.set(
      alongZ ? avenue + (rng() > 0.5 ? 9.5 : -9.5) : block,
      0,
      alongZ ? block : avenue + (rng() > 0.5 ? 9.5 : -9.5),
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

  return {
    list: crowd,
    update(dt) {
      const pp = G.player.pos;
      for (const ped of crowd) {
        if (ped.state === 'down') continue;
        ped.timer -= dt;
        const d = Math.hypot(ped.pos.x - pp.x, ped.pos.z - pp.z);
        // Flee if the player is driving at them, or a shot just went off nearby.
        if (G.player.inCar && G.player.car && d < 12 && Math.abs(G.player.car.speed) > 4) {
          ped.state = 'flee';
          ped.timer = 2.5;
        }
        if (ped.state === 'flee') {
          ped.heading = Math.atan2(ped.pos.x - pp.x, ped.pos.z - pp.z);
          ped.speed = 5.5;
          if (ped.timer <= 0) ped.state = 'walk';
        } else if (ped.timer <= 0) {
          // Turn at random: keep walking the sidewalk grid.
          ped.heading = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() > 0.5 ? 0 : Math.PI);
          ped.timer = between(rng, 3, 9);
          ped.speed = between(rng, 1.1, 2);
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
        animateWalk(ped.mesh, ped.speed, dt);
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
