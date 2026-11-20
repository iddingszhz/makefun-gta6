// Costa Verde — the city itself: ground, roads, buildings, palms, streetlights
// and the named places the missions use. Everything is procedural boxes with
// canvas textures, built once from a seeded RNG so a seed rebuilds the same city.
import * as THREE from 'three';
import { BLOCK, BLOCKS, CITY_HALF, PITCH, ROAD_HALF, STREETS, WORLD, pick, range } from './config.js';
import { makeAwningTexture, makeFacadeTexture, makeRoadTexture, makeRoofTexture, makeSandTexture, makeSidewalkTexture } from './textures.js';

const BUILDING_COLORS = ['#c98f5f', '#b7a98a', '#8fa8b8', '#c9b18a', '#a87f6a', '#7f9e8a', '#d9c9a3', '#9a8fa8'];
const PALM_LEAF = 0x3f8f4f;
const PALM_TRUNK = 0x8a6a4a;

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  return mesh;
}

// A building is a box whose sides carry a facade texture and whose top is a roof.
function makeBuilding(rng, w, d, h, facade, roof) {
  const side = new THREE.MeshLambertMaterial({ map: facade });
  const top = new THREE.MeshLambertMaterial({ map: roof });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  mesh.userData = { w, d, h };
  return mesh;
}

// A palm: a leaning trunk and a crown of flat leaves.
function makePalm(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, 4.6, 6),
    new THREE.MeshLambertMaterial({ color: PALM_TRUNK }),
  );
  trunk.position.y = 2.3;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALM_LEAF, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const angle = (i / 6) * Math.PI * 2 + rng() * 0.4;
    leaf.position.set(Math.cos(angle) * 1.1, 4.6, Math.sin(angle) * 1.1);
    leaf.rotation.set(-0.5, -angle + Math.PI / 2, 0, 'YXZ');
    leaf.rotation.y = -angle;
    leaf.rotation.x = -0.95;
    group.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
  nuts.position.y = 4.45;
  group.add(nuts);
  return group;
}

// A streetlight: pole, arm and a glowing head. No real light — the emissive
// head reads as lit in daylight and costs nothing.
function makeStreetlight() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  pole.position.y = 2.7;
  group.add(pole);
  const arm = box(1.6, 0.1, 0.1, 0x3a3f46, 0.8, 5.35, 0);
  group.add(arm);
  const head = box(0.7, 0.14, 0.3, 0xfff6c9, 1.5, 5.3, 0);
  head.material = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  group.add(head);
  return group;
}

export function createCity(scene, rng) {
  const colliders = []; // {minX, maxX, minZ, maxZ} — buildings only; cars handle their own
  const group = new THREE.Group();
  scene.add(group);

  const roadTex = makeRoadTexture(rng);
  const walkTex = makeSidewalkTexture(rng);
  const sandTex = makeSandTexture(rng);

  // Ground slab: sand everywhere, so the beach edge and the marina read as coast.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, CITY_HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ map: sandTex, color: 0xd9c48f }),
  );
  ground.material.map.repeat.set(40, 40);
  ground.material.map.wrapS = THREE.RepeatWrapping;
  ground.material.map.wrapT = THREE.RepeatWrapping;
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // Roads: one long strip per street, both directions, with a repeating dash texture.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of STREETS) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_HALF * 2), roadMat.clone());
      strip.material.map = roadTex.clone();
      strip.material.map.needsUpdate = true;
      strip.material.map.repeat.set(Math.ceil((CITY_HALF * 2) / 14), 1);
      strip.rotation.x = -Math.PI / 2;
      if (!horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(horizontal ? 0 : s, 0, horizontal ? s : 0);
      group.add(strip);
    }
  }

  // Sidewalk slabs fill each block's edge, so blocks read as raised pavement.
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), walkMat.clone());
      slab.material.map = walkTex.clone();
      slab.material.map.needsUpdate = true;
      slab.material.map.repeat.set(6, 6);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(bx, 0.02, bz);
      group.add(slab);
    }
  }

  // Buildings: 1–4 per block, heights 8–42, with facades in warm coastal colours.
  const facades = [];
  for (let i = 0; i < 10; i += 1) {
    facades.push(makeFacadeTexture(rng, pick(rng, BUILDING_COLORS), 3 + Math.floor(rng() * 5), 4 + Math.floor(rng() * 3)));
  }
  const roofs = [];
  for (let i = 0; i < 4; i += 1) roofs.push(makeRoofTexture(rng));
  const awnings = [];
  for (let i = 0; i < 4; i += 1) awnings.push(makeAwningTexture(rng));

  const buildingSpots = [];
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const count = 1 + Math.floor(rng() * 3);
      if (count === 1) {
        buildingSpots.push({ x: bx, z: bz, w: BLOCK * 0.72, d: BLOCK * 0.72 });
      } else if (count === 2) {
        const vertical = rng() > 0.5;
        for (const off of [-BLOCK * 0.26, BLOCK * 0.26]) {
          buildingSpots.push({
            x: vertical ? bx + off : bx,
            z: vertical ? bz : bz + off,
            w: vertical ? BLOCK * 0.42 : BLOCK * 0.72,
            d: vertical ? BLOCK * 0.72 : BLOCK * 0.42,
          });
        }
      } else {
        for (const ox of [-BLOCK * 0.26, BLOCK * 0.26]) {
          for (const oz of [-BLOCK * 0.26, BLOCK * 0.26]) {
            buildingSpots.push({ x: bx + ox, z: bz + oz, w: BLOCK * 0.42, d: BLOCK * 0.42 });
          }
        }
      }
    }
  }
  for (const spot of buildingSpots) {
    const h = 8 + rng() * rng() * 34; // mostly low, a few towers
    const building = makeBuilding(rng, spot.w, spot.d, h, pick(rng, facades), pick(rng, roofs));
    building.position.set(spot.x, h / 2, spot.z);
    group.add(building);
    colliders.push({
      minX: spot.x - spot.w / 2,
      maxX: spot.x + spot.w / 2,
      minZ: spot.z - spot.d / 2,
      maxZ: spot.z + spot.d / 2,
    });
    // Awnings on about a third of ground floors, facing a random street.
    if (rng() < 0.35) {
      const awning = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(spot.w, 14), 2.2),
        new THREE.MeshLambertMaterial({ map: pick(rng, awnings) }),
      );
      const face = Math.floor(rng() * 4);
      const y = 3.4;
      if (face === 0) { awning.position.set(spot.x, y, spot.z + spot.d / 2 + 0.1); }
      else if (face === 1) { awning.position.set(spot.x, y, spot.z - spot.d / 2 - 0.1); awning.rotation.y = Math.PI; }
      else if (face === 2) { awning.position.set(spot.x + spot.w / 2 + 0.1, y, spot.z); awning.rotation.y = Math.PI / 2; }
      else { awning.position.set(spot.x - spot.w / 2 - 0.1, y, spot.z); awning.rotation.y = -Math.PI / 2; }
      group.add(awning);
    }
  }

  // Palms line the sidewalks along every street, every other block.
  const palmSpots = [];
  for (const s of STREETS) {
    for (const b of BLOCKS) {
      if (Math.abs(b) % 140 < 70) {
        palmSpots.push({ x: s + ROAD_HALF + 2.5, z: b });
        palmSpots.push({ x: b, z: s + ROAD_HALF + 2.5 });
      }
    }
  }
  for (const spot of palmSpots) {
    const palm = makePalm(rng);
    palm.position.set(spot.x, 0, spot.z);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
  }

  // Streetlights at every other intersection corner.
  for (let i = 0; i < STREETS.length; i += 2) {
    for (let j = 0; j < STREETS.length; j += 2) {
      const light = makeStreetlight();
      light.position.set(STREETS[i] + ROAD_HALF + 0.6, 0, STREETS[j] - ROAD_HALF - 0.6);
      light.rotation.y = Math.PI / 2;
      group.add(light);
    }
  }

  // The marina: a strip of water at the south edge, with a wooden pier.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 90),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.03, CITY_HALF + 45);
  group.add(water);
  const pier = box(10, 0.4, 46, 0x7a5c3a, 140, 0.2, CITY_HALF + 22);
  group.add(pier);

  // Named places the missions point at (all on streets, easy to reach).
  const places = {
    garage: { x: -210, z: 70, label: "Mara's Garage" },
    store: { x: 70, z: -140, label: 'Sunrise Mart' },
    marina: { x: 140, z: 280, label: 'Marina' },
    hideout: { x: -280, z: -210, label: 'Hideout' },
    coralAve: { x: 0, z: 140, label: 'Coral Ave' },
    palmRow: { x: -70, z: 0, label: 'Palm Row' },
  };

  // A glowing beacon column marks an active mission target; built once, moved by missions.
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
    colliders,
    beacon,
    places,
    // Push a circle out of every building it overlaps; returns true on a hit.
    resolveCircle(pos, radius) {
      let hit = false;
      for (const c of colliders) {
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
      const limit = CITY_HALF - 2;
      if (pos.x < -limit) pos.x = -limit;
      if (pos.x > limit) pos.x = limit;
      if (pos.z < -limit) pos.z = -limit;
      if (pos.z > CITY_HALF - 4) pos.z = CITY_HALF - 4;
      return hit;
    },
    isOnRoad(x, z) {
      for (const s of STREETS) {
        if (Math.abs(x - s) < ROAD_HALF || Math.abs(z - s) < ROAD_HALF) return true;
      }
      return false;
    },
    nearestStreetCoord(v) {
      let best = STREETS[0];
      for (const s of STREETS) {
        if (Math.abs(s - v) < Math.abs(best - v)) best = s;
      }
      return best;
    },
  };
}

export { WORLD, PITCH };
