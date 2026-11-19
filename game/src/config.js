// Costa Verde — shared tuning numbers, city layout and story data.
// Every module reads its numbers from here so the whole game stays in tune.

// --- City grid -------------------------------------------------------------
export const PITCH = 70; // distance between neighbouring street centrelines
export const STREET_COUNT = 9; // streets per direction, centred on 0
export const ROAD_HALF = 7; // half the width of a road
export const BLOCK = PITCH - ROAD_HALF * 2; // buildable square between roads
export const CITY_HALF = ((STREET_COUNT - 1) / 2) * PITCH + ROAD_HALF; // ~287

// Street centrelines: -280, -210, -140, -70, 0, 70, 140, 210, 280
export const STREETS = [];
for (let i = 0; i < STREET_COUNT; i += 1) {
  STREETS.push((i - (STREET_COUNT - 1) / 2) * PITCH);
}
// Block centres sit between the streets: -245, -175, ..., 245
export const BLOCKS = [];
for (let i = 0; i < STREET_COUNT - 1; i += 1) {
  BLOCKS.push((i - (STREET_COUNT - 2) / 2) * PITCH);
}

export const WORLD = {
  groundColor: 0x8a7f63,
  skyColor: 0x9fc8e8,
  fogColor: 0xa8c6de,
  fogNear: 220,
  fogFar: 620,
  sunColor: 0xfff1cf,
  sunIntensity: 2.6,
  hemiSky: 0xbdd8f0,
  hemiGround: 0x9c8a6a,
  hemiIntensity: 0.9,
};

// --- Player on foot --------------------------------------------------------
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  turnSpeed: 9,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  cameraDistance: 9,
  cameraHeight: 4.2,
  cameraDistanceCar: 14,
  cameraHeightCar: 6.5,
};

// --- Cars ------------------------------------------------------------------
export const CAR = {
  accel: 20,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,
  maxReverse: 12,
  steerMax: 0.55,
  steerSpeed: 2.2,
  grip: 6.5,
  radius: 1.5,
  halfLength: 2.3,
  halfWidth: 1.05,
  maxHealth: 100,
  trafficCount: 14,
  parkedCount: 16,
  policeMax: 4,
};

// --- Wanted level ----------------------------------------------------------
export const WANTED = {
  max: 5,
  decayDelay: 18, // seconds with no crime and no police nearby before it drops
  decayStep: 9, // seconds per star lost while hidden
  policePerStar: [0, 1, 2, 2, 3, 4],
  bustedRange: 7, // a police car this close to the player on foot starts a bust
  bustedTime: 3, // seconds inside bustedRange to get busted
};

// --- Combat ----------------------------------------------------------------
export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  magSize: 12,
  reloadSeconds: 1.4,
  pedHealth: 30,
};

// --- Missions --------------------------------------------------------------
export const MISSION_DEFS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Mara',
    text: 'Mara needs a ride. Steal any car and bring it to the garage on Palm Row.',
    reward: 300,
  },
  {
    id: 'courier-rush',
    title: 'Courier Rush',
    giver: 'Mara',
    text: 'Three drop-offs, ninety seconds. Hit every checkpoint before the clock runs out.',
    reward: 400,
    timeLimit: 90,
  },
  {
    id: 'heat-check',
    title: 'Heat Check',
    giver: 'Mara',
    text: 'The crew needs to know you can handle pressure. Get to 3 stars, then lose the heat.',
    reward: 500,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Mara',
    text: 'Pick up the passenger on Coral Ave and drop them at the marina. Expect company.',
    reward: 600,
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Mara',
    text: 'Rob the Sunrise Mart, then shake a 4-star chase and reach the hideout. This is the big one.',
    reward: 1500,
  },
];

export const SIDE_JOB_REWARD = 150;

// --- Seeded random ---------------------------------------------------------
// Small deterministic generator so a screenshot seed always builds the same city.
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}
