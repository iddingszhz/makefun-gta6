// Costa Verde v3 — the wanted level and the Costa Verde Police Department.
// Crimes raise the stars; police cars spawn at the city edge, chase the player
// and ram them; stay out of sight and the heat cools off.

import * as THREE from 'three';
import { AVENUES, DRIVE, HEAT, between, pickOne } from './config.js';
import { makeCar } from './vehicles.js';

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createPolice(G) {
  const rng = G.rng;
  const squad = [];
  let stars = 0;
  let quietFor = 0; // time since the last crime, while no police is near
  let coolFor = 0;
  let bustFor = 0;
  let holdFor = 0; // a destroyed police car is not replaced at once

  function spawnCop() {
    const edge = pickOne(rng, ['n', 's', 'e', 'w']);
    let x = 0;
    let z = 0;
    if (edge === 'n') { x = between(rng, -260, 260); z = -270; }
    if (edge === 's') { x = between(rng, -260, 260); z = 270; }
    if (edge === 'e') { x = 270; z = between(rng, -260, 260); }
    if (edge === 'w') { x = -270; z = between(rng, -260, 260); }
    const mesh = makeCar(rng, 0, true);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const pp = G.player.pos;
    const car = {
      mesh,
      pos: mesh.position,
      heading: Math.atan2(pp.x - x, pp.z - z),
      speed: 0,
      steer: 0,
      health: DRIVE.hp,
      kind: 'police',
      updateVisual() {
        mesh.position.x = this.pos.x;
        mesh.position.z = this.pos.z;
        mesh.rotation.y = this.heading;
        const spin = this.speed * 0.12;
        for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
        // Flashing light bar.
        const on = Math.floor(G.time * 6) % 2 === 0;
        if (mesh.userData.lightBarL) mesh.userData.lightBarL.material.color.setHex(on ? 0xff2222 : 0x551111);
        if (mesh.userData.lightBarR) mesh.userData.lightBarR.material.color.setHex(on ? 0x2244ff : 0x111155);
      },
    };
    squad.push(car);
    G.vehicles.cars.push(car);
    return car;
  }

  function dropCop(car) {
    G.scene.remove(car.mesh);
    const i = squad.indexOf(car);
    if (i >= 0) squad.splice(i, 1);
    const j = G.vehicles.cars.indexOf(car);
    if (j >= 0) G.vehicles.cars.splice(j, 1);
  }

  const police = {
    get stars() {
      return stars;
    },
    list: squad,
    commitCrime(amount, message) {
      if (amount <= 0) return;
      stars = Math.min(HEAT.max, stars + amount);
      quietFor = 0;
      coolFor = 0;
      if (message) G.hud.flash(message);
      G.hud.setWanted(stars);
    },
    setStars(n) {
      stars = Math.max(0, Math.min(HEAT.max, n));
      quietFor = 0;
      G.hud.setWanted(stars);
    },
    update(dt) {
      const pp = G.player.pos;
      if (holdFor > 0) holdFor -= dt;
      // --- A wrecked police car is out of the chase: tow it away, and hold
      // its replacement for a few seconds so shooting a cop buys breathing room.
      for (const car of [...squad]) {
        if (car.health > 0) continue;
        dropCop(car);
        holdFor = HEAT.replaceDelay;
        G.hud.flash('You took out a police car — reinforcements are coming.');
      }
      // --- Spawn police to match the wanted level ---
      const want = HEAT.copsPerStar[stars];
      while (squad.length < want && holdFor <= 0) spawnCop();
      while (squad.length > want) dropCop(squad[squad.length - 1]);

      // --- Pursuit: follow the street grid toward the player ---
      // The target is a point on the grid, not the player: drive along the
      // street the player is farthest down, turn at the next intersection,
      // and only aim straight at the player when close enough to ram.
      let nearest = Infinity;
      for (const car of squad) {
        const dx = pp.x - car.pos.x;
        const dz = pp.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        let tx;
        let tz;
        if (dist < 12) {
          tx = pp.x;
          tz = pp.z;
        } else if (Math.abs(dx) > Math.abs(dz)) {
          tx = pp.x;
          tz = G.city.nearestStreetCoord(car.pos.z);
        } else {
          tx = G.city.nearestStreetCoord(car.pos.x);
          tz = pp.z;
        }
        const wantHeading = Math.atan2(tx - car.pos.x, tz - car.pos.z);
        const diff = clampAngle(wantHeading - car.heading);
        const topSpeed = Math.min(HEAT.copTop, 26 + stars * 2.5);
        // On foot, a close police car parks on the suspect instead of
        // orbiting at speed: that is what lets the 3-second bust land.
        const target = !G.player.inCar && dist < HEAT.parkClose
          ? Math.min(3, dist * 0.5)
          : (dist < 6 ? topSpeed * 0.55 : topSpeed);
        car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
        car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 3 * dt));
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        if (G.city.resolveCircle(car.pos, DRIVE.radius)) {
          car.speed *= 0.4;
        }
        if (dist < 3.6) {
          // Ram: damage the player, or their car.
          if (G.player.inCar && G.player.car) {
            G.vehicles.damageCar(G.player.car, 8 * dt * 2);
            G.player.car.speed *= 0.92;
          } else {
            G.player.damage(14 * dt);
          }
          if (Math.random() < dt * 2) G.audio.crash(0.7);
        }
        car.updateVisual();
      }

      // --- Busted: on foot, a police car sitting on the player ends the run ---
      if (!G.player.inCar && stars > 0 && nearest < HEAT.bustRange) {
        bustFor += dt;
        G.hud.setBustedProgress(bustFor / HEAT.bustTime);
        if (bustFor >= HEAT.bustTime) {
          G.gameOver('busted');
          return;
        }
      } else {
        bustFor = 0;
        G.hud.setBustedProgress(0);
      }

      // --- Heat decay: no crime and no police close by, stars fall one by one ---
      if (stars > 0) {
        if (nearest > 70) {
          quietFor += dt;
          if (quietFor > HEAT.quiet) {
            coolFor += dt;
            if (coolFor > HEAT.step) {
              coolFor = 0;
              stars -= 1;
              G.hud.setWanted(stars);
              G.hud.flash('You lost a star — heat is cooling off.');
            }
          }
        } else {
          quietFor = 0;
          coolFor = 0;
        }
      }
    },
    reset() {
      stars = 0;
      quietFor = 0;
      coolFor = 0;
      bustFor = 0;
      holdFor = 0;
      for (const car of [...squad]) dropCop(car);
      G.hud.setWanted(0);
      G.hud.setBustedProgress(0);
    },
  };
  return police;
}
