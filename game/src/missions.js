// The story: Jax Carter, ex-getaway driver, is back in Solmar Bay owing
// $50,000 to loan shark Vic Marlowe. Fixer Lena Cruz feeds him jobs. Six
// missions, played in order, each with intro dialogue, steps and a reward.
// A step is a small goal: go somewhere, talk, steal a car, deliver, kill a
// number of enemies, or lose the police. The world module runs them.

import { createEnemy } from './people.js';

export const MISSIONS = [
  {
    id: 'welcome',
    title: 'Welcome Back',
    giver: 'Lena Cruz',
    intro: [
      'LENA: Jax Carter. Back in Solmar after three years, and already Vic Marlowe is asking after you.',
      'LENA: You owe him fifty grand. I can keep him off your back — if you drive for me.',
      'JAX: One job at a time, Lena. Where do I start?',
      'LENA: My garage, downtown. Get yourself a car first. Any car. Then bring it to me.',
    ],
    reward: 500,
    steps: [
      { type: 'goto', place: 'garage', text: 'Go to Lena\'s Garage' },
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'deliverCar', place: 'garage', text: 'Bring the car to the garage' },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Run',
    giver: 'Lena Cruz',
    intro: [
      'LENA: A package is waiting at the Marina Warehouse. Pick it up, drop it at the north end of town.',
      'LENA: The docks are watched. If the cops show, do not stop for a chat.',
    ],
    reward: 1200,
    steps: [
      { type: 'goto', place: 'docks', text: 'Pick up the package at the Marina Warehouse' },
      { type: 'goto', x: 900, y: 300, r: 80, text: 'Deliver the package to the north drop' },
      { type: 'escape', text: 'Lose the cops' },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Lena Cruz',
    intro: [
      'LENA: My friend Theo made a deal that went bad. He is hiding by the park, and the police are already circling.',
      'LENA: Pick him up and get him to the safehouse. Do not let them catch either of you.',
    ],
    reward: 2000,
    steps: [
      { type: 'talk', x: 1500, y: 860, r: 60, wanted: 3, text: 'Pick up Theo by the park' },
      { type: 'goto', place: 'safehouse', text: 'Drive Theo to the safehouse' },
      { type: 'escape', text: 'Lose the cops' },
    ],
  },
  {
    id: 'warehouse',
    title: 'Warehouse Heat',
    giver: 'Lena Cruz',
    intro: [
      'LENA: Vic sent his enforcers to the Marina Warehouse to find my ledger. It is still there — in the office, by the crates.',
      'LENA: Clear them out, grab the ledger, and bring it home. Watch your back.',
    ],
    reward: 2500,
    steps: [
      { type: 'goto', place: 'docks', text: 'Reach the Marina Warehouse' },
      { type: 'kill', count: 6, x: 3300, y: 1800, hp: 60, text: 'Clear out Vic\'s enforcers (0/6)' },
      { type: 'goto', place: 'docks', text: 'Grab the ledger from the office' },
      { type: 'goto', place: 'garage', text: 'Bring the ledger to Lena' },
    ],
  },
  {
    id: 'grandtheft',
    title: 'Grand Theft, Auto',
    giver: 'Lena Cruz',
    intro: [
      'LENA: A Comet GT — the fastest car in Solmar — is sitting in the Impound Lot, and its owner is in no hurry to collect it.',
      'LENA: Take it. Bring it to the garage. The lot has guards, and the police will not be far behind.',
    ],
    reward: 4000,
    steps: [
      { type: 'goto', place: 'lot', text: 'Reach the Impound Lot' },
      { type: 'stealSports', place: 'lot', text: 'Steal the Comet GT' },
      { type: 'deliverCar', place: 'garage', text: 'Deliver the Comet GT to the garage' },
    ],
  },
  {
    id: 'debt',
    title: 'Settle the Debt',
    giver: 'Vic Marlowe',
    intro: [
      'VIC: Fifty grand, Jax. You have been busy, I will give you that. Bring what you have to the Golden Palm.',
      'LENA: It is a setup, Jax. His men will be waiting. Take the money — and take them down.',
      'JAX: Then Solmar is mine again.',
    ],
    reward: 5000,
    steps: [
      { type: 'goto', place: 'casino', text: 'Meet Vic\'s man at the Golden Palm' },
      { type: 'kill', count: 8, x: 2700, y: 720, hp: 70, text: 'Survive the ambush (0/8)' },
      { type: 'goto', place: 'safehouse', text: 'Get to the safehouse' },
      { type: 'escape', text: 'Lose the cops' },
    ],
  },
];

export function startMission(state, idx) {
  const def = MISSIONS[idx];
  if (!def) return false;
  state.mission = { idx, step: 0, def, spawned: false, kills: 0, timer: 0 };
  state.dialogue = { lines: def.intro, index: 0, title: `${def.title} — ${def.giver}` };
  state.toast(`New mission: ${def.title}`, 3);
  return true;
}

function stepTarget(state, step) {
  const places = state.city.places;
  if (step.place) {
    const p = places[step.place];
    return { x: p.x, y: p.y, r: step.r || p.r };
  }
  return { x: step.x, y: step.y, r: step.r || 70 };
}

function spawnStepEnemies(state, step) {
  if (state.mission.spawned) return;
  state.mission.spawned = true;
  state.mission.kills = 0;
  for (let i = 0; i < step.count; i += 1) {
    const angle = (i / step.count) * Math.PI * 2;
    const e = createEnemy(step.x + Math.cos(angle) * 130, step.y + Math.sin(angle) * 130, step.hp || 60);
    state.enemies.push(e);
  }
  state.toast(`${step.count} enforcers — take them down`, 3);
}

/** Where the objective marker points right now, or null. */
export function missionMarker(state) {
  const m = state.mission;
  if (!m) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.type === 'escape') return null;
  if (step.type === 'kill') {
    const alive = state.enemies.filter((e) => !e.dead);
    if (alive.length === 0) return null;
    const cx = alive.reduce((s, e) => s + e.x, 0) / alive.length;
    const cy = alive.reduce((s, e) => s + e.y, 0) / alive.length;
    return { x: cx, y: cy, label: step.text };
  }
  const t = stepTarget(state, step);
  return { x: t.x, y: t.y, label: step.text };
}

/** The objective line for the HUD. */
export function missionObjective(state) {
  const m = state.mission;
  if (!m) {
    return state.missionsDone >= MISSIONS.length
      ? 'Story complete — Solmar is yours. Free roam.'
      : 'Go to the L marker to start the next job';
  }
  const step = m.def.steps[m.step];
  if (!step) return '';
  if (step.type === 'kill') {
    return step.text.replace(/\(\d+\/\d+\)/, `(${m.kills}/${step.count})`);
  }
  return step.text;
}

/** Advance the mission state machine. Returns true when a step completes. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step) {
    // Mission complete.
    const reward = m.def.reward;
    state.player.cash += reward;
    state.missionsDone += 1;
    state.toast(`Mission complete: ${m.def.title}  +$${reward}`, 4);
    state.audio.jingle();
    state.mission = null;
    state.save();
    return;
  }
  const p = state.player;
  const t = stepTarget(state, step);

  switch (step.type) {
    case 'goto':
    case 'talk': {
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d < t.r) {
        if (step.type === 'talk' && step.wanted) {
          state.addWanted(step.wanted, 'Theo is a wanted man');
          state.toast('Theo is in — go!', 3);
        }
        m.step += 1;
        m.spawned = false;
      }
      break;
    }
    case 'steal': {
      if (p.inCar) {
        m.step += 1;
        m.spawned = false;
      }
      break;
    }
    case 'stealSports': {
      if (p.inCar && p.inCar.model === 'sports') {
        state.addWanted(3, 'Stole the Comet GT');
        m.step += 1;
        m.spawned = false;
      }
      break;
    }
    case 'deliverCar': {
      if (p.inCar) {
        const d = Math.hypot(p.x - t.x, p.y - t.y);
        if (d < t.r) {
          m.step += 1;
          m.spawned = false;
        }
      }
      break;
    }
    case 'kill': {
      spawnStepEnemies(state, step);
      m.kills = step.count - state.enemies.filter((e) => !e.dead).length;
      if (m.kills >= step.count) {
        state.enemies = state.enemies.filter((e) => !e.dead);
        m.step += 1;
        m.spawned = false;
      }
      break;
    }
    case 'escape': {
      if (p.wanted === 0) {
        m.step += 1;
        m.spawned = false;
      }
      break;
    }
    default:
      break;
  }
}
