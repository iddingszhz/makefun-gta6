// Costa Verde — combat: a simple pistol. Click to fire a hitscan shot
// from the player's chest, level with the ground, in the direction the
// camera faces. Pedestrians and police cars take damage, and the world
// answers with a flash, a crack and a little shake.

import * as THREE from 'three';
import { GUN } from './config.js';

// The aim direction: where the camera looks, flattened to the horizontal
// plane. A shot must not climb into the sky when the camera pitches down.
function aimDirection(G) {
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
  return dir.normalize();
}

// Every mesh a shot can hit, with the thing it belongs to and the damage
// it takes. Buildings are solid and stop the shot; people and cars are not.
function collectTargets(G) {
  const targets = [];
  for (const ped of G.peds.list) {
    if (ped.state === 'down') continue;
    const mesh = ped.mesh;
    targets.push({ mesh, kind: 'ped', ped, hp: ped.health });
    mesh.traverse((child) => {
      if (child.isMesh && child !== mesh) targets.push({ mesh: child, kind: 'ped', ped, hp: ped.health });
    });
  }
  for (const car of [...G.vehicles.traffic, ...G.vehicles.parked, ...G.police.list]) {
    if (car.wrecked) continue;
    targets.push({ mesh: car.mesh, kind: 'car', car, hp: car.health });
    car.mesh.traverse((child) => {
      if (child.isMesh) targets.push({ mesh: child, kind: 'car', car, hp: car.health });
    });
  }
  for (const solid of G.city.solids) {
    targets.push({ mesh: solid, kind: 'wall', hp: Infinity });
  }
  return targets;
}

export function createCombat(G) {
  const ray = new THREE.Raycaster();
  ray.far = GUN.range;
  const tracerGeo = new THREE.BufferGeometry();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd34d });
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  G.scene.add(tracer);
  let tracerLeft = 0;

  const combat = {
    ammo: GUN.mag,
    spare: 60,
    reloading: false,
    reloadLeft: 0,
    fire() {
      if (combat.reloading) return;
      if (combat.ammo <= 0) {
        combat.startReload();
        return;
      }
      combat.ammo -= 1;
      const dir = aimDirection(G);
      // The shot leaves from chest height, level — not from the pitched
      // camera — so a target 12 m away is actually hit.
      const origin = G.player.pos.clone();
      origin.y = 1.2;
      ray.set(origin, dir);
      const targets = collectTargets(G);
      const hits = ray.intersectObjects(targets.map((t) => t.mesh), true);
      const end = origin.clone().add(dir.clone().multiplyScalar(GUN.range));
      if (hits.length > 0) {
        const hit = hits[0];
        end.copy(hit.point);
        const entry = targets.find((t) => {
          let node = hit.object;
          while (node) {
            if (node === t.mesh) return true;
            node = node.parent;
          }
          return false;
        });
        if (entry && entry.kind !== 'wall') {
          if (entry.kind === 'ped') {
            entry.ped.health -= GUN.damage;
            G.peds.scare(entry.ped.pos.x, entry.ped.pos.z);
            if (entry.ped.health <= 0) {
              G.peds.knockDown(entry.ped);
              G.police.addHeat(1, 'Pedestrian shot');
            }
          } else if (entry.kind === 'car') {
            entry.car.health -= GUN.damage;
            if (entry.car.health <= 0) {
              entry.car.health = 0;
              entry.car.wrecked = true;
              entry.car.speed = 0;
              G.audio.crash(1);
              G.hud.flash(entry.car.isCop ? 'Police car destroyed — backup is coming' : 'Car destroyed');
              if (entry.car.isCop) G.police.addHeat(1, 'Police car destroyed');
            }
          }
        }
      }
      // A bright line from the muzzle to the impact point, gone in 60 ms.
      tracerGeo.setFromPoints([origin, end]);
      tracer.visible = true;
      tracerLeft = 0.06;
      G.audio.gunshot();
      G.hud.kickCamera();
      G.peds.scare(origin.x, origin.z, 30);
      if (combat.ammo === 0) combat.startReload();
    },
    startReload() {
      if (combat.reloading || combat.spare <= 0) return;
      combat.reloading = true;
      combat.reloadLeft = GUN.reload;
    },
    update(dt) {
      if (tracerLeft > 0) {
        tracerLeft -= dt;
        if (tracerLeft <= 0) tracer.visible = false;
      }
      if (combat.reloading) {
        combat.reloadLeft -= dt;
        if (combat.reloadLeft <= 0) {
          const load = Math.min(GUN.mag, combat.spare);
          combat.ammo = load;
          combat.spare -= load;
          combat.reloading = false;
        }
      }
    },
    reset() {
      combat.ammo = GUN.mag;
      combat.spare = 60;
      combat.reloading = false;
      combat.reloadLeft = 0;
      tracer.visible = false;
    },
  };
  return combat;
}
