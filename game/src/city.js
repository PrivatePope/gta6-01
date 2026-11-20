// Solmar Bay: a fixed grid city, generated once from a seed. Avenues run
// north-south, streets east-west; the south edge is beach and water, the
// east edge is the marina. Blocks hold buildings, a park, parking lots and
// the shops the game needs. Everything the other modules need to know about
// the map lives here, with the collision queries.

import { WORLD } from './config.js';
import { chance, int, pick, range } from './random.js';

export const ROAD_W = 110;
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300];
export const STREETS = [300, 800, 1300, 1800, 2300];
export const BEACH_Y = 2460;
export const WATER_Y = 2580;
export const MARINA_X = 3355;

const ROOF_COLORS = ['#b08a6a', '#9a7b8a', '#7b8a9a', '#a89a6a', '#8a9a7b', '#c08a5a', '#6a7b8a', '#b07b6a'];
const WALL_COLORS = ['#d8b48a', '#c9a0a0', '#a0b8c9', '#c9b890', '#b8c9a0', '#e0a080', '#9ab0c0', '#d0a090'];

/** True when the point is on a road (avenue or street). */
export function isRoad(x, y) {
  for (const ave of AVENUES) if (Math.abs(x - ave) <= ROAD_W / 2) return true;
  for (const st of STREETS) if (Math.abs(y - st) <= ROAD_W / 2) return true;
  return false;
}

/** True on the sand strip along the south edge. */
export function isBeach(x, y) {
  return y >= BEACH_Y && y < WATER_Y;
}

/** True in the sea (south) or the marina basin (east). */
export function isWater(x, y) {
  if (y >= WATER_Y) return true;
  return x >= MARINA_X && y >= 1400 && y <= 2200;
}

/** The building at the point, if the point is inside one (with margin r). */
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return b;
  }
  return null;
}

/** Push a circle out of buildings and the world edge; returns true if it moved. */
export function resolveCircle(city, pos, r) {
  let moved = false;
  pos.x = Math.max(r, Math.min(WORLD.width - r, pos.x));
  pos.y = Math.max(r, Math.min(WORLD.height - r, pos.y));
  for (let pass = 0; pass < 3; pass += 1) {
    const b = hitBuilding(city, pos.x, pos.y, r);
    if (!b) break;
    moved = true;
    const left = pos.x - (b.x - r);
    const right = b.x + b.w + r - pos.x;
    const top = pos.y - (b.y - r);
    const bottom = b.y + b.h + r - pos.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) pos.x = b.x - r;
    else if (min === right) pos.x = b.x + b.w + r;
    else if (min === top) pos.y = b.y - r;
    else pos.y = b.y + b.h + r;
  }
  return moved;
}

/** A random point on a road, for spawning traffic. */
export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    const ave = pick(rng, AVENUES);
    return { x: ave + (chance(rng, 0.5) ? -27 : 27), y: range(rng, 120, WORLD.height - 200) };
  }
  const st = pick(rng, STREETS);
  return { x: range(rng, 120, WORLD.width - 200), y: st + (chance(rng, 0.5) ? -27 : 27) };
}

/** A sidewalk point along the road the pedestrian is already on, so they
 * walk the streets instead of cutting across blocks and roads. */
export function sidewalkPointAlong(rng, x, y) {
  let bestAve = null;
  let bestAveD = Infinity;
  for (const ave of AVENUES) {
    const d = Math.abs(x - ave);
    if (d < bestAveD) { bestAveD = d; bestAve = ave; }
  }
  let bestSt = null;
  let bestStD = Infinity;
  for (const st of STREETS) {
    const d = Math.abs(y - st);
    if (d < bestStD) { bestStD = d; bestSt = st; }
  }
  if (bestAveD <= bestStD) {
    return { x: bestAve + (x >= bestAve ? 72 : -72), y: range(rng, 120, WORLD.height - 200) };
  }
  return { x: range(rng, 120, WORLD.width - 200), y: bestSt + (y >= bestSt ? 72 : -72) };
}

/** A random point on a sidewalk (just off a road), for pedestrians. */
export function randomSidewalkPoint(rng) {
  if (chance(rng, 0.5)) {
    const ave = pick(rng, AVENUES);
    return { x: ave + (chance(rng, 0.5) ? -72 : 72), y: range(rng, 120, WORLD.height - 200) };
  }
  const st = pick(rng, STREETS);
  return { x: range(rng, 120, WORLD.width - 200), y: st + (chance(rng, 0.5) ? -72 : 72) };
}

/** The nearest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ave of AVENUES) {
    const d = Math.abs(x - ave);
    if (d < bestD) { bestD = d; best = { x: ave, y }; }
  }
  for (const st of STREETS) {
    const d = Math.abs(y - st);
    if (d < bestD) { bestD = d; best = { x, y: st }; }
  }
  return best;
}

export function generateCity(rng) {
  const buildings = [];
  const palms = [];
  const lots = [];

  // Blocks between the avenues and streets.
  const xs = [60, ...AVENUES.map((a) => a + ROAD_W / 2 + 12)];
  const xe = [...AVENUES.map((a) => a - ROAD_W / 2 - 12), WORLD.width - 60];
  const ys = [60, ...STREETS.map((s) => s + ROAD_W / 2 + 12)];
  const ye = [...STREETS.map((s) => s - ROAD_W / 2 - 12), BEACH_Y - 12];

  // The park block: avenues 1500-2100, streets 800-1300.
  const park = { x: 1567, y: 867, w: 478, h: 378 };
  // Two blocks are parking lots (parked cars live there).
  const lotBlocks = [
    { x: 967, y: 1367, w: 478, h: 378 },
    { x: 2167, y: 367, w: 478, h: 378 },
  ];

  for (let bi = 0; bi < xs.length; bi += 1) {
    for (let bj = 0; bj < ys.length; bj += 1) {
      const bx = xs[bi];
      const by = ys[bj];
      const bw = xe[bi] - bx;
      const bh = ye[bj] - by;
      if (bw < 120 || bh < 100) continue;
      // The marina strip east of avenue 3300 is water, not buildings.
      if (bx >= MARINA_X && by >= 1300 && by <= 2300) continue;
      // Park block: no buildings, just trees.
      if (bx >= park.x - 1 && by >= park.y - 1 && bx + bw <= park.x + park.w + 1 && by + bh <= park.y + park.h + 1) {
        for (let i = 0; i < 26; i += 1) {
          palms.push({ x: range(rng, bx + 20, bx + bw - 20), y: range(rng, by + 20, by + bh - 20), park: true });
        }
        continue;
      }
      const isLot = lotBlocks.some((l) => Math.abs(l.x - bx) < 2 && Math.abs(l.y - by) < 2);
      if (isLot) {
        lots.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      // Split the block into 2-4 buildings.
      const cols = bw > 340 ? 2 : 1;
      const rows = bh > 300 ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const cw = bw / cols;
          const ch = bh / rows;
          const w = range(rng, cw * 0.55, cw * 0.82);
          const h = range(rng, ch * 0.55, ch * 0.82);
          const x = bx + c * cw + (cw - w) / 2 + range(rng, -8, 8);
          const y = by + r * ch + (ch - h) / 2 + range(rng, -8, 8);
          buildings.push({
            x, y, w, h,
            roof: pick(rng, ROOF_COLORS),
            wall: pick(rng, WALL_COLORS),
            tall: chance(rng, 0.25),
          });
        }
      }
    }
  }

  // Palms along the streets and the beach.
  for (const ave of AVENUES) {
    for (let y = 180; y < BEACH_Y - 60; y += 260) {
      if (chance(rng, 0.75)) palms.push({ x: ave + (chance(rng, 0.5) ? -78 : 78), y: y + range(rng, -20, 20) });
    }
  }
  for (const st of STREETS) {
    for (let x = 200; x < MARINA_X - 60; x += 300) {
      if (chance(rng, 0.6)) palms.push({ x: x + range(rng, -20, 20), y: st + (chance(rng, 0.5) ? -78 : 78) });
    }
  }
  for (let x = 140; x < WORLD.width - 100; x += 150) {
    palms.push({ x: x + range(rng, -25, 25), y: BEACH_Y + 46 + range(rng, -14, 14) });
  }

  // Named places the game needs. Each is a circle on the sidewalk in front
  // of its building; the player walks or drives into it and presses E.
  const places = {
    garage: { x: 1560, y: 1400, r: 90, name: "Lena's Garage", kind: 'garage' },
    gunshop: { x: 900, y: 720, r: 70, name: 'Ironworks Arms', kind: 'gun' },
    spray: { x: 2100, y: 1720, r: 80, name: 'Sunshine Spray', kind: 'spray' },
    clinic: { x: 2700, y: 1220, r: 70, name: 'Solmar Clinic', kind: 'clinic' },
    safehouse: { x: 300, y: 1720, r: 80, name: 'Safehouse', kind: 'safehouse' },
    casino: { x: 2700, y: 720, r: 90, name: 'The Golden Palm', kind: 'casino' },
    docks: { x: 3300, y: 1800, r: 110, name: 'Marina Warehouse', kind: 'docks' },
    lot: { x: 1200, y: 1560, r: 110, name: 'Impound Lot', kind: 'lot' },
  };

  // Twenty hidden postcards, on sidewalks, in the park and on the beach.
  const postcards = [];
  for (let i = 0; i < 20; i += 1) {
    if (i < 4) postcards.push({ x: range(rng, 200, 3200), y: range(rng, BEACH_Y + 20, WATER_Y - 20), found: false });
    else if (i < 8) postcards.push({ x: range(rng, park.x + 20, park.x + park.w - 20), y: range(rng, park.y + 20, park.y + park.h - 20), found: false });
    else {
      const p = randomSidewalkPoint(rng);
      postcards.push({ x: p.x, y: p.y, found: false });
    }
  }

  return { buildings, palms, lots, park, places, postcards };
}
