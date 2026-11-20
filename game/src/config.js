// Every tuning number and colour in one place. Solmar Bay is a fixed
// 3600 x 2700 world; the renderer scales a camera view of it to the window,
// so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2700 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Where a fresh game starts: outside Lena's garage, downtown. */
export const SPAWN = { x: 1500, y: 1330 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  hp: 100,
  armorMax: 100,
  interactRadius: 46,
};

export const CAR = {
  radius: 26,
  /** Top speed by model, px/s. */
  models: {
    sedan: { top: 430, accel: 300, turn: 2.6, hp: 140, color: '#7fa8c9' },
    taxi: { top: 410, accel: 290, turn: 2.6, hp: 140, color: '#f2c230' },
    sports: { top: 560, accel: 380, turn: 3.1, hp: 130, color: '#d84a5a' },
    pickup: { top: 400, accel: 270, turn: 2.3, hp: 170, color: '#5f8f5a' },
    police: { top: 480, accel: 340, turn: 2.9, hp: 200, color: '#2b3a55' },
    van: { top: 360, accel: 240, turn: 2.1, hp: 190, color: '#c9c2b4' },
  },
  /** How far away traffic and police cars are kept from the player. */
  despawnRadius: 1500,
  spawnRadius: 900,
};

export const TRAFFIC = { count: 14, speed: 150 };
export const PEDS = { count: 26, speed: 55 };

export const WANTED = {
  max: 5,
  /** Seconds with no police near and no new crime before one star drops. */
  decayBase: 5,
  decayPerStar: 2,
  /** Police cars on the hunt, by wanted level. */
  policeCars: [0, 1, 2, 3, 4, 5],
  /** Foot cops join the hunt from 2 stars. */
  footCopsAt: 2,
  bustSeconds: 1.2,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 34, auto: false, price: 0 },
  pistol: { name: 'Pistol', damage: 22, rate: 0.28, range: 420, auto: false, price: 300, ammoPrice: 50, ammoPack: 24 },
  smg: { name: 'SMG', damage: 14, rate: 0.09, range: 380, auto: true, price: 800, ammoPrice: 80, ammoPack: 60 },
  shotgun: { name: 'Shotgun', damage: 16, rate: 0.8, range: 260, auto: false, price: 1200, ammoPrice: 60, ammoPack: 12, pellets: 6 },
};

export const SHOPS = {
  sprayCost: 500,
  healCost: 100,
  armorCost: 300,
};

export const TAXI = { fareMin: 40, fareMax: 120, tipPerSecond: 2, timePerMetre: 0.09 };

export const RANKS = [
  { cash: 0, name: 'Small Timer' },
  { cash: 3000, name: 'Wheelman' },
  { cash: 8000, name: 'Made Man' },
  { cash: 15000, name: 'King of Solmar' },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d49a',
  water: '#3f8fb8',
  waterDeep: '#2f6f96',
  road: '#3d3a38',
  roadEdge: '#2e2b29',
  lane: '#e8d96a',
  sidewalk: '#b9b3a4',
  buildingRoof: '#8a6f5c',
  park: '#5d9b4a',
  plaza: '#c9bfa8',
  player: '#f2b134',
  playerShirt: '#e84a4a',
  pedShirt: ['#4f8fd0', '#d07f4f', '#7fbf6a', '#b06abf', '#d0d0d0', '#4fc3b0'],
  police: '#2b3a55',
  policeLight: '#e23b3b',
  policeLight2: '#3b6fe2',
  hud: '#10131a',
  hudText: '#f2ede0',
  gold: '#f2c230',
  red: '#e23b3b',
  green: '#5fbf5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const TITLE_FONT = 'Georgia, "Times New Roman", serif';

/** Where the save lives in this browser. */
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';
