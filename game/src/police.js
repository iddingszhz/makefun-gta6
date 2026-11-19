// Costa Verde — the wanted level and the Costa Verde Police Department.
// Crimes raise the stars; police cars spawn at the city edge, chase the player
// and ram them; stay out of sight and the heat cools off.
import * as THREE from 'three';
import { CAR, STREETS, WANTED, pick, range } from './config.js';
import { makeCar } from './vehicles.js';

export function createPolice(G) {
  const rng = G.rng;
  const policeCars = [];
  let stars = 0;
  let quietTimer = 0; // time since the last crime, while no police is near
  let decayTimer = 0;
  let bustedTimer = 0;

  const police = {
    get stars() {
      return stars;
    },
    list: policeCars,
    commitCrime(amount, message) {
      if (amount <= 0) return;
      stars = Math.min(WANTED.max, stars + amount);
      quietTimer = 0;
      decayTimer = 0;
      if (message) G.hud.flash(message);
      G.hud.setWanted(stars);
    },
    setStars(n) {
      stars = Math.max(0, Math.min(WANTED.max, n));
      quietTimer = 0;
      G.hud.setWanted(stars);
    },
    update(dt) {
      const playerPos = G.player.pos;
      // --- Spawn police to match the wanted level ---
      const want = WANTED.policePerStar[stars];
      while (policeCars.length < want) {
        const edge = pick(rng, ['n', 's', 'e', 'w']);
        let x = 0;
        let z = 0;
        if (edge === 'n') { x = range(rng, -260, 260); z = -270; }
        if (edge === 's') { x = range(rng, -260, 260); z = 270; }
        if (edge === 'e') { x = 270; z = range(rng, -260, 260); }
        if (edge === 'w') { x = -270; z = range(rng, -260, 260); }
        const mesh = makeCar(rng, 0, true);
        mesh.position.set(x, 0, z);
        G.scene.add(mesh);
        const car = {
          mesh,
          pos: mesh.position,
          heading: Math.atan2(playerPos.x - x, playerPos.z - z),
          speed: 0,
          steer: 0,
          health: CAR.maxHealth,
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
        policeCars.push(car);
        G.vehicles.cars.push(car);
      }
      while (policeCars.length > want) {
        const car = policeCars.pop();
        G.scene.remove(car.mesh);
        const i = G.vehicles.cars.indexOf(car);
        if (i >= 0) G.vehicles.cars.splice(i, 1);
      }

      // --- Pursuit: follow the street grid toward the player ---
      // The target is a point on the grid, not the player: drive along the
      // street the player is farthest down, turn at the next intersection,
      // and only aim straight at the player when close enough to ram.
      let nearest = Infinity;
      for (const car of policeCars) {
        const dx = playerPos.x - car.pos.x;
        const dz = playerPos.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        let tx;
        let tz;
        if (dist < 12) {
          tx = playerPos.x;
          tz = playerPos.z;
        } else if (Math.abs(dx) > Math.abs(dz)) {
          tx = playerPos.x;
          tz = G.city.nearestStreetCoord(car.pos.z);
        } else {
          tx = G.city.nearestStreetCoord(car.pos.x);
          tz = playerPos.z;
        }
        const wantHeading = Math.atan2(tx - car.pos.x, tz - car.pos.z);
        let diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const topSpeed = 26 + stars * 2.5;
        const target = dist < 6 ? topSpeed * 0.55 : topSpeed;
        car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
        car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 3 * dt));
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        if (G.city.resolveCircle(car.pos, CAR.radius)) {
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
      if (!G.player.inCar && stars > 0 && nearest < WANTED.bustedRange) {
        bustedTimer += dt;
        G.hud.setBustedProgress(bustedTimer / WANTED.bustedTime);
        if (bustedTimer >= WANTED.bustedTime) {
          G.gameOver('busted');
          return;
        }
      } else {
        bustedTimer = 0;
        G.hud.setBustedProgress(0);
      }

      // --- Heat decay: no crime and no police close by, stars fall one by one ---
      if (stars > 0) {
        if (nearest > 70) {
          quietTimer += dt;
          if (quietTimer > WANTED.decayDelay) {
            decayTimer += dt;
            if (decayTimer > WANTED.decayStep) {
              decayTimer = 0;
              stars -= 1;
              G.hud.setWanted(stars);
              G.hud.flash('You lost a star — heat is cooling off.');
            }
          }
        } else {
          quietTimer = 0;
          decayTimer = 0;
        }
      }
    },
    reset() {
      stars = 0;
      quietTimer = 0;
      decayTimer = 0;
      bustedTimer = 0;
      for (const car of [...policeCars]) {
        G.scene.remove(car.mesh);
        const i = G.vehicles.cars.indexOf(car);
        if (i >= 0) G.vehicles.cars.splice(i, 1);
      }
      policeCars.length = 0;
      G.hud.setWanted(0);
      G.hud.setBustedProgress(0);
    },
  };
  return police;
}
