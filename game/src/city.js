// Costa Verde v3 — the city: ground, roads, buildings, palms, streetlights
// and the named places the jobs use. Procedural boxes with canvas textures,
// built once from a seeded RNG so a seed rebuilds the same city.

import * as THREE from 'three';
import { AVENUES, BLOCK_CENTRES, BLOCK_SPAN, CITY_EDGE, GRID_STEP, ROAD_HALF, SKY, between, pickOne } from './config.js';
import { awningTexture, facadeTexture, pavementTexture, roadTexture, roofTexture, sandTexture } from './textures.js';

const WALL_COLOURS = ['#c98f5f', '#b7a98a', '#8fa8b8', '#c9b18a', '#a87f6a', '#7f9e8a', '#d9c9a3', '#9a8fa8'];
const LEAF = 0x3f8f4f;
const TRUNK = 0x8a6a4a;

function solidBox(w, h, d, colour, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: colour }));
  m.position.set(x, y, z);
  return m;
}

// A building: a box whose sides carry a facade and whose top is a roof.
function buildTower(rng, w, d, h, face, top) {
  const side = new THREE.MeshLambertMaterial({ map: face });
  const cap = new THREE.MeshLambertMaterial({ map: top });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, cap, cap, side, side]);
  m.userData = { w, d, h };
  return m;
}

// A palm: a leaning trunk, a crown of flat leaves and a nut cluster.
function buildPalm(rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, 4.6, 6),
    new THREE.MeshLambertMaterial({ color: TRUNK }),
  );
  trunk.position.y = 2.3;
  trunk.rotation.z = between(rng, -0.08, 0.08);
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: LEAF, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 6) * Math.PI * 2 + rng() * 0.4;
    leaf.position.set(Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1);
    leaf.rotation.set(-0.95, -a, 0, 'YXZ');
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
  nuts.position.y = 4.45;
  g.add(nuts);
  return g;
}

// A streetlight: pole, arm and a glowing head. No real light — the bright
// head reads as lit in daylight and costs nothing.
function buildLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  pole.position.y = 2.7;
  g.add(pole);
  g.add(solidBox(1.6, 0.1, 0.1, 0x3a3f46, 0.8, 5.35, 0));
  const head = solidBox(0.7, 0.14, 0.3, 0xfff6c9, 1.5, 5.3, 0);
  head.material = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  g.add(head);
  return g;
}

export function createCity(scene, rng) {
  const walls = []; // {minX,maxX,minZ,maxZ} — buildings only; cars handle their own
  const group = new THREE.Group();
  scene.add(group);

  const roadTex = roadTexture(rng);
  const paveTex = pavementTexture(rng);
  const sandTex = sandTexture(rng);

  // Ground slab: sand everywhere, so the beach edge and the marina read as coast.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 260, CITY_EDGE * 2 + 260),
    new THREE.MeshLambertMaterial({ map: sandTex, color: 0xd9c48f }),
  );
  ground.material.map.repeat.set(40, 40);
  ground.material.map.wrapS = THREE.RepeatWrapping;
  ground.material.map.wrapT = THREE.RepeatWrapping;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // Roads: one long strip per avenue, both directions, dashed centre line.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of AVENUES) {
    for (const across of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EDGE * 2, ROAD_HALF * 2), roadMat.clone());
      strip.material.map = roadTex.clone();
      strip.material.map.needsUpdate = true;
      strip.material.map.repeat.set(Math.ceil((CITY_EDGE * 2) / 14), 1);
      strip.rotation.x = -Math.PI / 2;
      if (!across) strip.rotation.z = Math.PI / 2;
      strip.position.set(across ? 0 : s, 0, across ? s : 0);
      group.add(strip);
    }
  }

  // Pavement slabs fill each block's edge so blocks read as raised pavement.
  const paveMat = new THREE.MeshLambertMaterial({ map: paveTex });
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK_SPAN + 4, BLOCK_SPAN + 4), paveMat.clone());
      slab.material.map = paveTex.clone();
      slab.material.map.needsUpdate = true;
      slab.material.map.repeat.set(6, 6);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx, 0.02, bz);
      group.add(slab);
    }
  }

  // Buildings: 1–4 per block, heights 8–42, warm coastal facades.
  const faces = [];
  for (let i = 0; i < 10; i += 1) {
    faces.push(facadeTexture(rng, pickOne(rng, WALL_COLOURS), 3 + Math.floor(rng() * 5), 4 + Math.floor(rng() * 3)));
  }
  const roofs = [];
  for (let i = 0; i < 4; i += 1) roofs.push(roofTexture(rng));
  const awns = [];
  for (let i = 0; i < 4; i += 1) awns.push(awningTexture(rng));

  const spots = [];
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      const n = 1 + Math.floor(rng() * 3);
      if (n === 1) {
        spots.push({ x: bx, z: bz, w: BLOCK_SPAN * 0.72, d: BLOCK_SPAN * 0.72 });
      } else if (n === 2) {
        const up = rng() > 0.5;
        for (const off of [-BLOCK_SPAN * 0.26, BLOCK_SPAN * 0.26]) {
          spots.push({
            x: up ? bx + off : bx,
            z: up ? bz : bz + off,
            w: up ? BLOCK_SPAN * 0.42 : BLOCK_SPAN * 0.72,
            d: up ? BLOCK_SPAN * 0.72 : BLOCK_SPAN * 0.42,
          });
        }
      } else {
        for (const ox of [-BLOCK_SPAN * 0.26, BLOCK_SPAN * 0.26]) {
          for (const oz of [-BLOCK_SPAN * 0.26, BLOCK_SPAN * 0.26]) {
            spots.push({ x: bx + ox, z: bz + oz, w: BLOCK_SPAN * 0.42, d: BLOCK_SPAN * 0.42 });
          }
        }
      }
    }
  }
  for (const spot of spots) {
    const h = 8 + rng() * rng() * 34; // mostly low, a few towers
    const tower = buildTower(rng, spot.w, spot.d, h, pickOne(rng, faces), pickOne(rng, roofs));
    tower.position.set(spot.x, h / 2, spot.z);
    group.add(tower);
    walls.push({
      minX: spot.x - spot.w / 2,
      maxX: spot.x + spot.w / 2,
      minZ: spot.z - spot.d / 2,
      maxZ: spot.z + spot.d / 2,
    });
    // Awnings on about a third of ground floors, facing a random street.
    if (rng() < 0.35) {
      const awn = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(spot.w, 14), 2.2),
        new THREE.MeshLambertMaterial({ map: pickOne(rng, awns) }),
      );
      const face = Math.floor(rng() * 4);
      const y = 3.4;
      if (face === 0) { awn.position.set(spot.x, y, spot.z + spot.d / 2 + 0.1); }
      else if (face === 1) { awn.position.set(spot.x, y, spot.z - spot.d / 2 - 0.1); awn.rotation.y = Math.PI; }
      else if (face === 2) { awn.position.set(spot.x + spot.w / 2 + 0.1, y, spot.z); awn.rotation.y = Math.PI / 2; }
      else { awn.position.set(spot.x - spot.w / 2 - 0.1, y, spot.z); awn.rotation.y = -Math.PI / 2; }
      group.add(awn);
    }
  }

  // Palms line the sidewalks along every avenue, every other block.
  for (const s of AVENUES) {
    for (const b of BLOCK_CENTRES) {
      if (Math.abs(b) % 140 < 70) {
        const p1 = buildPalm(rng);
        p1.position.set(s + ROAD_HALF + 2.5, 0, b);
        p1.rotation.y = rng() * Math.PI * 2;
        group.add(p1);
        const p2 = buildPalm(rng);
        p2.position.set(b, 0, s + ROAD_HALF + 2.5);
        p2.rotation.y = rng() * Math.PI * 2;
        group.add(p2);
      }
    }
  }

  // Streetlights at every other intersection corner.
  for (let i = 0; i < AVENUES.length; i += 2) {
    for (let j = 0; j < AVENUES.length; j += 2) {
      const lamp = buildLamp();
      lamp.position.set(AVENUES[i] + ROAD_HALF + 0.6, 0, AVENUES[j] - ROAD_HALF - 0.6);
      lamp.rotation.y = Math.PI / 2;
      group.add(lamp);
    }
  }

  // The marina: a strip of water at the south edge, with a wooden pier.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 260, 90),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.03, CITY_EDGE + 45);
  group.add(water);
  group.add(solidBox(10, 0.4, 46, 0x7a5c3a, 140, 0.2, CITY_EDGE + 22));

  // Named places the jobs point at (all on streets, easy to reach).
  const places = {
    garage: { x: -210, z: 70, label: "Mara's Garage" },
    store: { x: 70, z: -140, label: 'Sunrise Mart' },
    marina: { x: 140, z: 280, label: 'Marina' },
    hideout: { x: -280, z: -210, label: 'Hideout' },
    coralAve: { x: 0, z: 140, label: 'Coral Ave' },
    palmRow: { x: -70, z: 0, label: 'Palm Row' },
  };

  // A glowing beacon column marks an active job target; built once, moved by jobs.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  return {
    group,
    colliders: walls,
    beacon,
    places,
    // Push a circle out of every building it overlaps; returns true on a hit.
    resolveCircle(pos, radius) {
      let hit = false;
      for (const c of walls) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          } else {
            pos.x = c.maxX + radius;
          }
        }
      }
      // Keep everyone inside the city (the marina water stops the player at the south edge).
      const limit = CITY_EDGE - 2;
      if (pos.x < -limit) pos.x = -limit;
      if (pos.x > limit) pos.x = limit;
      if (pos.z < -limit) pos.z = -limit;
      if (pos.z > CITY_EDGE - 4) pos.z = CITY_EDGE - 4;
      return hit;
    },
    isOnRoad(x, z) {
      for (const s of AVENUES) {
        if (Math.abs(x - s) < ROAD_HALF || Math.abs(z - s) < ROAD_HALF) return true;
      }
      return false;
    },
    nearestStreetCoord(v) {
      let best = AVENUES[0];
      for (const s of AVENUES) {
        if (Math.abs(s - v) < Math.abs(best - v)) best = s;
      }
      return best;
    },
  };
}

export { GRID_STEP, SKY };
