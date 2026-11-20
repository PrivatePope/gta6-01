// The world: everything the game is, in one state object, and the one step
// function that moves it forward. The player, the cars, the people, the
// wanted level, the police, the missions and the side work all live here;
// the modules above own their own rules, and this one wires them together.

import { CAR, PLAYER, SPAWN, STEP, WANTED, WEAPONS } from './config.js';
import { createRandom } from './random.js';
import { ACTION_HONK, ACTION_INTERACT, ACTION_MUTE } from './input.js';
import { generateCity, isWater, nearestRoadPoint, randomRoadPoint, resolveCircle } from './city.js';
import { createCar, damageCar, nearestEnterableCar, spawnParkedCar, updateCars } from './vehicles.js';
import { createEnemy, createFootCop, createPed, knockPed, updateEnemies, updateFootCops, updatePeds } from './people.js';
import { damagePlayer, fireWeapon, updateBullets } from './combat.js';
import { missionMarker, missionObjective, updateMission } from './missions.js';
import { interact, interactionHint, startTaxiFare, taxiMarker, updatePostcards, updateSprayShop, updateTaxi } from './activities.js';
import { loadGame, saveGame } from './save.js';
import { chance, pick, range } from './random.js';

export function createWorld(rng, audio) {
  const city = generateCity(rng);
  const state = {
    rng, city, audio,
    time: 0,
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2,
      hp: PLAYER.hp, armor: 0, cash: 250,
      weapon: 'fists', ammo: { pistol: 48, smg: 0, shotgun: 0 },
      owned: { fists: true, pistol: true, smg: false, shotgun: false },
      inCar: null, wanted: 0, wantedTimer: 0, lastCrime: -999,
      fireTimer: 0, aimAngle: 0, prevMouseDown: false,
    },
    cars: [], peds: [], enemies: [], cops: [], bullets: [], particles: [],
    dangers: [],
    mission: null, missionsDone: 0,
    dialogue: null, shop: null,
    taxi: { active: false },
    stats: { kills: 0, carsStolen: 0, fares: 0, postcards: 0, pedsHit: 0 },
    toasts: [],
    flash: 0,
    camera: { x: SPAWN.x, y: SPAWN.y, zoom: 0.8 },
    over: null,
    dusk: 0, // 0 = day, 1 = dusk (used by screenshot scenes)
  };

  // Parked cars around the city, plus the Comet GT in the Impound Lot.
  for (let i = 0; i < 10; i += 1) {
    const car = spawnParkedCar(city, rng);
    if (car) state.cars.push(car);
  }
  const comet = createCar(1200, 1560, 0, 'sports', 'parked');
  comet.color = '#d84a5a';
  state.cars.push(comet);

  // Traffic and pedestrians to start with.
  for (let i = 0; i < 14; i += 1) {
    const p = randomRoadPoint(rng);
    const car = createCar(p.x, p.y, chance(rng, 0.5) ? 0 : Math.PI / 2, pick(rng, ['sedan', 'sedan', 'pickup', 'van', 'taxi']), 'traffic');
    state.cars.push(car);
  }
  for (let i = 0; i < 26; i += 1) state.peds.push(createPed(city, rng));

  // --- helpers the modules call back into ---
  state.toast = (text, seconds) => {
    state.toasts.push({ text, until: state.time + (seconds || 3) });
    if (state.toasts.length > 3) state.toasts.shift();
  };
  state.addWanted = (n, reason) => {
    const p = state.player;
    const before = p.wanted;
    p.wanted = Math.min(WANTED.max, p.wanted + n);
    p.lastCrime = state.time;
    if (p.wanted > before) state.toast(`Wanted level ${p.wanted} — ${reason}`, 2.5);
  };
  state.fireBullet = (x, y, angle, speed, damage, from, life) => {
    state.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage, from, life: life || 1.1,
    });
    state.dangers.push({ x, y, until: state.time + 1.5 });
  };
  state.save = () => saveGame(state);
  state.wasted = () => {
    if (state.over) return;
    const lost = Math.floor(state.player.cash * 0.1);
    state.player.cash -= lost;
    state.over = { type: 'wasted', lost };
    state.audio.fail();
  };
  state.busted = () => {
    if (state.over) return;
    const lost = Math.min(200, state.player.cash);
    state.player.cash -= lost;
    state.over = { type: 'busted', lost };
    state.audio.fail();
  };

  // A saved game, if one exists, replaces the fresh start.
  const saved = loadGame();
  if (saved) applySave(state, saved);
  return state;
}

function applySave(state, saved) {
  const p = state.player;
  p.x = saved.x;
  p.y = saved.y;
  p.cash = saved.cash;
  p.hp = saved.hp;
  p.armor = saved.armor;
  p.weapon = saved.weapon;
  p.ammo = saved.ammo;
  p.owned = saved.owned;
  p.wanted = 0;
  state.missionsDone = saved.missionsDone;
  state.stats = { ...state.stats, ...saved.stats };
  for (const card of state.city.postcards) {
    if (saved.postcards && saved.postcards.includes(`${Math.round(card.x)},${Math.round(card.y)}`)) card.found = true;
  }
  state.camera.x = p.x;
  state.camera.y = p.y;
}

/** Respawn after wasted/busted: clinic or safehouse, heat gone. */
export function respawn(state) {
  const p = state.player;
  const place = state.over && state.over.type === 'busted' ? state.city.places.safehouse : state.city.places.clinic;
  p.x = place.x;
  p.y = place.y;
  p.hp = PLAYER.hp;
  p.armor = 0;
  p.wanted = 0;
  p.inCar = null;
  state.cops = [];
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  state.enemies = [];
  state.over = null;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.save();
}

function ensurePolice(state) {
  const p = state.player;
  if (p.wanted === 0) {
    // The heat is off: the police drive away.
    state.cars = state.cars.filter((c) => c.driver !== 'police');
    state.cops = [];
    return;
  }
  const want = WANTED.policeCars[p.wanted] || 0;
  const have = state.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  for (let i = have; i < want; i += 1) {
    // Spawn on a road a little way off, so they drive in.
    let x;
    let y;
    for (let tries = 0; tries < 12; tries += 1) {
      const pt = randomRoadPoint(state.rng);
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d > 600 && d < 1100) { x = pt.x; y = pt.y; break; }
    }
    if (x === undefined) continue;
    const car = createCar(x, y, 0, 'police', 'police');
    state.cars.push(car);
  }
  // Foot cops when the heat is on and the player is walking.
  if (p.wanted >= WANTED.footCopsAt && !p.inCar) {
    const cops = state.cops.filter((c) => !c.dead).length;
    if (cops < 2) {
      const pt = nearestRoadPoint(p.x + range(state.rng, -300, 300), p.y + range(state.rng, -300, 300));
      state.cops.push(createFootCop(pt.x, pt.y));
    }
  }
}

function updateWanted(state, dt) {
  const p = state.player;
  if (p.wanted === 0) return;
  const nearPolice = state.cars.some((c) => c.driver === 'police' && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 600)
    || state.cops.some((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 500);
  if (!nearPolice && state.time - p.lastCrime > WANTED.decayBase + WANTED.decayPerStar * p.wanted) {
    p.wanted -= 1;
    p.lastCrime = state.time;
    state.toast(p.wanted === 0 ? 'You lost the cops' : `Wanted level down to ${p.wanted}`, 2);
  }
}

function stepPlayer(state, dt, input, view) {
  const p = state.player;
  const actions = input.takeActions();
  p.fireTimer -= dt;

  // Weapon switch (1-4, 5 = armour is shop-only).
  const weaponKey = input.takeWeaponKey();
  if (weaponKey && weaponKey !== 'armor' && p.owned[weaponKey]) {
    p.weapon = weaponKey;
    state.audio.click();
  }

  if (actions & ACTION_MUTE) {
    state.audio.setMuted(!state.audio.isMuted());
    state.toast(state.audio.isMuted() ? 'Sound off' : 'Sound on', 1.5);
  }

  if (p.inCar) {
    // H in a taxi starts a fare; otherwise it honks. E gets out.
    if (actions & ACTION_HONK) {
      if (p.inCar.model === 'taxi' && !state.taxi.active) startTaxiFare(state);
      else state.audio.horn();
    }
    if (actions & ACTION_INTERACT) { // get out
      const car = p.inCar;
      car.driver = 'parked';
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      const pos = { x: p.x, y: p.y };
      resolveCircle(state.city, pos, PLAYER.radius);
      p.x = pos.x;
      p.y = pos.y;
      p.inCar = null;
      state.audio.click();
    }
    return;
  }

  // On foot: move, collide, aim, shoot.
  const move = input.move();
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (move.x !== 0 || move.y !== 0) {
    p.angle = Math.atan2(move.y, move.x);
    const nx = p.x + move.x * speed * dt;
    const ny = p.y + move.y * speed * dt;
    if (!isWater(nx, p.y)) p.x = nx;
    if (!isWater(p.x, ny)) p.y = ny;
    const pos = { x: p.x, y: p.y };
    resolveCircle(state.city, pos, PLAYER.radius);
    p.x = pos.x;
    p.y = pos.y;
  }

  // Aim at the mouse (screen space -> world space via the camera).
  const cam = state.camera;
  const px = (input.mouse().x - view.w / 2) / cam.zoom + cam.x;
  const py = (input.mouse().y - view.h / 2) / cam.zoom + cam.y;
  p.aimAngle = Math.atan2(py - p.y, px - p.x);

  const mouse = input.mouse();
  const weapon = WEAPONS[p.weapon];
  if (mouse.down && p.fireTimer <= 0) {
    if (p.weapon === 'fists') {
      // A swing: hits anything very close in front of the player.
      p.fireTimer = weapon.rate;
      state.particles.push({ x: p.x + Math.cos(p.aimAngle) * 24, y: p.y + Math.sin(p.aimAngle) * 24, kind: 'swing', life: 0.15, max: 0.15 });
      for (const e of state.enemies) {
        if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 40) {
          e.hp -= weapon.damage;
          if (e.hp <= 0) { e.dead = true; state.stats.kills += 1; }
        }
      }
      for (const ped of state.peds) {
        if (!ped.dead && ped.down <= 0 && Math.hypot(ped.x - p.x, ped.y - p.y) < 36) knockPed(state, ped, true);
      }
    } else if (fireWeapon(state, p, p.aimAngle)) {
      p.fireTimer = weapon.rate;
    } else {
      p.fireTimer = 0.25;
    }
  }

  // Interact: enter a car, use a place, start a mission.
  if (actions & ACTION_INTERACT) {
    if (interact(state)) return;
    const car = nearestEnterableCar(state);
    if (car) {
      const wasTraffic = car.driver === 'traffic';
      if (wasTraffic) {
        state.addWanted(1, 'Stole a car');
        state.stats.carsStolen = (state.stats.carsStolen || 0) + 1;
        const ped = createPed(state.city, state.rng, car.x, car.y);
        ped.flee = 4;
        state.peds.push(ped);
      }
      car.driver = 'player';
      car.speed = 0;
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      state.audio.click();
    }
  }
}

export function stepWorld(state, dt, input, view) {
  state.time += dt;
  const p = state.player;

  // The shop pauses the world; its keys buy things, E closes it.
  if (state.shop) {
    const key = input.takeWeaponKey();
    if (key) buyFromShop(state, key);
    const actions = input.takeActions();
    if (actions & ACTION_INTERACT) state.shop = null;
    return;
  }
  // Dialogue pauses the world.
  if (state.dialogue) return;

  stepPlayer(state, dt, input, view);
  updateCars(state, dt, input);
  updatePeds(state, dt);
  updateEnemies(state, dt);
  updateFootCops(state, dt);
  updateBullets(state, dt);
  updateMission(state, dt);
  updateTaxi(state, dt);
  updatePostcards(state);
  updateSprayShop(state);
  ensurePolice(state);
  updateWanted(state, dt);

  // Car hits a pedestrian.
  if (p.inCar && Math.abs(p.inCar.speed) > 120) {
    for (const ped of state.peds) {
      if (ped.dead || ped.down > 0) continue;
      if (Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 34) {
        knockPed(state, ped, true);
        p.inCar.speed *= 0.85;
        state.audio.thud();
      }
    }
    // The player's car can run over enemies too.
    for (const e of state.enemies) {
      if (!e.dead && Math.hypot(e.x - p.inCar.x, e.y - p.inCar.y) < 34) {
        e.hp -= 50;
        if (e.hp <= 0) { e.dead = true; state.stats.kills += 1; }
        p.inCar.speed *= 0.85;
      }
    }
  }

  // Particles and dangers age out.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    state.particles[i].life -= dt;
    if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }
  state.dangers = state.dangers.filter((d) => d.until > state.time);
  state.toasts = state.toasts.filter((t) => t.until > state.time);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2);

  // Siren while the police are hunting.
  const policeNear = state.cars.some((c) => c.driver === 'police' && !c.dead);
  state.audio.siren(policeNear && p.wanted > 0, dt);

  // Camera follows the player (or the car), smoothly.
  const cam = state.camera;
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  cam.x += (tx - cam.x) * Math.min(1, 5 * dt);
  cam.y += (ty - cam.y) * Math.min(1, 5 * dt);
}

function buyFromShop(state, key) {
  const p = state.player;
  const items = {
    fists: { name: 'Ammo refill', price: 50, run: () => { p.ammo[p.weapon] = (p.ammo[p.weapon] || 0) + 24; } },
    pistol: { name: 'Pistol', price: 300, run: () => { p.owned.pistol = true; p.ammo.pistol += 24; } },
    smg: { name: 'SMG', price: 800, run: () => { p.owned.smg = true; p.ammo.smg += 60; } },
    shotgun: { name: 'Shotgun', price: 1200, run: () => { p.owned.shotgun = true; p.ammo.shotgun += 12; } },
    armor: { name: 'Body armour', price: 300, run: () => { p.armor = 100; } },
  };
  const item = items[key];
  if (!item) return;
  if (p.cash < item.price) {
    state.toast(`Need $${item.price} for ${item.name}`, 2);
    return;
  }
  p.cash -= item.price;
  item.run();
  state.toast(`Bought ${item.name} (-$${item.price})`, 2);
  state.audio.pickup();
  state.save();
}

export { missionMarker, missionObjective };
