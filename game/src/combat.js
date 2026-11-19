// Costa Verde — combat: a simple pistol. Click to fire a hitscan shot from the
// player toward the camera aim point; pedestrians and police cars take damage,
// the world answers with a flash, a crack and a little shake.
import * as THREE from 'three';
import { COMBAT } from './config.js';

export function createCombat(G) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = COMBAT.pistolRange;
  let ammo = COMBAT.magSize;
  let reserve = 60;
  let reloadTimer = 0;
  let flashTimer = 0;

  // A small glowing sphere at the muzzle, shown for a blink after each shot.
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }),
  );
  flash.visible = false;
  G.scene.add(flash);

  const combat = {
    get ammo() {
      return ammo;
    },
    get reserve() {
      return reserve;
    },
    get reloading() {
      return reloadTimer > 0;
    },
    shoot() {
      if (G.state !== 'play' || G.player.dead || G.player.inCar) return;
      if (reloadTimer > 0) return;
      if (ammo <= 0) {
        combat.reload();
        return;
      }
      ammo -= 1;
      G.audio.gunshot();
      // Aim from the camera through the centre of the screen.
      const origin = G.camera.position.clone();
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      raycaster.set(origin, dir);
      // The player's own figure is at the centre of the aim: start the ray past it.
      raycaster.ray.origin.addScaledVector(dir, 2.5);
      // Hit the nearest pedestrian, police car or building.
      const targets = [];
      for (const ped of G.peds.list) {
        if (ped.state !== 'down') targets.push(ped.mesh);
      }
      for (const car of G.police.list) targets.push(car.mesh);
      for (const car of G.vehicles.cars) {
        if (car.kind === 'traffic' || car.kind === 'parked') targets.push(car.mesh);
      }
      const hits = raycaster.intersectObjects(targets, true);
      let hitSomething = false;
      if (hits.length > 0) {
        const hit = hits[0];
        hitSomething = true;
        let obj = hit.object;
        while (obj && !obj.userData.pedRef && !obj.userData.carRef) obj = obj.parent;
        const point = hit.point;
        G.peds.scare(point.x, point.z, 25);
        // Find which pedestrian or car the hit belongs to.
        let pedHit = null;
        for (const ped of G.peds.list) {
          if (ped.mesh === hit.object || ped.mesh.children.includes(hit.object) || ped.mesh === obj) pedHit = ped;
        }
        if (pedHit) {
          pedHit.health -= COMBAT.pistolDamage;
          if (pedHit.health <= 0) {
            G.peds.knockDown(pedHit);
            G.police.commitCrime(1, 'You shot a pedestrian!');
          } else {
            pedHit.state = 'flee';
            pedHit.timer = 3;
          }
        } else {
          // A car took the bullet: damage it, and the police notice.
          for (const car of G.vehicles.cars) {
            if (car.mesh === hit.object || car.mesh === obj || car.mesh.children.includes(hit.object)) {
              if (car.kind === 'police') {
                G.vehicles.damageCar(car, COMBAT.pistolDamage);
                G.police.commitCrime(1, 'You shot at the police!');
              } else {
                G.vehicles.damageCar(car, COMBAT.pistolDamage * 0.5);
              }
              break;
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
      flashTimer = 0.06;
      G.hud.kickCamera();
      if (!hitSomething) G.peds.scare(G.player.pos.x, G.player.pos.z, 20);
      G.hud.setAmmo(ammo, reserve);
    },
    reload() {
      if (reloadTimer > 0 || ammo === COMBAT.magSize || reserve <= 0) return;
      reloadTimer = COMBAT.reloadSeconds;
      G.hud.setAmmo(ammo, reserve, true);
    },
    update(dt) {
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          const need = COMBAT.magSize - ammo;
          const take = Math.min(need, reserve);
          ammo += take;
          reserve -= take;
          G.hud.setAmmo(ammo, reserve);
        }
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        flash.material.opacity = Math.max(0, flashTimer / 0.06);
        if (flashTimer <= 0) flash.visible = false;
      }
    },
    reset() {
      ammo = COMBAT.magSize;
      reserve = 60;
      reloadTimer = 0;
      G.hud.setAmmo(ammo, reserve);
    },
  };
  return combat;
}
