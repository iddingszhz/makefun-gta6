// Costa Verde — Alex Vega on foot, plus the pedestrians who share the sidewalks.
// The player is a simple articulated box figure; pedestrians are the same figure
// in different colours, walking the sidewalks and fleeing from trouble.
import * as THREE from 'three';
import { BLOCKS, PLAYER, STREETS, pick, range } from './config.js';

const SKIN_TONES = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6e4530];
const SHIRT_COLORS = [0xd94f3d, 0x2e7f9e, 0xe8a13a, 0x4f9e57, 0x8a5a9e, 0xe8e0d0, 0x3a3f46];
const PANTS_COLORS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x4a5a6a];

// A person built from boxes: legs, torso, arms, head. Limbs swing when walking.
export function makePerson(rng, shirt, pants) {
  const group = new THREE.Group();
  const skin = pick(rng, SKIN_TONES);
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
  group.add(legL, legR, torso, armL, armR, head, hair);
  group.userData = { legL, legR, armL, armR, walkPhase: rng() * Math.PI * 2 };
  return group;
}

function swingWalk(person, speed, dt) {
  const u = person.userData;
  u.walkPhase += dt * speed * 1.6;
  const swing = Math.min(0.7, speed * 0.09) * Math.sin(u.walkPhase);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
}

export function createPlayer(G) {
  const rng = G.rng;
  const mesh = makePerson(rng, 0x2e7f9e, 0x2a3550);
  mesh.position.set(0, 0, 20);
  G.scene.add(mesh);

  const player = {
    mesh,
    pos: mesh.position,
    heading: 0, // facing angle, radians
    speed: 0,
    health: PLAYER.maxHealth,
    inCar: false,
    car: null,
    cameraYaw: Math.PI, // camera looks north at start
    cameraPitch: 0.32,
    cameraDist: PLAYER.cameraDistance,
    dead: false,
    update(dt) {
      const input = G.input;
      // Orbit: drag rotates the camera around the player; wheel zooms.
      const orbit = input.takeOrbit();
      player.cameraYaw -= orbit.dx * 0.005;
      player.cameraPitch = Math.max(0.08, Math.min(1.1, player.cameraPitch + orbit.dy * 0.004));
      player.cameraDist = Math.max(5, Math.min(20, player.cameraDist + input.takeWheel() * 0.01));

      if (player.inCar || player.dead) return;
      const run = input.run();
      const targetSpeed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
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
        player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
        const nx = player.pos.x + mx * player.speed * dt;
        const nz = player.pos.z + mz * player.speed * dt;
        const trial = new THREE.Vector3(nx, 0, nz);
        G.city.resolveCircle(trial, PLAYER.radius);
        player.pos.x = trial.x;
        player.pos.z = trial.z;
        const wantHeading = Math.atan2(mx, mz);
        let diff = wantHeading - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.heading += diff * Math.min(1, dt * PLAYER.turnSpeed);
        swingWalk(mesh, player.speed, dt);
      } else {
        player.speed += (0 - player.speed) * Math.min(1, dt * 10);
        swingWalk(mesh, 0, dt);
      }
      mesh.rotation.y = player.heading;
    },
    // Third-person camera: behind the player at the orbit yaw, looking at the chest.
    updateCamera(dt) {
      const target = player.inCar && player.car ? player.car.mesh.position : player.pos;
      const dist = player.inCar ? PLAYER.cameraDistanceCar : player.cameraDist;
      const height = player.inCar ? PLAYER.cameraHeightCar : PLAYER.cameraHeight;
      const yaw = player.cameraYaw;
      const pitch = player.inCar ? 0.3 : player.cameraPitch;
      const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
      const cy = target.y + height + Math.sin(pitch) * dist * 0.6;
      const cam = G.camera;
      cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 8);
      cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 8);
      cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 8);
      cam.lookAt(target.x, target.y + 1.4, target.z);
    },
    damage(amount) {
      if (player.dead) return;
      player.health = Math.max(0, player.health - amount);
      if (player.health <= 0) {
        player.dead = true;
        G.gameOver('wasted');
      }
    },
    heal(amount) {
      player.health = Math.min(PLAYER.maxHealth, player.health + amount);
    },
    reset() {
      player.health = PLAYER.maxHealth;
      player.dead = false;
      player.inCar = false;
      player.car = null;
      player.pos.set(0, 0, 20);
      player.heading = 0;
      player.cameraYaw = Math.PI;
      mesh.visible = true;
    },
  };
  return player;
}

// --- Pedestrians -----------------------------------------------------------
// They stroll the sidewalks, turn at intersections, and run from gunfire or
// from a car bearing down on them. Hitting one is a crime (see police.js).
export function createPedestrians(G, count = 26) {
  const rng = G.rng;
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const shirt = pick(rng, SHIRT_COLORS);
    const mesh = makePerson(rng, shirt, pick(rng, PANTS_COLORS));
    const street = pick(rng, STREETS);
    const block = pick(rng, BLOCKS);
    const alongZ = rng() > 0.5;
    mesh.position.set(
      alongZ ? street + (rng() > 0.5 ? 9.5 : -9.5) : block,
      0,
      alongZ ? block : street + (rng() > 0.5 ? 9.5 : -9.5),
    );
    G.scene.add(mesh);
    peds.push({
      mesh,
      pos: mesh.position,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.1, 2),
      state: 'walk', // walk | flee | down
      timer: range(rng, 2, 8),
      health: 30,
    });
  }

  return {
    list: peds,
    update(dt) {
      const playerPos = G.player.pos;
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        ped.timer -= dt;
        const distToPlayer = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
        // Flee if the player is driving at them, or a shot just went off nearby.
        if (G.player.inCar && G.player.car && distToPlayer < 12 && Math.abs(G.player.car.speed) > 4) {
          ped.state = 'flee';
          ped.timer = 2.5;
        }
        if (ped.state === 'flee') {
          const away = Math.atan2(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
          ped.heading = away;
          ped.speed = 5.5;
          if (ped.timer <= 0) ped.state = 'walk';
        } else if (ped.timer <= 0) {
          // Turn at random: keep walking the sidewalk grid.
          ped.heading = Math.floor(rng() * 4) * (Math.PI / 2) + (rng() > 0.5 ? 0 : Math.PI);
          ped.timer = range(rng, 3, 9);
          ped.speed = range(rng, 1.1, 2);
        }
        const nx = ped.pos.x + Math.sin(ped.heading) * ped.speed * dt;
        const nz = ped.pos.z + Math.cos(ped.heading) * ped.speed * dt;
        const trial = new THREE.Vector3(nx, 0, nz);
        G.city.resolveCircle(trial, 0.5);
        ped.pos.x = trial.x;
        ped.pos.z = trial.z;
        ped.mesh.rotation.y = ped.heading;
        swingWalk(ped.mesh, ped.speed, dt);
      }
    },
    // A shot or a car hit near (x, z) scares every pedestrian in earshot.
    scare(x, z, radius = 30) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
          ped.state = 'flee';
          ped.timer = 2.5;
        }
      }
    },
    hitAt(x, z, radius = 2) {
      for (const ped of peds) {
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
      for (const ped of peds) {
        ped.state = 'walk';
        ped.health = 30;
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
    },
  };
}
