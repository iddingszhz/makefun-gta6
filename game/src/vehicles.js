// Costa Verde — the cars. Traffic follows the street grid, stops for
// crashes and waits out red lights at intersections; the player's car is
// the same machine with steering, a handbrake and damage.

import * as THREE from 'three';
import { AVENUES, BLOCK_CENTRES, CITY_EDGE, DRIVE, between, clamp, pickOne } from './config.js';

const PALETTE = [0xc23b2e, 0x2e6fc2, 0xe8c13a, 0x3a3f46, 0xe8e0d0, 0x4f9e57, 0x8a5a9e, 0x9e6b3a];
const STREET_NAMES = ['Palm Row', 'Coral Ave', 'Harbor St', 'Sunset Blvd', 'Marina Way'];

// A car from a parts list: body, cabin, wheels, headlights and tail lights.
// The shape is the same for traffic, parked cars and police cars; police
// cars get a light bar added by police.js.
export function buildCar(rng, colour = null) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour ?? pickOne(rng, PALETTE) });
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const group = new THREE.Group();
  const boxes = [
    { size: [2, 0.75, 4.4], at: [0, 0.65, 0], mat: bodyMat },
    { size: [1.8, 0.6, 2.2], at: [0, 1.28, -0.3], mat: cabinMat },
  ];
  for (const box of boxes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...box.size), box.mat);
    mesh.position.set(...box.at);
    group.add(mesh);
  }
  for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.08);
  const frontMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0 });
  const rearMat = new THREE.MeshLambertMaterial({ color: 0xd92b1f });
  for (const x of [-0.65, 0.65]) {
    const front = new THREE.Mesh(lightGeo, frontMat);
    front.position.set(x, 0.7, 2.22);
    group.add(front);
    const rear = new THREE.Mesh(lightGeo, rearMat);
    rear.position.set(x, 0.7, -2.22);
    group.add(rear);
  }
  return group;
}

// Where a car may spawn: on an avenue, at a random block centre.
export function randomStreetSpot(rng) {
  const avenue = pickOne(rng, AVENUES);
  const block = pickOne(rng, BLOCK_CENTRES);
  const jitter = between(rng, -2, 2);
  if (rng() > 0.5) return { x: avenue + jitter, z: block, heading: rng() > 0.5 ? 0 : Math.PI };
  return { x: block, z: avenue + jitter, heading: rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}

export function createVehicles(G) {
  const rng = G.rng;
  const traffic = [];
  const parked = [];

  function spawnCar(list, spot, isCop = false) {
    const mesh = buildCar(rng);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.heading;
    G.scene.add(mesh);
    const car = {
      mesh,
      pos: mesh.position,
      heading: spot.heading,
      speed: 0,
      target: isCop ? 0 : between(rng, 8, 14),
      get cruise() { return this.target; },
      set cruise(v) { this.target = v; },
      health: DRIVE.hp,
      wrecked: false,
      isCop,
      steer: 0,
      pause: 0,
      name: pickOne(rng, STREET_NAMES),
    };
    list.push(car);
    return car;
  }

  for (let i = 0; i < DRIVE.traffic; i += 1) {
    spawnCar(traffic, randomStreetSpot(rng));
  }
  for (let i = 0; i < DRIVE.parked; i += 1) {
    const car = spawnCar(parked, randomStreetSpot(rng));
    car.target = 0;
  }

  // Snap a heading to the nearest of the four street directions.
  function snapHeading(heading) {
    return Math.round(heading / (Math.PI / 2)) * (Math.PI / 2);
  }

  // The player's car: accelerate, brake, reverse, steer (slower at speed),
  // handbrake, and collisions with buildings, people and other cars.
  function drivePlayerCar(car, dt) {
    const input = G.input;
    const forward = input.forward();
    const back = input.back();
    const target = forward ? DRIVE.top : back ? -DRIVE.topReverse : 0;
    const accel = forward ? DRIVE.accel : back ? DRIVE.brake : 0;
    if (forward || back) {
      car.speed += Math.sign(target - car.speed) * accel * dt;
      car.speed = clamp(car.speed, -DRIVE.topReverse, DRIVE.top);
    } else {
      car.speed += (0 - car.speed) * Math.min(1, dt * 2.2);
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    if (input.brake()) car.speed += (0 - car.speed) * Math.min(1, dt * 5);
    const steerTarget = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
    const steerGoal = steerTarget * DRIVE.steerMax;
    car.steer += (steerGoal - car.steer) * Math.min(1, dt * DRIVE.steerRate);
    const sign = car.speed >= 0 ? 1 : -1;
    car.heading += car.steer * (car.speed / DRIVE.top) * dt * 2.4 * sign;

    const dx = Math.sin(car.heading);
    const dz = Math.cos(car.heading);
    const trial = new THREE.Vector3(
      car.pos.x + dx * car.speed * dt,
      0,
      car.pos.z + dz * car.speed * dt,
    );
    if (!G.city.resolveRect(trial, DRIVE.halfLen, DRIVE.halfWid, car.heading)) {
      // A wall took the hit: stop and spark a little crash.
      if (Math.abs(car.speed) > 8) G.audio.crash(Math.abs(car.speed) / 20);
      car.speed *= -0.3;
      G.hud.kickCamera();
    }
    car.pos.x = trial.x;
    car.pos.z = trial.z;

    // Running someone down is a crime, and the car takes a little damage.
    const ped = G.peds.hitAt(car.pos.x, car.pos.z, 2.2);
    if (ped && Math.abs(car.speed) > 2) {
      G.peds.knockDown(ped);
      G.audio.crash(0.5);
      G.police.addHeat(1, 'Pedestrian hit');
      car.health = Math.max(0, car.health - 12);
    }
    for (const other of [...traffic, ...parked]) {
      if (other === car || other.wrecked) continue;
      const gap = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
      if (gap < 3.5 && Math.abs(car.speed) > 3) {
        other.health = Math.max(0, other.health - 25);
        car.health = Math.max(0, car.health - 8);
        G.audio.crash(Math.abs(car.speed) / 20);
        if (other.health <= 0) other.wrecked = true;
        car.speed *= 0.3;
        break;
      }
    }
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      G.hud.flash('Your car is wrecked — get out and find another');
    }
    car.mesh.rotation.y = car.heading;
    car.mesh.position.y = 0;
  }

  // One traffic car: cruise along its street, stop for the car ahead and
  // for red lights at intersections, and stay stopped once wrecked.
  function stepTraffic(car, dt) {
    if (car.wrecked) {
      car.speed = 0;
      return;
    }
    if (car.pause > 0) {
      car.pause -= dt;
      car.speed += (0 - car.speed) * Math.min(1, dt * 4);
    } else {
      car.speed += (car.target - car.speed) * Math.min(1, dt * 2);
    }
    car.heading = snapHeading(car.heading);
    const dx = Math.sin(car.heading);
    const dz = Math.cos(car.heading);
    const ahead = new THREE.Vector3(car.pos.x + dx * 6, 0, car.pos.z + dz * 6);
    const blocked = [...traffic, ...parked].some(
      (other) => other !== car && Math.hypot(other.pos.x - ahead.x, other.pos.z - ahead.z) < 4,
    );
    const nearIntersection = AVENUES.some((s) => Math.abs(car.pos.x - s) < 4 || Math.abs(car.pos.z - s) < 4);
    const redLight = nearIntersection && Math.floor(G.time / 6) % 2 === 0;
    if (blocked || redLight) car.pause = Math.max(car.pause, 1.2);
    const trial = new THREE.Vector3(
      car.pos.x + dx * car.speed * dt,
      0,
      car.pos.z + dz * car.speed * dt,
    );
    if (G.city.resolveRect(trial, DRIVE.halfLen, DRIVE.halfWid, car.heading)) {
      car.pos.x = trial.x;
      car.pos.z = trial.z;
    } else {
      // End of the road: turn around and come back.
      car.heading += Math.PI;
      car.pos.x = clamp(car.pos.x, -CITY_EDGE, CITY_EDGE);
      car.pos.z = clamp(car.pos.z, -CITY_EDGE, CITY_EDGE);
    }
    car.mesh.rotation.y = car.heading;
    car.mesh.position.y = 0;
  }

  const api = {
    traffic,
    parked,
    spawnCar,
    update(dt) {
      const player = G.player;
      if (player.inCar && player.car) drivePlayerCar(player.car, dt);
      for (const car of traffic) stepTraffic(car, dt);
      for (const car of parked) {
        car.mesh.rotation.y = car.heading;
        car.mesh.position.y = 0;
      }
    },
    // The nearest car the player could steal, on foot and close.
    nearestStealable() {
      const pp = G.player.pos;
      let best = null;
      let bestD = 3.2;
      for (const car of [...traffic, ...parked]) {
        if (car.wrecked) continue;
        const d = Math.hypot(car.pos.x - pp.x, car.pos.z - pp.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
    enterCar(car) {
      const player = G.player;
      player.inCar = true;
      player.car = car;
      player.mesh.visible = false;
      car.speed = 0;
      G.hud.setObjective(`Driving ${car.name} — ${G.missions.active ? G.missions.active.title : 'free roam'}`);
      G.audio.pickup();
      if (car.isCop) G.police.addHeat(1, 'Stole a police car');
    },
    exitCar() {
      const player = G.player;
      const car = player.car;
      if (!car) return;
      car.speed = 0;
      player.inCar = false;
      player.car = null;
      player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 2.5, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.5);
      player.heading = car.heading;
      player.mesh.visible = true;
    },
    reset() {
      for (const car of [...traffic, ...parked]) {
        car.health = DRIVE.hp;
        car.wrecked = false;
        car.speed = 0;
      }
    },
  };
  return api;
}
