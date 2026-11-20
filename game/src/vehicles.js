// Cars: the player's arcade driving, traffic that follows the road grid,
// parked cars to steal, and police cars that hunt the player. A car is a
// position, a heading and a speed; traffic steers toward waypoints on the
// road grid, police steer toward the player.

import { CAR, TRAFFIC, WORLD } from './config.js';
import { AVENUES, STREETS, hitBuilding, isRoad, nearestRoadPoint, randomRoadPoint, resolveCircle } from './city.js';
import { chance, pick, range } from './random.js';

let nextId = 1;

export function createCar(x, y, angle, model, driver) {
  const def = CAR.models[model] || CAR.models.sedan;
  return {
    id: nextId,
    x, y, angle, speed: 0,
    model, driver,
    color: def.color,
    top: def.top, accel: def.accel, turn: def.turn,
    hp: def.hp, maxHp: def.hp,
    target: null, // traffic waypoint {x, y}
    stuck: 0,
    honk: 0,
    bumpCd: 0, // seconds until this car can take another impact
    dead: false, // wrecked: doesn't move, stays as an obstacle
  };
}

/** A random parked car, on a road edge or in a parking lot. */
export function spawnParkedCar(city, rng) {
  const models = ['sedan', 'sedan', 'pickup', 'van', 'sports', 'taxi'];
  const model = pick(rng, models);
  let x;
  let y;
  let angle;
  if (chance(rng, 0.5) && city.lots.length > 0) {
    const lot = pick(rng, city.lots);
    x = range(rng, lot.x + 40, lot.x + lot.w - 40);
    y = range(rng, lot.y + 40, lot.y + lot.h - 40);
    angle = chance(rng, 0.5) ? 0 : Math.PI / 2;
  } else {
    const p = randomRoadPoint(rng);
    x = p.x;
    y = p.y;
    angle = chance(rng, 0.5) ? 0 : Math.PI / 2;
    if (Math.abs(p.x - Math.round(p.x)) > 0) angle = 0;
  }
  if (hitBuilding(city, x, y, 30)) return null;
  return createCar(x, y, angle, model, 'parked');
}

/** Traffic cars drive the grid, one intersection at a time, in their lane:
 * first to the nearest intersection on the road they are on, then to a
 * neighbouring intersection, so they never cut diagonally across a block
 * (the old diagonal waypoints wedged cars on building corners). */
function nextWaypoint(car, rng) {
  if (car.lane === undefined || car.lane === 0) car.lane = chance(rng, 0.5) ? -27 : 27;
  const ai = nearestAvenue(car.x);
  const si = nearestStreet(car.y);
  const onAvenue = Math.abs(car.x - AVENUES[ai]) <= Math.abs(car.y - STREETS[si]);
  const target = onAvenue
    ? { x: AVENUES[ai] + car.lane, y: STREETS[si] }
    : { x: AVENUES[ai], y: STREETS[si] + car.lane };
  if (Math.hypot(target.x - car.x, target.y - car.y) < 60) {
    return adjacentIntersection(AVENUES[ai], STREETS[si], rng, car.lane);
  }
  return target;
}

function nearestAvenue(x) {
  let best = 0;
  for (let i = 1; i < AVENUES.length; i += 1) {
    if (Math.abs(AVENUES[i] - x) < Math.abs(AVENUES[best] - x)) best = i;
  }
  return best;
}

function nearestStreet(y) {
  let best = 0;
  for (let i = 1; i < STREETS.length; i += 1) {
    if (Math.abs(STREETS[i] - y) < Math.abs(STREETS[best] - y)) best = i;
  }
  return best;
}

/** A neighbouring intersection of (ax, st), in the car's lane. */
function adjacentIntersection(ax, st, rng, lane) {
  const ai = AVENUES.indexOf(ax);
  const si = STREETS.indexOf(st);
  const options = [];
  if (ai > 0) options.push({ x: AVENUES[ai - 1], y: st + lane });
  if (ai < AVENUES.length - 1) options.push({ x: AVENUES[ai + 1], y: st + lane });
  if (si > 0) options.push({ x: ax + lane, y: STREETS[si - 1] });
  if (si < STREETS.length - 1) options.push({ x: ax + lane, y: STREETS[si + 1] });
  return pick(rng, options);
}

function steerToward(car, tx, ty, dt, agility) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-agility * dt, Math.min(agility * dt, diff));
}

function moveCar(city, car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const pos = { x: car.x, y: car.y };
  if (resolveCircle(city, pos, CAR.radius)) {
    car.x = pos.x;
    car.y = pos.y;
    car.speed *= 0.4;
  }
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
}

function carAhead(state, car, rangePx) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = Infinity;
  for (const other of state.cars) {
    if (other === car || other.driver === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist > rangePx || dist < 1) continue;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && side < 40 && along < nearest) nearest = along;
  }
  return nearest;
}

export function updateCars(state, dt, input) {
  const { city, rng } = state;
  const player = state.player;

  // Impact cooldowns tick down for every car, including the player's.
  for (const car of state.cars) car.bumpCd = Math.max(0, (car.bumpCd || 0) - dt);

  // The player's car, driven by the input.
  if (player.inCar) {
    const car = player.inCar;
    const drive = input.drive();
    const target = drive.throttle > 0 ? car.top : drive.throttle < 0 ? -car.top * 0.45 : 0;
    const rate = drive.throttle !== 0 ? car.accel : car.accel * 1.6;
    if (car.speed < target) car.speed = Math.min(target, car.speed + rate * dt);
    else if (car.speed > target) car.speed = Math.max(target, car.speed - rate * dt);
    if (drive.brake) car.speed *= Math.max(0, 1 - 3 * dt);
    const steerAmount = drive.steer * car.turn * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    car.angle += car.speed >= 0 ? steerAmount : -steerAmount;
    moveCar(city, car, dt);
    state.audio.engine(Math.abs(car.speed) / car.top, true);
  } else {
    state.audio.engine(0, false);
  }

  // Traffic and police.
  for (const car of state.cars) {
    if (car === player.inCar) continue;
    if (car.driver === 'parked' || car.dead) continue;
    if (car.driver === 'police') {
      // Chase the player, but aim at a point just behind them, so the
      // pursuit trails instead of pile-driving into the player's car.
      // Each car holds its own lane offset, so they don't grind on each other.
      const target = player.inCar || player;
      const heading = target.angle || 0;
      const px = -Math.sin(heading);
      const py = Math.cos(heading);
      const tx = target.x - Math.cos(heading) * 80 + px * (car.lane || 0);
      const ty = target.y - Math.sin(heading) * 80 + py * (car.lane || 0);
      // Stay on the roads: chase the road point nearest the trail point,
      // so police don't cut across blocks and wedge on buildings.
      const snapped = nearestRoadPoint(tx, ty);
      // If wedged (barely moving while chasing), back out and turn around.
      if (car.speed < 40) car.stuck += 1; else car.stuck = 0;
      if (car.stuck > 45 && car.stuck < 90) {
        car.speed = Math.max(-140, car.speed - 300 * dt);
        car.angle += 1.2 * dt;
        moveCar(city, car, dt);
        continue;
      }
      if (car.stuck >= 90) car.stuck = 0;
      steerToward(car, snapped.x, snapped.y, dt, 2.2);
      car.speed = Math.min(car.top, car.speed + car.accel * dt);
      moveCar(city, car, dt);
      continue;
    }
    // Traffic: follow the waypoint, slow for the car ahead.
    if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 60) {
      car.target = nextWaypoint(car, rng);
    }
    const ahead = carAhead(state, car, 130);
    const wantSpeed = ahead < 90 ? 0 : TRAFFIC.speed;
    car.speed += (wantSpeed - car.speed) * Math.min(1, 2 * dt);
    steerToward(car, car.target.x, car.target.y, dt, 1.6);
    moveCar(city, car, dt);
  }

  // Car-to-car bumps: push apart, lose speed, spark.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = CAR.radius * 2 - 6;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const hit = Math.abs(a.speed - b.speed);
        // One impact per cooldown: while two cars stay in contact they
        // must not bleed speed or take damage every single step, or a
        // short grind wrecks a car.
        const fresh = (a.bumpCd || 0) <= 0 && (b.bumpCd || 0) <= 0;
        if (hit > 60 && fresh) {
          a.speed *= 0.85;
          b.speed *= 0.85;
          a.bumpCd = 0.4;
          b.bumpCd = 0.4;
        }
        if (hit > 120 && fresh) {
          state.particles.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'spark', life: 0.4, max: 0.4 });
          if ((a === player.inCar || b === player.inCar) && hit > 200) state.audio.thud();
          damageCar(state, a, hit * 0.015);
          damageCar(state, b, hit * 0.015);
        }
      }
    }
  }

  // Keep the roads busy near the player; recycle cars that drifted far away.
  const near = state.cars.filter((c) => c.driver === 'traffic').length;
  if (near < TRAFFIC.count) {
    const p = randomRoadPoint(rng);
    const px = player.x;
    const py = player.y;
    if (Math.hypot(p.x - px, p.y - py) > 500) {
      const car = createCar(p.x, p.y, chance(rng, 0.5) ? 0 : Math.PI / 2, pick(rng, ['sedan', 'sedan', 'pickup', 'van', 'taxi']), 'traffic');
      car.target = nextWaypoint(car, rng);
      state.cars.push(car);
    }
  }
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver === 'traffic' && Math.hypot(car.x - player.x, car.y - player.y) > CAR.despawnRadius) {
      state.cars.splice(i, 1);
    }
  }
}

export function damageCar(state, car, amount) {
  if (!car || car.driver === 'parked') return;
  car.hp -= amount;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true;
    car.speed = 0;
    state.particles.push({ x: car.x, y: car.y, kind: 'explosion', life: 0.8, max: 0.8 });
    state.audio.explosion();
    if (car === state.player.inCar) {
      state.player.inCar = null;
      state.player.hp -= 25;
    }
    if (car.driver === 'police') {
      state.player.wanted = Math.max(0, state.player.wanted - 0); // destroying a police car is a crime, not a reward
      state.addWanted(1, 'Destroyed a police car');
    }
  }
}

/** The nearest car the player could steal, within reach. */
export function nearestEnterableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 70;
  for (const car of state.cars) {
    if (car.driver === 'police' || car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
