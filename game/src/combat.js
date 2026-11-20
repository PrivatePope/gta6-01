// Combat: the player's weapons, bullets in flight, and what they hit.
// Bullets are short-lived points with a speed and a damage; the world asks
// this module to fire them and to step them, and it reports hits.

import { WEAPONS } from './config.js';
import { hitBuilding } from './city.js';
import { knockPed } from './people.js';
import { damageCar } from './vehicles.js';

export function fireWeapon(state, shooter, angle) {
  const weapon = WEAPONS[state.player.weapon] || WEAPONS.fists;
  if (state.player.weapon !== 'fists') {
    const ammo = state.player.ammo[state.player.weapon] || 0;
    if (ammo <= 0) {
      state.toast('No ammo — visit Ironworks Arms', 2);
      state.audio.click();
      return false;
    }
    state.player.ammo[state.player.weapon] = ammo - 1;
  }
  const pellets = weapon.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = pellets > 1 ? (i - (pellets - 1) / 2) * 0.09 : 0;
    state.fireBullet(shooter.x, shooter.y, angle + spread, 900, weapon.damage, 'player');
  }
  state.particles.push({ x: shooter.x + Math.cos(angle) * 22, y: shooter.y + Math.sin(angle) * 22, kind: 'muzzle', life: 0.08, max: 0.08 });
  state.audio.shot();
  return true;
}

export function updateBullets(state, dt) {
  const { city, player } = state;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && hitBuilding(city, b.x, b.y, 2)) {
      state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.25, max: 0.25 });
      dead = true;
    }
    if (!dead && b.from === 'player') {
      // Hit an enemy?
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= b.damage;
          state.particles.push({ x: b.x, y: b.y, kind: 'blood', life: 0.3, max: 0.3 });
          if (e.hp <= 0) {
            e.dead = true;
            state.stats.kills = (state.stats.kills || 0) + 1;
            state.particles.push({ x: e.x, y: e.y, kind: 'blood', life: 0.6, max: 0.6 });
          }
          dead = true;
          break;
        }
      }
      // Hit a foot cop? That is a serious crime.
      if (!dead) {
        for (const cop of state.cops) {
          if (cop.dead) continue;
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
            cop.dead = true;
            state.addWanted(1, 'Shot a police officer');
            state.particles.push({ x: b.x, y: b.y, kind: 'blood', life: 0.3, max: 0.3 });
            dead = true;
            break;
          }
        }
      }
      // Hit a pedestrian?
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.dead || ped.down > 0) continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            knockPed(state, ped, true);
            dead = true;
            break;
          }
        }
      }
      // Hit a car?
      if (!dead) {
        for (const car of state.cars) {
          if (car.dead) continue;
          const dx = b.x - car.x;
          const dy = b.y - car.y;
          const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
          const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
          if (Math.abs(along) < 30 && Math.abs(side) < 18) {
            damageCar(state, car, b.damage * 0.5);
            state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.25, max: 0.25 });
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      // Hit the player (on foot) or the player's car.
      if (!player.inCar && Math.hypot(player.x - b.x, player.y - b.y) < 14) {
        damagePlayer(state, b.damage);
        dead = true;
      } else if (player.inCar && Math.hypot(player.inCar.x - b.x, player.inCar.y - b.y) < 30) {
        damageCar(state, player.inCar, b.damage * 0.5);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Damage the player, armour first; wasted at zero health. */
export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.hp <= 0) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  state.flash = 0.5;
  if (p.hp <= 0) {
    p.hp = 0;
    state.wasted();
  }
}
