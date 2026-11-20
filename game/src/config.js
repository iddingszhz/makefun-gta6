// Costa Verde v3 — one place for every number the game tunes by.
// The city grid, the cars, the wanted level, the missions and the guns all
// read from here, so a balance change is a single edit, not a hunt.

// --- The street grid -------------------------------------------------------
// Streets run both ways on a square lattice. The avenues are 70 m apart and
// the drivable ribbon of each is 14 m wide, which leaves 56 m blocks.
export const GRID_STEP = 70;
export const GRID_N = 9;
export const ROAD_HALF = 7;
export const BLOCK_SPAN = GRID_STEP - ROAD_HALF * 2;
export const CITY_EDGE = ((GRID_N - 1) / 2) * GRID_STEP + ROAD_HALF;

export const AVENUES = [];
for (let i = 0; i < GRID_N; i += 1) {
  AVENUES.push((i - (GRID_N - 1) / 2) * GRID_STEP);
}
// Block centres fall halfway between avenues.
export const BLOCK_CENTRES = [];
for (let i = 0; i < GRID_N - 1; i += 1) {
  BLOCK_CENTRES.push((i - (GRID_N - 2) / 2) * GRID_STEP);
}

export const SKY = {
  ground: 0x8a7f63,
  sky: 0x9fc8e8,
  fog: 0xa8c6de,
  fogNear: 220,
  fogFar: 620,
  sun: 0xfff1cf,
  sunPower: 2.6,
  hemiTop: 0xbdd8f0,
  hemiBottom: 0x9c8a6a,
  hemiPower: 0.9,
};

// --- Alex on foot ----------------------------------------------------------
export const ON_FOOT = {
  walk: 6,
  run: 10.5,
  turn: 9,
  radius: 0.55,
  height: 1.8,
  hp: 100,
  camDist: 9,
  camHigh: 4.2,
  camDistCar: 14,
  camHighCar: 6.5,
};

// --- Cars ------------------------------------------------------------------
export const DRIVE = {
  accel: 20,
  brake: 34,
  reverse: 12,
  top: 38,
  topReverse: 12,
  steerMax: 0.55,
  steerRate: 2.2,
  grip: 6.5,
  radius: 1.5,
  halfLen: 2.3,
  halfWid: 1.05,
  hp: 100,
  traffic: 14,
  parked: 16,
  copMax: 4,
};

// --- The wanted level ------------------------------------------------------
export const HEAT = {
  max: 5,
  quiet: 18, // seconds unnoticed before the first star starts to fall
  step: 9, // seconds per star lost while hidden
  copsPerStar: [0, 1, 2, 2, 3, 4],
  copTop: 36, // a good driver can always pull away; 5 stars must not outrun them
  parkClose: 8, // a cop this close to a player on foot slows to a stop, so the bust can land
  bustRange: 7,
  bustTime: 3, // seconds inside bustRange to get busted
  replaceDelay: 8, // seconds before a destroyed police car is replaced
};

// --- The pistol ------------------------------------------------------------
export const GUN = {
  damage: 34,
  range: 60,
  mag: 12,
  reload: 1.4,
  pedHp: 30,
};

// --- The story -------------------------------------------------------------
export const JOBS = [
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
    limit: 90,
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

export const SIDE_PAY = 150;

// --- Deterministic random --------------------------------------------------
// xorshift32: a tiny generator with a full 32-bit period, so a screenshot
// seed always rebuilds the same city and the same traffic.
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function pickOne(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
