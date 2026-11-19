// Costa Verde — cars: a box-built car factory, traffic that drives the street
// grid, parked cars to steal, and arcade driving for the player's car.
import * as THREE from 'three';
import { CAR, STREETS, pick, range } from './config.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fb0, 0xe8a13a, 0x3a3f46, 0xe8e0d0, 0x4f9e57, 0x7a4a9e, 0xd97b2e];
const TAXI_YELLOW = 0xf2c230;

// A car from boxes: body, cabin, wheels, lights. `police` adds a light bar.
export function makeCar(rng, color, police = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0x1c1f26 : color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.6), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.08, -0.25);
  group.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so a car reads at a glance, day or night.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd92b1f });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(sx, 0.55, 2.32);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(sx, 0.55, -2.32);
    group.add(tail);
  }
  let lightBar = null;
  let lightBarL = null;
  let lightBarR = null;
  if (police) {
    lightBar = new THREE.Group();
    lightBarL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightBarL.position.x = -0.3;
    lightBarR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    lightBarR.position.x = 0.3;
    lightBar.add(lightBarL, lightBarR);
    lightBar.position.y = 1.44;
    group.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.62), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData = { wheels, lightBarL, lightBarR };
  return group;
}

function carState(mesh, x, z, heading, opts = {}) {
  return {
    mesh,
    pos: mesh.position,
    heading,
    speed: 0,
    steer: 0,
    health: CAR.maxHealth,
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
  const cars = []; // every car in the world, traffic + parked + player + police
  const traffic = [];
  const parked = [];

  function spawnAt(x, z, heading, opts) {
    const mesh = makeCar(rng, opts.color ?? pick(rng, CAR_COLORS), opts.kind === 'police');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    const car = carState(mesh, x, z, heading, opts);
    cars.push(car);
    return car;
  }

  // Traffic: each car owns one street and one direction, drives it end to end,
  // then wraps to the far end. A slow car ahead makes the one behind slow down.
  function spawnTraffic() {
    for (let i = 0; i < CAR.trafficCount; i += 1) {
      const horizontal = rng() > 0.5;
      const street = pick(rng, STREETS);
      const lane = rng() > 0.5 ? 3.2 : -3.2;
      const dir = rng() > 0.5 ? 1 : -1;
      const along = range(rng, -280, 280);
      const car = spawnAt(
        horizontal ? along : street + lane,
        horizontal ? street + lane : along,
        horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        { kind: 'traffic', color: rng() < 0.12 ? TAXI_YELLOW : undefined },
      );
      car.horizontal = horizontal;
      car.street = street;
      car.lane = lane;
      car.dir = dir;
      car.cruise = range(rng, 9, 14);
      car.speed = car.cruise;
      traffic.push(car);
    }
  }

  // Parked cars sit along the curb, ready to be stolen.
  function spawnParked() {
    for (let i = 0; i < CAR.parkedCount; i += 1) {
      const horizontal = rng() > 0.5;
      const street = pick(rng, STREETS);
      const along = range(rng, -260, 260);
      const side = rng() > 0.5 ? 1 : -1;
      const car = spawnAt(
        horizontal ? along : street + side * 5.2,
        horizontal ? street + side * 5.2 : along,
        horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
        { kind: 'parked', driver: false },
      );
      car.speed = 0;
      parked.push(car);
    }
  }

  spawnTraffic();
  spawnParked();

  const vehicles = {
    cars,
    traffic,
    parked,
    // The nearest car the player could steal, within 3.5 m.
    nearestStealable(x, z) {
      let best = null;
      let bestD = 3.5;
      for (const car of cars) {
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
      const parkedIndex = parked.indexOf(car);
      if (parkedIndex >= 0) parked.splice(parkedIndex, 1);
      const trafficIndex = traffic.indexOf(car);
      if (trafficIndex >= 0) traffic.splice(trafficIndex, 1);
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
      parked.push(car);
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
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      const t = traffic.indexOf(car);
      if (t >= 0) traffic.splice(t, 1);
      const p = parked.indexOf(car);
      if (p >= 0) parked.splice(p, 1);
    },
    update(dt) {
      const input = G.input;
      // --- Player driving ---
      const pc = G.player.car;
      if (G.player.inCar && pc) {
        const fwd = input.forward() ? 1 : 0;
        const back = input.back() ? 1 : 0;
        const steerInput = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
        const targetSteer = steerInput * CAR.steerMax * (pc.speed >= 0 ? 1 : -1);
        pc.steer += (targetSteer - pc.steer) * Math.min(1, dt * CAR.steerSpeed * 3);
        if (fwd) pc.speed += CAR.accel * dt;
        if (back) {
          pc.speed -= (pc.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
        }
        if (input.brake()) pc.speed -= Math.sign(pc.speed) * CAR.brake * 0.7 * dt;
        if (!fwd && !back) pc.speed -= Math.sign(pc.speed) * Math.min(Math.abs(pc.speed), 8 * dt);
        pc.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, pc.speed));
        pc.heading += (pc.speed / 4.6) * Math.tan(pc.steer) * dt * 1.4;
        const nx = pc.pos.x + Math.sin(pc.heading) * pc.speed * dt;
        const nz = pc.pos.z + Math.cos(pc.heading) * pc.speed * dt;
        pc.pos.x = nx;
        pc.pos.z = nz;
        if (G.city.resolveCircle(pc.pos, CAR.radius)) {
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
        for (const other of cars) {
          if (other === pc || other.kind === 'player') continue;
          const dx = other.pos.x - pc.pos.x;
          const dz = other.pos.z - pc.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 3.4 && d > 0.01) {
            const push = (3.4 - d) / 2;
            const nx2 = dx / d;
            const nz2 = dz / d;
            pc.pos.x -= nx2 * push;
            pc.pos.z -= nz2 * push;
            other.pos.x += nx2 * push;
            other.pos.z += nz2 * push;
            const rel = Math.abs(pc.speed - other.speed);
            if (rel > 4) {
              G.audio.crash(Math.min(2, rel / 10));
              vehicles.damageCar(pc, rel * 0.4);
              if (other.kind === 'police') G.police.commitCrime(1, 'You hit a police car!');
              else if (other.kind === 'traffic') G.police.commitCrime(0, '');
              pc.speed *= 0.6;
              other.speed = 0;
            }
          }
        }
        pc.updateVisual();
        G.player.pos.copy(pc.pos);
        G.player.heading = pc.heading;
      }

      // --- Traffic ---
      for (const car of traffic) {
        let target = car.cruise;
        // Slow for a car ahead in the same lane.
        for (const other of cars) {
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
      for (const car of parked) car.updateVisual();
    },
    reset() {
      // Remove the player's wreck or stolen car and respawn fresh traffic.
      for (const car of [...cars]) {
        if (car.kind === 'player') vehicles.removeCar(car);
      }
      for (const car of [...traffic]) vehicles.removeCar(car);
      for (const car of [...parked]) vehicles.removeCar(car);
      spawnTraffic();
      spawnParked();
    },
  };
  return vehicles;
}
