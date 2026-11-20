// People on foot: pedestrians who walk the sidewalks and flee from danger,
// armed enemies for the missions, and foot police who chase the player down
// and try to arrest them.

import { PEDS, PLAYER } from './config.js';
import { hitBuilding, isWater, randomSidewalkPoint, resolveCircle, sidewalkPointAlong } from './city.js';
import { chance, pick, range } from './random.js';

export function createPed(city, rng, x, y) {
  const p = x !== undefined ? { x, y } : randomSidewalkPoint(rng);
  return {
    x: p.x, y: p.y, angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, PEDS.speed * 0.7, PEDS.speed * 1.3),
    target: randomSidewalkPoint(rng),
    shirt: pick(rng, ['#4f8fd0', '#d07f4f', '#7fbf6a', '#b06abf', '#d0d0d0', '#4fc3b0']),
    flee: 0, down: 0, dead: false,
  };
}

export function createEnemy(x, y, hp) {
  return {
    x, y, angle: 0, hp: hp || 60, speed: 95,
    fireTimer: range(Math.random, 0.3, 1.2),
    target: null, dead: false, down: 0,
  };
}

export function createFootCop(x, y) {
  return { x, y, angle: 0, speed: 200, grab: 0, dead: false };
}

function fleeFrom(state, ped, dt) {
  // Run away from the nearest danger (gunfire, explosion, fast car).
  let fx = 0;
  let fy = 0;
  for (const d of state.dangers) {
    const dx = ped.x - d.x;
    const dy = ped.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 260 && dist > 1) {
      fx += (dx / dist) * (1 - dist / 260);
      fy += (dy / dist) * (1 - dist / 260);
    }
  }
  if (fx === 0 && fy === 0) return false;
  const len = Math.hypot(fx, fy);
  ped.angle = Math.atan2(fy / len, fx / len);
  ped.x += Math.cos(ped.angle) * ped.speed * 2.4 * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * 2.4 * dt;
  return true;
}

export function updatePeds(state, dt) {
  const { city, rng, player } = state;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      if (fleeFrom(state, ped, dt)) continue;
    }
    // Walk toward the waypoint; pick a new one on arrival.
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) {
      // Mostly keep walking the same street; sometimes wander elsewhere.
      ped.target = chance(state.rng, 0.7) ? sidewalkPointAlong(state.rng, ped.x, ped.y) : randomSidewalkPoint(rng);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!hitBuilding(city, nx, ny, 10) && !isWater(nx, ny)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.target = sidewalkPointAlong(state.rng, ped.x, ped.y);
    }
    // A speeding car nearby makes them run.
    if (player.inCar && Math.abs(player.inCar.speed) > 300 && Math.hypot(ped.x - player.x, ped.y - player.y) < 200) {
      ped.flee = 2;
    }
  }
  // Keep the streets busy near the player.
  const near = state.peds.filter((p) => !p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 1200).length;
  if (near < PEDS.count) {
    const p = createPed(city, rng);
    if (Math.hypot(p.x - player.x, p.y - player.y) > 500) state.peds.push(p);
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (!ped.dead && Math.hypot(ped.x - player.x, ped.y - player.y) > 1600) state.peds.splice(i, 1);
  }
}

export function updateEnemies(state, dt) {
  const { player } = state;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    if (dist > 420) {
      // Close the distance, staying on land.
      const nx = e.x + Math.cos(e.angle) * e.speed * dt;
      const ny = e.y + Math.sin(e.angle) * e.speed * dt;
      if (!isWater(nx, ny)) {
        e.x = nx;
        e.y = ny;
      }
      const pos = { x: e.x, y: e.y };
      resolveCircle(state.city, pos, 12);
      e.x = pos.x;
      e.y = pos.y;
    } else if (dist < 200) {
      // Back off a little so they don't crowd the player.
      const nx = e.x - Math.cos(e.angle) * e.speed * 0.5 * dt;
      const ny = e.y - Math.sin(e.angle) * e.speed * 0.5 * dt;
      if (!isWater(nx, ny)) {
        e.x = nx;
        e.y = ny;
      }
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 480 && !player.inCar) {
      e.fireTimer = range(state.rng, 0.7, 1.4);
      state.fireBullet(e.x, e.y, e.angle + range(state.rng, -0.12, 0.12), 380, 8, 'enemy');
      state.audio.enemyShot();
    } else if (e.fireTimer <= 0 && dist < 480 && player.inCar) {
      // Shoot the car instead.
      e.fireTimer = range(state.rng, 0.9, 1.6);
      state.fireBullet(e.x, e.y, e.angle + range(state.rng, -0.12, 0.12), 380, 6, 'enemy');
      state.audio.enemyShot();
    }
  }
}

export function updateFootCops(state, dt) {
  const { player } = state;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    if (player.inCar) {
      // Cops on foot can't catch a car: run back toward the road.
      const road = { x: player.x, y: player.y };
      const dx = road.x - cop.x;
      const dy = road.y - cop.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 300) {
        cop.x += (dx / dist) * cop.speed * dt;
        cop.y += (dy / dist) * cop.speed * dt;
      }
      cop.grab = 0;
      continue;
    }
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      cop.angle = Math.atan2(dy, dx);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      const pos = { x: cop.x, y: cop.y };
      resolveCircle(state.city, pos, 12);
      cop.x = pos.x;
      cop.y = pos.y;
    }
    if (dist < 26) {
      cop.grab += dt;
      if (cop.grab >= 1.2) {
        state.busted();
        cop.grab = 0;
      }
    } else {
      cop.grab = Math.max(0, cop.grab - dt * 2);
    }
  }
  // Foot cops give up when the wanted level drops.
  if (player.wanted < 2) {
    for (const cop of state.cops) cop.dead = true;
    state.cops = state.cops.filter((c) => !c.dead);
  }
}

/** Knock a pedestrian down (car hit or bullet). Returns true if it was a crime. */
export function knockPed(state, ped, byPlayer) {
  if (ped.dead || ped.down > 0) return false;
  ped.down = 3 + Math.random() * 2;
  ped.flee = 5;
  if (byPlayer) {
    state.addWanted(1, 'Hit a pedestrian');
    state.stats.pedsHit = (state.stats.pedsHit || 0) + 1;
  }
  return true;
}
