// Costa Verde — the city itself: sand, roads, buildings, palms, lamps and
// the named places the jobs point at. Boxes with canvas textures, built once
// from a seeded RNG, so a seed rebuilds the same city every time.

import * as THREE from 'three';
import { AVENUES, BLOCK_CENTRES, BLOCK_SPAN, CITY_EDGE, GRID_STEP, ROAD_HALF, SKY, between, pickOne } from './config.js';
import { awningTexture, facadeTexture, pavementTexture, roadTexture, roofTexture, sandTexture } from './textures.js';

// The ground: one sand plane, then road and pavement planes on top of it.
function layGround(scene, rng) {
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 400, CITY_EDGE * 2 + 400),
    new THREE.MeshLambertMaterial({ map: sandTexture(rng) }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);

  const roadTex = roadTexture(rng);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const paveTex = pavementTexture(rng);
  const paveMat = new THREE.MeshLambertMaterial({ map: paveTex });
  for (const s of AVENUES) {
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, CITY_EDGE * 2), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(s, 0.02, 0);
    roadV.receiveShadow = true;
    scene.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EDGE * 2, ROAD_HALF * 2), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0.02, s);
    roadH.receiveShadow = true;
    scene.add(roadH);
    // Pavement strips run beside every road.
    for (const off of [-ROAD_HALF - 3, ROAD_HALF + 3]) {
      const paveV = new THREE.Mesh(new THREE.PlaneGeometry(6, CITY_EDGE * 2), paveMat);
      paveV.rotation.x = -Math.PI / 2;
      paveV.position.set(s + off, 0.015, 0);
      paveV.receiveShadow = true;
      scene.add(paveV);
      const paveH = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EDGE * 2, 6), paveMat);
      paveH.rotation.x = -Math.PI / 2;
      paveH.position.set(0, 0.015, s + off);
      paveH.receiveShadow = true;
      scene.add(paveH);
    }
  }
}

// One building: a textured box, a roof cap, and sometimes a striped awning
// at street level. Every building is recorded as a solid for collision.
function raiseBuilding(scene, solids, rng, x, z, w, d, h, facadeMat, roofMat, awnMat) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facadeMat);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), roofMat);
  cap.position.set(x, h + 0.3, z);
  cap.castShadow = true;
  scene.add(cap);
  if (rng() > 0.6) {
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.2, 2.4), awnMat);
    awn.position.set(x, 3.2, z + d / 2 + 1);
    scene.add(awn);
  }
  solids.push(body);
}

// The blocks: 1–4 buildings per block, placed on a jittered sub-grid.
function placeBuildings(scene, solids, rng, facadeMat, roofMat, awnMat) {
  for (const cx of BLOCK_CENTRES) {
    for (const cz of BLOCK_CENTRES) {
      const count = 1 + Math.floor(rng() * 4);
      for (let i = 0; i < count; i += 1) {
        const subX = cx + (rng() - 0.5) * (BLOCK_SPAN - 18);
        const subZ = cz + (rng() - 0.5) * (BLOCK_SPAN - 18);
        const w = 12 + rng() * 10;
        const d = 12 + rng() * 10;
        const h = 8 + rng() * 22;
        raiseBuilding(scene, solids, rng, subX, subZ, w, d, h, facadeMat, roofMat, awnMat);
      }
    }
  }
}

// Palms along the avenues and lamps at the intersections.
function plantStreetFurniture(scene, rng) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7d3a });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe08a, emissiveIntensity: 0.4 });
  for (const s of AVENUES) {
    for (const t of BLOCK_CENTRES) {
      if (rng() > 0.5) {
        const palm = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), trunkMat);
        trunk.position.y = 3.5;
        trunk.castShadow = true;
        palm.add(trunk);
        for (let k = 0; k < 6; k += 1) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
          const angle = (k / 6) * Math.PI * 2;
          leaf.position.set(Math.cos(angle) * 1.2, 7.2, Math.sin(angle) * 1.2);
          leaf.rotation.z = Math.cos(angle) * 1.1;
          leaf.rotation.x = -Math.sin(angle) * 1.1;
          palm.add(leaf);
        }
        palm.position.set(s + (rng() > 0.5 ? 10 : -10), 0, t);
        scene.add(palm);
      }
      // A lamp at every intersection corner.
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8), poleMat);
      pole.position.set(s + 8, 2.5, t + 8);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(s + 8, 5.1, t + 8);
      scene.add(bulb);
    }
  }
}

// The named places: the garage, the mart, the marina and the hideout. Each
// is a bigger, coloured box so the player can find it at a glance.
function buildLandmarks(scene, solids, rng) {
  const spots = [
    { x: 0, z: 20, w: 30, d: 18, h: 10, color: 0x2e6fc2, name: 'garage' },
    { x: 210, z: -210, w: 26, d: 20, h: 9, color: 0xd94f3d, name: 'mart' },
    { x: 280, z: 280, w: 24, d: 24, h: 8, color: 0x4f9e57, name: 'marina' },
    { x: -280, z: 280, w: 22, d: 22, h: 8, color: 0x8a5a9e, name: 'hideout' },
  ];
  for (const spot of spots) {
    const mat = new THREE.MeshLambertMaterial({ color: spot.color });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(spot.w, spot.h, spot.d), mat);
    mesh.position.set(spot.x, spot.h / 2, spot.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
  }
}

export function createCity(G) {
  const rng = G.rng;
  const scene = G.scene;
  scene.background = new THREE.Color(SKY.sky);
  scene.fog = new THREE.Fog(SKY.fog, SKY.fogNear, SKY.fogFar);
  const sun = new THREE.DirectionalLight(SKY.sun, SKY.sunPower);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(SKY.hemiTop, SKY.hemiBottom, SKY.hemiPower));

  const solids = [];
  const facadeMat = new THREE.MeshLambertMaterial({ map: facadeTexture(rng) });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture(rng) });
  const awnMat = new THREE.MeshLambertMaterial({ map: awningTexture(rng) });
  layGround(scene, rng);
  placeBuildings(scene, solids, rng, facadeMat, roofMat, awnMat);
  plantStreetFurniture(scene, rng);
  buildLandmarks(scene, solids, rng);

  // --- Collision -----------------------------------------------------------
  // Buildings are axis-aligned boxes; a moving circle is pushed out of any
  // it overlaps. A moving rectangle (a car) is tested at its four corners.
  function pushOutOfBox(pos, radius, box) {
    const halfW = box.geometry.parameters.width / 2;
    const halfD = box.geometry.parameters.depth / 2;
    const cx = Math.max(box.position.x - halfW, Math.min(pos.x, box.position.x + halfW));
    const cz = Math.max(box.position.z - halfD, Math.min(pos.z, box.position.z + halfD));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        pos.x = box.position.x + halfW + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
      return true;
    }
    return false;
  }

  function collide(pos, radius) {
    let hit = false;
    for (const box of solids) {
      if (pushOutOfBox(pos, radius, box)) hit = true;
    }
    return hit;
  }

  const api = {
    solids,
    resolveCircle(pos, radius) {
      collide(pos, radius);
      pos.x = Math.max(-CITY_EDGE, Math.min(CITY_EDGE, pos.x));
      pos.z = Math.max(-CITY_EDGE, Math.min(CITY_EDGE, pos.z));
      return true;
    },
    // Returns true if the car fits at (pos, heading); otherwise the car is
    // left where it was (the caller applies the bounce).
    resolveRect(pos, halfLen, halfWid, heading) {
      const c = Math.cos(heading);
      const s = Math.sin(heading);
      const corners = [
        [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid],
      ];
      for (const [lx, lz] of corners) {
        const probe = new THREE.Vector3(pos.x + lx * s + lz * c, 0, pos.z + lx * c - lz * s);
        if (collide(probe, 0.5)) return false;
      }
      pos.x = Math.max(-CITY_EDGE, Math.min(CITY_EDGE, pos.x));
      pos.z = Math.max(-CITY_EDGE, Math.min(CITY_EDGE, pos.z));
      return true;
    },
    // A line of sight between two points, blocked by any building it passes
    // through. Used by the police to decide whether the player is hidden.
    blocksSight(a, b) {
      if (!a || !b) return false;
      const steps = 20;
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        for (const box of solids) {
          const halfW = box.geometry.parameters.width / 2;
          const halfD = box.geometry.parameters.depth / 2;
          if (Math.abs(x - box.position.x) < halfW && Math.abs(z - box.position.z) < halfD) return true;
        }
      }
      return false;
    },
  };
  return api;
}
