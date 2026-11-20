// The screenshot scenes behind ?shot=chase|street|mission|night. Each one
// sets the world to a scripted state (a chase, a busy street, a shootout, a
// night fare) and plays the real rules forward for a fixed number of steps,
// steered by a simple autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { MISSIONS } from './missions.js';
import { createEnemy, createPed } from './people.js';
import { createCar as makeCar } from './vehicles.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';

/**
 * A fake input object for the autopilot. The autopilot writes its current
 * move / drive / mouse into `auto` each step; the world reads them through
 * the same calls it uses for the real input.
 */
function scriptedInput(auto) {
  return {
    move: () => auto.move || { x: 0, y: 0 },
    run: () => false,
    drive: () => auto.drive || { throttle: 0, steer: 0, brake: false },
    mouse: () => auto.mouse || { x: 640, y: 360, down: !!auto.fire },
    takeWeaponKey: () => null,
    takeActions: () => 0,
  };
}

function driveToward(state, tx, ty) {
  const car = state.player.inCar;
  if (!car) return { throttle: 0, steer: 0, brake: false };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    throttle: 1,
    steer: Math.max(-1, Math.min(1, diff * 2)),
    brake: Math.abs(diff) > 1.2,
  };
}

function walkToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 20) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

function resetWorld(state) {
  state.cars = [];
  state.peds = [];
  state.enemies = [];
  state.cops = [];
  state.bullets = [];
  state.particles = [];
  state.toasts = [];
  state.mission = null;
  state.taxi = { active: false };
  state.player.wanted = 0;
  state.player.inCar = null;
  state.player.hp = 100;
  state.player.armor = 50;
  state.player.cash = 12480;
  state.player.weapon = 'pistol';
  state.player.ammo = { pistol: 48, smg: 60, shotgun: 12 };
  state.player.owned = { fists: true, pistol: true, smg: true, shotgun: true };
  state.save = () => {}; // screenshots never write the save
  state.dusk = 0;
}

function addTraffic(state, n, nearX, nearY) {
  for (let i = 0; i < n; i += 1) {
    const p = randomRoadPoint(state.rng);
    if (Math.hypot(p.x - nearX, p.y - nearY) > 900) continue;
    const car = makeCar(p.x, p.y, state.rng() < 0.5 ? 0 : Math.PI / 2, state.rng() < 0.5 ? 'sedan' : 'pickup', 'traffic');
    state.cars.push(car);
  }
}

function addPeds(state, n, nearX, nearY) {
  for (let i = 0; i < n; i += 1) {
    const p = createPed(state.city, state.rng);
    if (Math.hypot(p.x - nearX, p.y - nearY) > 700) continue;
    state.peds.push(p);
  }
}

function addPoliceChase(state, n, behindX, behindY) {
  for (let i = 0; i < n; i += 1) {
    const car = makeCar(behindX + (i - 1) * 120, behindY + (i % 2) * 80, 0, 'police', 'police');
    car.speed = 420;
    car.lane = (i - 1) * 70; // spread across the road while chasing
    state.cars.push(car);
  }
}

/**
 * Set the world to the named scene and play it forward; returns the screen
 * to draw (always the play screen for these scenes).
 */
export function stageShot(name, state, stepWorld, view) {
  const p = state.player;
  const shot = name === 'street' || name === 'mission' || name === 'night' ? name : 'chase';
  const auto = {};
  const input = scriptedInput(auto);

  if (shot === 'chase') {
    // The cover: the Comet GT, three stars, three police cars behind, the
    // garage ahead, dusk over downtown.
    resetWorld(state);
    state.dusk = 0.55;
    const car = makeCar(900, 1300, 0, 'sports', 'player');
    car.color = '#d84a5a';
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    state.player.wanted = 3;
    state.player.lastCrime = 0;
    state.mission = { idx: 4, step: 2, def: MISSIONS[4], spawned: false, kills: 0, timer: 0 };
    addTraffic(state, 12, 1500, 1300);
    addPeds(state, 12, 1500, 1300);
    addPoliceChase(state, 3, 600, 1300);
    // A straight run east along street 1300, flat out, police right behind.
    // Short enough that the police (spawned 300px back) are still in frame.
    for (let i = 0; i < 3.5 / STEP; i += 1) {
      auto.drive = driveToward(state, 2700, 1300);
      stepWorld(state, STEP, input, view);
    }
    return { screen: 'play' };
  }

  if (shot === 'street') {
    // On foot on a busy avenue in the daytime, traffic and pedestrians.
    resetWorld(state);
    p.x = 900;
    p.y = 800;
    p.weapon = 'fists';
    state.missionsDone = 2;
    addTraffic(state, 16, 900, 700);
    addPeds(state, 24, 900, 700);
    for (let i = 0; i < 6 / STEP; i += 1) {
      auto.move = walkToward(state, 900, 500);
      stepWorld(state, STEP, input, view);
    }
    return { screen: 'play' };
  }

  if (shot === 'mission') {
    // The marina shootout: Vic's enforcers, muzzle flashes, the ledger job.
    resetWorld(state);
    state.dusk = 0.4;
    p.x = 3180;
    p.y = 1800;
    p.weapon = 'smg';
    state.mission = { idx: 3, step: 1, def: MISSIONS[3], spawned: false, kills: 2, timer: 0 };
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      state.enemies.push(createEnemy(3280 + Math.cos(angle) * 70, 1800 + Math.sin(angle) * 70, 60));
    }
    state.enemies[0].hp = 10;
    state.enemies[1].hp = 10;
    addTraffic(state, 4, 3300, 1800);
    auto.fire = true;
    for (let i = 0; i < 4 / STEP; i += 1) {
      // Aim at the nearest living enemy.
      const alive = state.enemies.filter((e) => !e.dead);
      if (alive.length > 0) {
        const e = alive[0];
        const cam = state.camera;
        auto.mouse = {
          x: (e.x - cam.x) * cam.zoom + view.w / 2,
          y: (e.y - cam.y) * cam.zoom + view.h / 2,
          down: true,
        };
      }
      auto.move = walkToward(state, 3300, 1800);
      stepWorld(state, STEP, input, view);
    }
    return { screen: 'play' };
  }

  // night: a taxi fare through the neon district, one star, dusk.
  resetWorld(state);
  state.dusk = 1;
  const cab = makeCar(2700, 800, Math.PI / 2, 'taxi', 'player');
  state.cars.push(cab);
  p.inCar = cab;
  p.x = cab.x;
  p.y = cab.y;
  state.player.wanted = 1;
  state.player.lastCrime = 0;
  // A far destination, so the cab is still driving when the shot is taken.
  const dest = { x: 300, y: 300 };
  state.taxi = { active: true, phase: 'dropoff', passenger: null, dest, timer: 90, fare: 95 };
  addTraffic(state, 16, 2000, 800);
  addPeds(state, 18, 2000, 800);
  addPoliceChase(state, 1, 2700, 650);
  for (let i = 0; i < 7 / STEP; i += 1) {
    // West along street 800, then north up avenue 300 — on the roads.
    const car = state.player.inCar;
    const target = car && car.x > 420 ? { x: 300, y: 800 } : { x: 300, y: 300 };
    auto.drive = driveToward(state, target.x, target.y);
    stepWorld(state, STEP, input, view);
  }
  return { screen: 'play' };
}
