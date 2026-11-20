// Costa Verde v3 — cars: a box-built car factory, traffic that drives the
// street grid, parked cars to steal, and arcade driving for the player's car.

import * as THREE from 'three';
import { AVENUES, DRIVE, between, pickOne } from './config.js';

const PAINTS = [0xc23b2e, 0x2e6fb0, 0xe8a13a, 0x3a3f46, 0xe8e0d0, 0x4f9e57, 0x7a4a9e, 0xd97b2e];
const TAXI = 0xf2c230;

// A car from boxes: body, cabin, wheels, lights. `police` adds a light bar.
export function makeCar(rng, colour, police = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0x1c1f26 : colour });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.4), paint);
  body.position.y = 0.56;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 2.0), glass);
  cabin.position.set(0, 1.06, -0.3);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.9), paint);
  hood.position.set(0, 0.9, 1.6);
  g.add(body, cabin, hood);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.45], [0.92, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.35, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so a car reads at a glance, day or night.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd92b1f });
  for (const sx of [-0.68, 0.68]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.08), headMat);
    head.position.set(sx, 0.56, 2.22);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.08), tailMat);
    tail.position.set(sx, 0.56, -2.22);
    g.add(tail);
  }
  let barL = null;
  let barR = null;
  if (police) {
    const bar = new THREE.Group();
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barL.position.x = -0.3;
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barR.position.x = 0.3;
    bar.add(barL, barR);
    bar.position.y = 1.44;
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.62), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  g.userData = { wheels, lightBarL: barL, lightBarR: barR };
  return g;
}

function newCarState(mesh, x, z, heading, opts = {}) {
  return {
    mesh,
    pos: mesh.position,
    heading,
    speed: 0,
    steer: 0,
    health: DRIVE.hp,
    kind: opts.kind || 'traffic', // traffic | parked | player | police
    color: opts.color || 0,
    driver: opts.driver !== false,
    despawn: 0,
    updateVisual() {
      mesh.position.x = this.pos.x;
      mesh.position.z = this.pos.z;
      mesh.rotation.y = this.heading;
      const spin = this.speed * 0.12;
      for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
    },
  };
}

export function createVehicles(G) {
  const rng = G.rng;
  const all = []; // every car in the world, traffic + parked + player + police
  const moving = []; // traffic cars
  const standing = []; // parked cars

  function addCar(x, z, heading, opts) {
    const mesh = makeCar(rng, opts.color ?? pickOne(rng, PAINTS), opts.kind === 'police');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    const car = newCarState(mesh, x, z, heading, opts);
    all.push(car);
    return car;
  }

  // Traffic: each car owns one avenue and one direction, drives it end to
  // end, then wraps to the far end. A slow car ahead makes the one behind
  // slow down instead of rear-ending it.
  function fillTraffic() {
    for (let i = 0; i < DRIVE.traffic; i += 1) {
      const across = rng() > 0.5;
      const avenue = pickOne(rng, AVENUES);
      const lane = rng() > 0.5 ? 3.2 : -3.2;
      const dir = rng() > 0.5 ? 1 : -1;
      const along = between(rng, -280, 280);
      const car = addCar(
        across ? along : avenue + lane,
        across ? avenue + lane : along,
        across ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        { kind: 'traffic', color: rng() < 0.12 ? TAXI : undefined },
      );
      car.horizontal = across;
      car.street = avenue;
      car.lane = lane;
      car.dir = dir;
      car.cruise = between(rng, 9, 14);
      car.speed = car.cruise;
      moving.push(car);
    }
  }

  // Parked cars sit along the curb, ready to be stolen.
  function fillParked() {
    for (let i = 0; i < DRIVE.parked; i += 1) {
      const across = rng() > 0.5;
      const avenue = pickOne(rng, AVENUES);
      const along = between(rng, -260, 260);
      const side = rng() > 0.5 ? 1 : -1;
      const car = addCar(
        across ? along : avenue + side * 5.2,
        across ? avenue + side * 5.2 : along,
        across ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
        { kind: 'parked', driver: false },
      );
      car.speed = 0;
      standing.push(car);
    }
  }

  fillTraffic();
  fillParked();

  const vehicles = {
    cars: all,
    traffic: moving,
    parked: standing,
    // The nearest car the player could steal, within 3.5 m.
    nearestStealable(x, z) {
      let best = null;
      let bestD = 3.5;
      for (const car of all) {
        if (car.kind === 'player' || car.kind === 'police') continue;
        const d = Math.hypot(car.pos.x - x, car.pos.z - z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
    steal(car) {
      car.kind = 'player';
      const pi = standing.indexOf(car);
      if (pi >= 0) standing.splice(pi, 1);
      const ti = moving.indexOf(car);
      if (ti >= 0) moving.splice(ti, 1);
      G.player.inCar = true;
      G.player.car = car;
      G.player.mesh.visible = false;
      G.audio.pickup();
      return car;
    },
    exitCar() {
      const car = G.player.car;
      if (!car) return;
      car.kind = 'parked';
      car.speed = 0;
      standing.push(car);
      G.player.inCar = false;
      G.player.car = null;
      // Step out to the driver's side so the player never spawns inside a wall.
      const sideX = Math.cos(car.heading);
      const sideZ = -Math.sin(car.heading);
      G.player.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + sideZ * 2.2);
      G.city.resolveCircle(G.player.pos, 0.6);
      G.player.mesh.visible = true;
      G.player.heading = car.heading;
    },
    damageCar(car, amount) {
      car.health = Math.max(0, car.health - amount);
      if (car.health <= 0 && car.kind === 'player') {
        // The player's car is wrecked: dump them out on foot.
        vehicles.exitCar();
        G.hud.flash('Your car is wrecked!');
      }
      return car.health;
    },
    removeCar(car) {
      G.scene.remove(car.mesh);
      const i = all.indexOf(car);
      if (i >= 0) all.splice(i, 1);
      const t = moving.indexOf(car);
      if (t >= 0) moving.splice(t, 1);
      const p = standing.indexOf(car);
      if (p >= 0) standing.splice(p, 1);
    },
    update(dt) {
      const input = G.input;
      // --- The player's car ---
      const pc = G.player.car;
      if (G.player.inCar && pc) {
        const gas = input.forward() ? 1 : 0;
        const rev = input.back() ? 1 : 0;
        const steerIn = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
        const wantSteer = steerIn * DRIVE.steerMax * (pc.speed >= 0 ? 1 : -1);
        pc.steer += (wantSteer - pc.steer) * Math.min(1, dt * DRIVE.steerRate * 3);
        if (gas) pc.speed += DRIVE.accel * dt;
        if (rev) pc.speed -= (pc.speed > 0.5 ? DRIVE.brake : DRIVE.reverse) * dt;
        if (input.brake()) pc.speed -= Math.sign(pc.speed) * DRIVE.brake * 0.7 * dt;
        if (!gas && !rev) pc.speed -= Math.sign(pc.speed) * Math.min(Math.abs(pc.speed), 8 * dt);
        pc.speed = Math.max(-DRIVE.topReverse, Math.min(DRIVE.top, pc.speed));
        pc.heading += (pc.speed / 4.6) * Math.tan(pc.steer) * dt * 1.4;
        pc.pos.x += Math.sin(pc.heading) * pc.speed * dt;
        pc.pos.z += Math.cos(pc.heading) * pc.speed * dt;
        if (G.city.resolveCircle(pc.pos, DRIVE.radius)) {
          // Bumped a building: lose speed, make a noise, small damage.
          const impact = Math.abs(pc.speed);
          pc.speed *= -0.25;
          if (impact > 6) {
            G.audio.crash(Math.min(2, impact / 12));
            vehicles.damageCar(pc, impact * 0.5);
            G.hud.flash('Crash!');
          }
        }
        // Running over a pedestrian is a crime.
        const ped = G.peds.hitAt(pc.pos.x, pc.pos.z, 2.2);
        if (ped && Math.abs(pc.speed) > 2) {
          G.peds.knockDown(ped);
          G.police.commitCrime(1, 'You hit a pedestrian!');
          G.audio.crash(1);
        }
        // Car-to-car bumps.
        for (const other of all) {
          if (other === pc || other.kind === 'player') continue;
          const dx = other.pos.x - pc.pos.x;
          const dz = other.pos.z - pc.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 3.4 && d > 0.01) {
            const push = (3.4 - d) / 2;
            const nx = dx / d;
            const nz = dz / d;
            pc.pos.x -= nx * push;
            pc.pos.z -= nz * push;
            other.pos.x += nx * push;
            other.pos.z += nz * push;
            const rel = Math.abs(pc.speed - other.speed);
            if (rel > 4) {
              G.audio.crash(Math.min(2, rel / 10));
              vehicles.damageCar(pc, rel * 0.4);
              if (other.kind === 'police') G.police.commitCrime(1, 'You hit a police car!');
              // Shove a same-direction car forward so it pulls away instead
              // of being pinned in front of the player.
              const align = Math.sin(pc.heading) * Math.sin(other.heading) + Math.cos(pc.heading) * Math.cos(other.heading);
              if (align > 0.5 && other.kind === 'traffic') {
                other.speed = Math.max(other.speed, Math.abs(pc.speed) * 0.8);
              }
              pc.speed *= 0.6;
            }
          }
        }
        pc.updateVisual();
        G.player.pos.copy(pc.pos);
        G.player.heading = pc.heading;
      }

      // --- Traffic ---
      for (const car of moving) {
        // A wrecked car stays where it was shot: it does not keep cruising.
        let target = car.health <= 0 ? 0 : car.cruise;
        // Slow for a car ahead in the same lane.
        for (const other of all) {
          if (other === car) continue;
          const dx = other.pos.x - car.pos.x;
          const dz = other.pos.z - car.pos.z;
          const ahead = car.horizontal ? dx * car.dir : dz * car.dir;
          const lateral = car.horizontal ? Math.abs(dz) : Math.abs(dx);
          if (ahead > 0 && ahead < 12 && lateral < 3) {
            target = Math.min(target, Math.max(0, other.speed));
            break;
          }
        }
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        if (car.horizontal) car.pos.x += car.dir * car.speed * dt;
        else car.pos.z += car.dir * car.speed * dt;
        const along = car.horizontal ? car.pos.x : car.pos.z;
        if (along > 285 || along < -285) {
          // Wrap to the far end of the same street.
          if (car.horizontal) car.pos.x = -car.dir * 285;
          else car.pos.z = -car.dir * 285;
        }
        car.updateVisual();
      }

      // Keep parked cars' visuals in sync (they never move).
      for (const car of standing) car.updateVisual();
    },
    reset() {
      // Remove the player's wreck or stolen car and respawn fresh traffic.
      for (const car of [...all]) {
        if (car.kind === 'player') vehicles.removeCar(car);
      }
      for (const car of [...moving]) vehicles.removeCar(car);
      for (const car of [...standing]) vehicles.removeCar(car);
      fillTraffic();
      fillParked();
    },
  };
  return vehicles;
}
