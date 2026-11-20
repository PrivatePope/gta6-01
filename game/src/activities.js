// Side work: taxi fares, hidden postcards, and the shops. A taxi fare is a
// passenger who wants to go somewhere fast; a postcard is $150 for finding
// one of the twenty hidden around Solmar. Shops are used by walking (or
// driving) into their zone and pressing E.

import { SHOPS, TAXI } from './config.js';
import { randomSidewalkPoint } from './city.js';
import { range } from './random.js';
import { startMission } from './missions.js';

export function startTaxiFare(state) {
  const p = state.player;
  if (!p.inCar || p.inCar.model !== 'taxi') {
    state.toast('You need a taxi for fares', 2);
    return;
  }
  if (state.taxi.active) {
    state.toast('Finish the current fare first', 2);
    return;
  }
  // The nearest pedestrian becomes the passenger.
  let best = null;
  let bestD = 320;
  for (const ped of state.peds) {
    if (ped.dead || ped.down > 0) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  if (!best) {
    state.toast('No passengers nearby — drive somewhere busier', 2);
    return;
  }
  const dest = randomSidewalkPoint(state.rng);
  const dist = Math.hypot(dest.x - best.x, dest.y - best.y);
  state.taxi = {
    active: true,
    phase: 'pickup',
    passenger: best,
    dest,
    timer: 25 + dist * TAXI.timePerMetre,
    fare: Math.round(range(state.rng, TAXI.fareMin, TAXI.fareMax)),
  };
  state.audio.horn();
  state.toast('Passenger waiting — pick them up!', 3);
}

export function updateTaxi(state, dt) {
  const taxi = state.taxi;
  const p = state.player;
  if (!taxi.active) return;
  if (!p.inCar || p.inCar.model !== 'taxi') {
    state.toast('Fare lost — you left the taxi', 2);
    state.taxi = { active: false };
    return;
  }
  taxi.timer -= dt;
  if (taxi.timer <= 0) {
    state.toast('Too slow — the passenger walked away', 2);
    state.taxi = { active: false };
    return;
  }
  if (taxi.phase === 'pickup') {
    const d = Math.hypot(taxi.passenger.x - p.x, taxi.passenger.y - p.y);
    if (d < 60) {
      taxi.phase = 'dropoff';
      taxi.passenger.dead = true; // they are in the cab now
      state.toast('Passenger in — drive to the marker', 3);
    }
  } else {
    const d = Math.hypot(taxi.dest.x - p.x, taxi.dest.y - p.y);
    if (d < 70) {
      const tip = Math.round(Math.max(0, taxi.timer) * TAXI.tipPerSecond);
      const total = taxi.fare + tip;
      p.cash += total;
      state.stats.fares = (state.stats.fares || 0) + 1;
      state.toast(`Fare complete  +$${total} (tip $${tip})`, 3);
      state.audio.jingle();
      state.taxi = { active: false };
      state.save();
    }
  }
}

/** Taxi marker for the HUD/minimap, or null. */
export function taxiMarker(state) {
  const taxi = state.taxi;
  if (!taxi.active) return null;
  if (taxi.phase === 'pickup') return { x: taxi.passenger.x, y: taxi.passenger.y, label: 'Pick up the passenger' };
  return { x: taxi.dest.x, y: taxi.dest.y, label: 'Drop off the passenger' };
}

export function updatePostcards(state) {
  const p = state.player;
  for (const card of state.city.postcards) {
    if (card.found) continue;
    if (Math.hypot(card.x - p.x, card.y - p.y) < 34) {
      card.found = true;
      p.cash += 150;
      state.stats.postcards = (state.stats.postcards || 0) + 1;
      state.toast(`Sunset postcard found! +$150 (${state.stats.postcards}/20)`, 3);
      state.audio.coin();
      state.save();
    }
  }
}

/**
 * What the player can do where they stand: a shop, the garage, the safehouse.
 * Returns a hint string for the HUD, or null.
 */
export function interactionHint(state) {
  const p = state.player;
  const places = state.city.places;
  for (const key of Object.keys(places)) {
    const place = places[key];
    const d = Math.hypot(p.x - place.x, p.y - place.y);
    if (d > place.r) continue;
    if (place.kind === 'garage') {
      if (!state.mission && state.missionsDone < 6) return 'Press E — start the next job';
      return null;
    }
    if (place.kind === 'gun') return 'Press E — Ironworks Arms (buy weapons)';
    if (place.kind === 'clinic') return 'Press E — Solmar Clinic (heal $100)';
    if (place.kind === 'safehouse') return 'Press E — Safehouse (save game)';
    if (place.kind === 'spray') return null; // drive-in, automatic
  }
  // A car to steal?
  if (!p.inCar) {
    for (const car of state.cars) {
      if (car.driver === 'police' || car.dead) continue;
      if (Math.hypot(car.x - p.x, car.y - p.y) < 70) {
        return car.driver === 'parked' ? 'Press E — get in' : 'Press E — steal the car';
      }
    }
  } else {
    return 'Press E — get out of the car';
  }
  return null;
}

/** Run the interaction for the place the player stands in. */
export function interact(state) {
  const p = state.player;
  const places = state.city.places;
  for (const key of Object.keys(places)) {
    const place = places[key];
    const d = Math.hypot(p.x - place.x, p.y - place.y);
    if (d > place.r) continue;
    if (place.kind === 'garage') {
      if (!state.mission && state.missionsDone < 6) {
        startMission(state, state.missionsDone);
        return true;
      }
      return false;
    }
    if (place.kind === 'gun') {
      state.shop = state.shop === 'gun' ? null : 'gun';
      state.audio.click();
      return true;
    }
    if (place.kind === 'clinic') {
      if (p.hp >= 100) {
        state.toast('Already at full health', 2);
      } else if (p.cash < SHOPS.healCost) {
        state.toast('Healing costs $100', 2);
      } else {
        p.cash -= SHOPS.healCost;
        p.hp = 100;
        state.toast('Patched up — full health', 2);
        state.audio.pickup();
      }
      return true;
    }
    if (place.kind === 'safehouse') {
      state.save();
      state.toast('Game saved', 2);
      state.audio.pickup();
      return true;
    }
  }
  return false;
}

/** The spray shop: drive in, the car is repaired and the heat is gone. */
export function updateSprayShop(state) {
  const p = state.player;
  if (!p.inCar) return;
  const spray = state.city.places.spray;
  const d = Math.hypot(p.x - spray.x, p.y - spray.y);
  if (d > spray.r) return;
  if (p.wanted === 0 && p.inCar.hp >= p.inCar.maxHp) return;
  if (p.cash < SHOPS.sprayCost) {
    state.toast('Sunshine Spray costs $500', 2);
    return;
  }
  p.cash -= SHOPS.sprayCost;
  p.wanted = 0;
  p.inCar.hp = p.inCar.maxHp;
  state.cops.forEach((c) => { c.dead = true; });
  state.cops = [];
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  state.toast('Resprayed and clean — wanted level cleared', 3);
  state.audio.jingle();
}
