// Costa Verde v3 — combat: a simple pistol. Click to fire a hitscan shot
// from the player toward where the camera looks; pedestrians and police cars
// take damage, the world answers with a flash, a crack and a little shake.

import * as THREE from 'three';
import { GUN } from './config.js';

export function createCombat(G) {
  const ray = new THREE.Raycaster();
  ray.far = GUN.range;
  let ammo = GUN.mag;
  let spare = 60;
  let reloadLeft = 0;
  let flashLeft = 0;

  // A small glowing sphere at the muzzle, shown for a blink after each shot.
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }),
  );
  flash.visible = false;
  G.scene.add(flash);

  // Buildings block shots: collect them once (they never move). A bullet
  // that hits one stops there instead of passing through to a target behind it.
  const walls = [];
  G.city.group.traverse((obj) => {
    if (obj.userData && obj.userData.w !== undefined && obj.userData.h !== undefined) walls.push(obj);
  });

  function findCarFor(mesh) {
    for (const car of G.vehicles.cars) {
      if (car.mesh === mesh || car.mesh.children.includes(mesh)) return car;
    }
    return null;
  }

  const combat = {
    get ammo() {
      return ammo;
    },
    get reserve() {
      return spare;
    },
    get reloading() {
      return reloadLeft > 0;
    },
    shoot() {
      if (G.state !== 'play' || G.player.dead || G.player.inCar) return;
      if (reloadLeft > 0) return;
      if (ammo <= 0) {
        combat.reload();
        return;
      }
      ammo -= 1;
      G.audio.gunshot();
      // Aim from the player's chest, along the camera's view direction
      // flattened to horizontal: the camera pitches down at the player, so
      // its raw forward ray would dig into the ground a few metres ahead
      // and never reach a target. A level ray from chest height does.
      const origin = G.player.pos.clone();
      origin.y = 1.2;
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 0.0001) dir.set(Math.sin(G.player.heading), 0, Math.cos(G.player.heading));
      dir.normalize();
      ray.set(origin, dir);
      // Hit the nearest pedestrian, police car, building or parked car.
      const targets = [];
      for (const ped of G.peds.list) {
        if (ped.state !== 'down') targets.push(ped.mesh);
      }
      for (const car of G.police.list) targets.push(car.mesh);
      for (const car of G.vehicles.cars) {
        if (car.kind === 'traffic' || car.kind === 'parked') targets.push(car.mesh);
      }
      const hits = ray.intersectObjects([...targets, ...walls], true);
      let struck = false;
      if (hits.length > 0) {
        const hit = hits[0];
        struck = true;
        const point = hit.point;
        const isWall = walls.includes(hit.object) || walls.includes(hit.object.parent);
        if (isWall) {
          // A building stopped the bullet: noise and a scare, no damage.
          G.peds.scare(point.x, point.z, 25);
        } else {
          G.peds.scare(point.x, point.z, 25);
          // Which pedestrian or car did the bullet reach?
          let pedHit = null;
          for (const ped of G.peds.list) {
            if (ped.mesh === hit.object || ped.mesh.children.includes(hit.object)) pedHit = ped;
          }
          if (pedHit) {
            pedHit.health -= GUN.damage;
            if (pedHit.health <= 0) {
              G.peds.knockDown(pedHit);
              G.police.commitCrime(1, 'You shot a pedestrian!');
            } else {
              pedHit.state = 'flee';
              pedHit.timer = 3;
            }
          } else {
            const carHit = findCarFor(hit.object);
            if (carHit) {
              if (carHit.kind === 'police') {
                G.vehicles.damageCar(carHit, GUN.damage);
                G.police.commitCrime(1, 'You shot at the police!');
              } else {
                G.vehicles.damageCar(carHit, GUN.damage * 0.5);
              }
            }
          }
        }
      }
      // Muzzle flash at the player's hand, plus a tracer line that fades fast.
      const hand = G.player.pos.clone();
      hand.y = 1.3;
      hand.x += Math.sin(G.player.heading) * 0.5;
      hand.z += Math.cos(G.player.heading) * 0.5;
      flash.position.copy(hand);
      flash.visible = true;
      flash.material.opacity = 1;
      flashLeft = 0.06;
      G.hud.kickCamera();
      if (!struck) G.peds.scare(G.player.pos.x, G.player.pos.z, 20);
      G.hud.setAmmo(ammo, spare);
    },
    reload() {
      if (reloadLeft > 0 || ammo === GUN.mag || spare <= 0) return;
      reloadLeft = GUN.reload;
      G.hud.setAmmo(ammo, spare, true);
    },
    update(dt) {
      if (reloadLeft > 0) {
        reloadLeft -= dt;
        if (reloadLeft <= 0) {
          const need = GUN.mag - ammo;
          const take = Math.min(need, spare);
          ammo += take;
          spare -= take;
          G.hud.setAmmo(ammo, spare);
        }
      }
      if (flashLeft > 0) {
        flashLeft -= dt;
        flash.material.opacity = Math.max(0, flashLeft / 0.06);
        if (flashLeft <= 0) flash.visible = false;
      }
    },
    reset() {
      ammo = GUN.mag;
      spare = 60;
      reloadLeft = 0;
      G.hud.setAmmo(ammo, spare);
    },
  };
  return combat;
}
