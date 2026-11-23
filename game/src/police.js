// Costa Verde — the wanted level and the Costa Verde Police Department.
// Crimes raise the stars; police cars spawn at the city edge, chase the
// player and ram them; stay out of sight and the heat cools off.

import * as THREE from 'three';
import { AVENUES, DRIVE, HEAT, between, clamp, pickOne, wrapAngle } from './config.js';
import { buildCar } from './vehicles.js';

// A police car is a white car with a light bar and CVPD doors. The light
// bar flashes by toggling the emissive colour of two small boxes.
function dressAsCop(car) {
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.18, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  lightBar.position.set(0, 1.66, -0.3);
  car.mesh.add(lightBar);
  const bulbGeo = new THREE.BoxGeometry(0.5, 0.14, 0.4);
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd92b1f, emissive: 0xd92b1f, emissiveIntensity: 0.6 });
  const blueMat = new THREE.MeshLambertMaterial({ color: 0x2e6fc2, emissive: 0x2e6fc2, emissiveIntensity: 0.6 });
  const red = new THREE.Mesh(bulbGeo, redMat);
  red.position.set(-0.3, 1.72, -0.3);
  const blue = new THREE.Mesh(bulbGeo, blueMat);
  blue.position.set(0.3, 1.72, -0.3);
  car.mesh.add(red);
  car.mesh.add(blue);
  return { red, blue };
}

export function createPolice(G) {
  const rng = G.rng;
  const list = [];
  let stars = 0;
  let quietFor = 0;
  let coolFor = 0;
  let bustFor = 0;
  let replaceAt = 0;

  // The four city edges; a new unit arrives from one of them, near the
  // player's current street so it does not take forever to reach the chase.
  const EDGES = [
    () => ({ x: clamp(G.player.pos.x, -260, 260), z: -280 }),
    () => ({ x: clamp(G.player.pos.x, -260, 260), z: 280 }),
    () => ({ x: -280, z: clamp(G.player.pos.z, -260, 260) }),
    () => ({ x: 280, z: clamp(G.player.pos.z, -260, 260) }),
  ];

  function spawnUnit() {
    const spot = pickOne(rng, EDGES)();
    const mesh = buildCar(rng, 0xe8e8e8);
    mesh.position.set(spot.x, 0, spot.z);
    G.scene.add(mesh);
    const car = {
      mesh,
      pos: mesh.position,
      heading: 0,
      speed: 0,
      target: 0,
      health: DRIVE.hp,
      wrecked: false,
      isCop: true,
      steer: 0,
      pause: 0,
      name: 'CVPD Unit',
    };
    const lights = dressAsCop(car);
    car.lights = lights;
    list.push(car);
    return car;
  }

  // One police car, one frame. It drives toward the player, steering around
  // buildings by turning; it slows down near the player, and if the player
  // is on foot and standing still it creeps to a stop close by, so a bust
  // can actually happen. A destroyed unit is towed away, and a replacement
  // arrives after the delay.
  function chase(unit, dt) {
    if (unit.wrecked) return;
    const target = G.player.inCar && G.player.car ? G.player.car.pos : G.player.pos;
    const gap = Math.hypot(target.x - unit.pos.x, target.z - unit.pos.z);
    const playerSpeed = G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) : Math.abs(G.player.speed);
    // A wrecked unit never chases; the reinforcement timer replaces it.
    let top = Math.min(HEAT.copTop, 18 + stars * 4 + playerSpeed * 0.55);
    if (gap < 10) top = Math.min(top, 8);
    if (!G.player.inCar && playerSpeed < 0.5 && gap < HEAT.parkClose) top = 0;
    if (gap < 2.5) top = Math.min(top, 2);
    unit.speed += (top - unit.speed) * Math.min(1, dt * 1.6);
    const desired = Math.atan2(target.x - unit.pos.x, target.z - unit.pos.z);
    let turn = wrapAngle(desired - unit.heading);
    // The city is a grid: turn in steps so the chase follows the streets.
    if (Math.abs(turn) > 1.2) turn = Math.sign(turn) * 1.2;
    unit.heading += turn * Math.min(1, dt * 1.5);
    const dx = Math.sin(unit.heading);
    const dz = Math.cos(unit.heading);
    const trial = new THREE.Vector3(
      unit.pos.x + dx * unit.speed * dt,
      0,
      unit.pos.z + dz * unit.speed * dt,
    );
    const hitWall = !G.city.resolveRect(trial, DRIVE.halfLen, DRIVE.halfWid, unit.heading);
    if (hitWall) {
      unit.heading += (rng() > 0.5 ? 1 : -1) * Math.PI / 2;
      unit.speed *= 0.4;
    } else {
      unit.pos.x = trial.x;
      unit.pos.z = trial.z;
    }
    // Ramming the player's car hurts it and the player; ramming the player
    // on foot hurts the player directly.
    if (gap < 3.5 && unit.speed > 3) {
      if (G.player.inCar && G.player.car) {
        G.player.car.health = Math.max(0, G.player.car.health - 6);
        G.player.damage(4);
      } else {
        G.player.damage(10);
      }
      G.audio.crash(unit.speed / 20);
      unit.speed *= 0.4;
    }
    if (G.player.inCar && G.player.car && G.player.car.health <= 0) {
      G.player.car.wrecked = true;
      G.hud.flash('Your car is wrecked — get out and find another');
      G.vehicles.exitCar();
    }
    unit.mesh.rotation.y = unit.heading;
    // The light bar alternates red and blue twice a second.
    const on = Math.floor(G.time * 2) % 2 === 0;
    unit.lights.red.material.emissiveIntensity = on ? 1 : 0.1;
    unit.lights.blue.material.emissiveIntensity = on ? 0.1 : 1;
  }

  // Stars cool off only while the police cannot see the player: out of
  // sight behind a building, or far enough away, for long enough.
  function coolDown(dt) {
    const nearest = list.length ? Math.min(...list.map((c) => Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z))) : Infinity;
    const hidden = G.city.blocksSight(G.player.pos, list[0]?.pos) || nearest > 60;
    if (hidden) {
      quietFor += dt;
      if (quietFor >= HEAT.quiet) {
        coolFor += dt;
        if (coolFor >= HEAT.step) {
          coolFor = 0;
          stars = Math.max(0, stars - 1);
          G.hud.setWanted(stars);
          if (stars === 0) {
            for (const unit of list) {
              if (!unit.wrecked) {
                G.scene.remove(unit.mesh);
                list.splice(list.indexOf(unit), 1);
              }
            }
          }
        }
      }
    } else {
      quietFor = 0;
      coolFor = 0;
    }
  }

  const api = {
    list,
    get wanted() { return stars; },
    get stars() { return stars; },
    // Set the wanted level directly (tests and screenshots); clearing it
    // also sends the units home.
    setStars(n) {
      stars = Math.max(0, Math.min(HEAT.max, n));
      quietFor = 0;
      coolFor = 0;
      bustFor = 0;
      G.hud.setWanted(stars);
      G.hud.setBustedProgress(0);
      if (stars === 0) {
        for (const unit of list) G.scene.remove(unit.mesh);
        list.length = 0;
      }
    },
    addHeat(amount, why) {
      const before = stars;
      stars = Math.min(HEAT.max, stars + amount);
      if (stars !== before) {
        G.hud.setWanted(stars);
        if (stars > 0 && before === 0) G.hud.flash(`Wanted level ${stars} — ${why}`);
      }
    },
    update(dt) {
      const wantedCount = HEAT.copsPerStar[stars];
      while (list.length < wantedCount) spawnUnit();
      if (stars > 0) {
        coolDown(dt);
        for (const unit of list) chase(unit, dt);
      } else {
        for (const unit of list) {
          unit.speed = 0;
          unit.mesh.rotation.y = unit.heading;
        }
      }
      // A destroyed police car is towed away; a replacement unit arrives
      // after the delay, so the player gets a breather instead of a new car
      // spawning on top of them.
      for (const unit of [...list]) {
        if (unit.wrecked) {
          G.scene.remove(unit.mesh);
          list.splice(list.indexOf(unit), 1);
          replaceAt = G.time + HEAT.replaceDelay;
        }
      }
      if (replaceAt > 0 && G.time >= replaceAt && stars > 0 && list.length < HEAT.copsPerStar[stars]) {
        replaceAt = 0;
        spawnUnit();
      }
      // BUSTED: a cop close to a player on foot, for three seconds running.
      if (stars > 0 && !G.player.inCar && !G.player.dead) {
        const nearest = list.length ? Math.min(...list.map((c) => Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z))) : Infinity;
        if (nearest < HEAT.bustRange) {
          bustFor += dt;
          G.hud.setBustedProgress(bustFor / HEAT.bustTime);
          if (bustFor >= HEAT.bustTime) {
            bustFor = 0;
            G.hud.setBustedProgress(0);
            G.gameOver('busted');
          }
        } else {
          bustFor = 0;
          G.hud.setBustedProgress(0);
        }
      } else {
        bustFor = 0;
        G.hud.setBustedProgress(0);
      }
    },
    reset() {
      stars = 0;
      quietFor = 0;
      coolFor = 0;
      bustFor = 0;
      replaceAt = 0;
      for (const unit of list) G.scene.remove(unit.mesh);
      list.length = 0;
      G.hud.setWanted(0);
      G.hud.setBustedProgress(0);
    },
  };
  return api;
}
