// Costa Verde — every number the game tunes by, in one place.
// The street grid, the cars, the heat, the jobs and the gun all read from
// here, so rebalancing is one edit instead of a search through the modules.

// --- Mara's jobs -----------------------------------------------------------
// Five story jobs, in order, plus the courier rate for free-roam runs.
export const JOBS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Mara',
    text: 'Mara needs wheels. Take any car off the street and drop it at the garage on Palm Row.',
    reward: 300,
  },
  {
    id: 'courier-rush',
    title: 'Courier Rush',
    giver: 'Mara',
    text: 'Three drop-offs, ninety seconds on the clock. Hit every checkpoint before time runs out.',
    reward: 400,
    limit: 90,
  },
  {
    id: 'heat-check',
    title: 'Heat Check',
    giver: 'Mara',
    text: 'The crew needs to know you can take pressure. Get to 3 stars, then shake the heat off.',
    reward: 500,
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Mara',
    text: 'Collect the passenger on Coral Ave and take them to the marina. Expect company on the way.',
    reward: 600,
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Mara',
    text: 'Rob the Sunrise Mart, then lose a 4-star chase and make the hideout. This is the big one.',
    reward: 1500,
  },
];

export const SIDE_PAY = 150;

// --- Streets ---------------------------------------------------------------
// Avenues on a square lattice, 70 m apart, with a 14 m drivable ribbon.
// Everything else in the city is measured off these lines.
export const GRID_STEP = 70;
export const GRID_N = 9;
export const ROAD_HALF = 7;
export const BLOCK_SPAN = GRID_STEP - 2 * ROAD_HALF;
export const CITY_EDGE = 4 * GRID_STEP + ROAD_HALF;

export const AVENUES = Array.from({ length: GRID_N }, (_, i) => (i - 4) * GRID_STEP);
export const BLOCK_CENTRES = Array.from({ length: GRID_N - 1 }, (_, i) => (i - 3.5) * GRID_STEP);

// --- Look ------------------------------------------------------------------
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

// --- Wanted level ----------------------------------------------------------
export const HEAT = {
  max: 5,
  quiet: 8, // seconds out of sight before the first star starts to drop
  step: 6, // seconds per star lost while hidden
  copsPerStar: [0, 1, 2, 2, 3, 4],
  copTop: 36, // capped below the player's top speed, so a clean getaway works
  parkClose: 8, // a cop this close to a player on foot eases to a stop, so the bust lands
  bustRange: 7,
  bustTime: 3, // seconds inside bustRange to get busted
  replaceDelay: 8, // seconds before a wrecked police car is replaced
};

// --- The pistol ------------------------------------------------------------
export const GUN = {
  damage: 34,
  range: 60,
  mag: 12,
  reload: 1.4,
  pedHp: 30,
};

// --- Seeded random ---------------------------------------------------------
// mulberry32: small, fast, and deterministic, so a screenshot seed rebuilds
// the same city, the same traffic and the same speckles every time.
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x6d2b79f5;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function between(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Keep an angle inside (-PI, PI] so turns always take the short way round.
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
