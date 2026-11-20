// The renderer: draws the world on the canvas, camera first. Ground, water
// and roads, then buildings with their shadows and rooftops, palms, the
// cars and the people, bullets and particles, and finally the light — a warm
// sun-soaked day, or a dusk gradient when a screenshot scene asks for it.

import { AVENUES, BEACH_Y, MARINA_X, ROAD_W, STREETS, WATER_Y } from './city.js';
import { PALETTE } from './config.js';

export function drawWorld(ctx, state, view) {
  const cam = state.camera;
  const zoom = cam.zoom;
  const w = view.w;
  const h = view.h;
  const left = cam.x - w / 2 / zoom;
  const top = cam.y - h / 2 / zoom;
  const right = cam.x + w / 2 / zoom;
  const bottom = cam.y + h / 2 / zoom;

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-left, -top);

  drawGround(ctx, state, left, top, right, bottom);
  drawRoads(ctx, state, left, top, right, bottom);
  drawPark(ctx, state);
  drawBuildings(ctx, state, left, top, right, bottom);
  drawPalms(ctx, state, left, top, right, bottom);
  drawPlaces(ctx, state);
  drawPostcards(ctx, state);
  drawCars(ctx, state);
  drawPeople(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  drawPlayer(ctx, state);

  ctx.restore();

  // Light: warm day, or dusk when the scene asks for it.
  if (state.dusk > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(255, 140, 70, ${0.16 * state.dusk})`);
    g.addColorStop(0.6, `rgba(200, 90, 90, ${0.10 * state.dusk})`);
    g.addColorStop(1, `rgba(60, 30, 110, ${0.34 * state.dusk})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // The setting sun, low in the west (dimmer at full night).
    const sunAlpha = state.dusk >= 1 ? 0.4 : 0.85;
    const sun = ctx.createRadialGradient(w * 0.12, h * 0.62, 10, w * 0.12, h * 0.62, 260);
    sun.addColorStop(0, `rgba(255, 190, 90, ${0.5 * state.dusk})`);
    sun.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255, 200, 110, ${sunAlpha * state.dusk})`;
    ctx.beginPath();
    ctx.arc(w * 0.12, h * 0.62, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround(ctx, state, left, top, right, bottom) {
  const { time } = state;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(left, top, right - left, bottom - top);
  // Mown stripes, very faint.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  const stripe = 180;
  for (let y = Math.floor(top / stripe) * stripe; y < bottom; y += stripe * 2) {
    ctx.fillRect(left, y, right - left, stripe);
  }
  // Beach sand, then the sea with a slow shimmer.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(left, BEACH_Y, right - left, Math.max(0, bottom - BEACH_Y));
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(left, WATER_Y, right - left, Math.max(0, bottom - WATER_Y));
  ctx.fillStyle = PALETTE.waterDeep;
  for (let x = Math.floor(left / 90) * 90; x < right; x += 90) {
    const wave = Math.sin(time * 1.4 + x * 0.05) * 4;
    ctx.fillRect(x, WATER_Y + 12 + wave, 44, 3);
  }
  // The marina basin.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(MARINA_X, 1400, Math.max(0, right - MARINA_X), 800);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = 1420; y < 2200; y += 70) {
    const wave = Math.sin(time * 1.2 + y * 0.06) * 3;
    ctx.fillRect(MARINA_X + 10 + wave, y, 30, 3);
  }
  // Marina docks: wooden piers into the water.
  ctx.fillStyle = '#8a6a4a';
  for (let y = 1460; y < 2160; y += 140) {
    ctx.fillRect(MARINA_X - 6, y, 90, 14);
  }
  // Boats in the marina.
  ctx.fillStyle = '#f2ede0';
  for (let i = 0; i < 5; i += 1) {
    const by = 1480 + i * 150;
    ctx.beginPath();
    ctx.ellipse(MARINA_X + 120 + (i % 2) * 60, by, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d84a5a';
    ctx.fillRect(MARINA_X + 108 + (i % 2) * 60, by - 18, 8, 18);
    ctx.fillStyle = '#f2ede0';
  }
}

function drawRoads(ctx, state, left, top, right, bottom) {
  ctx.fillStyle = PALETTE.road;
  for (const ave of AVENUES) ctx.fillRect(ave - ROAD_W / 2, 0, ROAD_W, Math.min(bottom, 2700));
  for (const st of STREETS) ctx.fillRect(0, st - ROAD_W / 2, Math.min(right, 3600), ROAD_W);
  // Sidewalks: pale strips along each road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ave of AVENUES) {
    ctx.fillRect(ave - ROAD_W / 2 - 16, 0, 16, Math.min(bottom, 2700));
    ctx.fillRect(ave + ROAD_W / 2, 0, 16, Math.min(bottom, 2700));
  }
  for (const st of STREETS) {
    ctx.fillRect(0, st - ROAD_W / 2 - 16, Math.min(right, 3600), 16);
    ctx.fillRect(0, st + ROAD_W / 2, Math.min(right, 3600), 16);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ave of AVENUES) {
    for (let y = Math.floor(top / 44) * 44; y < bottom; y += 44) {
      if ((y / 44) % 2 === 0) ctx.fillRect(ave - 2, y, 4, 22);
    }
  }
  for (const st of STREETS) {
    for (let x = Math.floor(left / 44) * 44; x < right; x += 44) {
      if ((x / 44) % 2 === 0) ctx.fillRect(x, st - 2, 22, 4);
    }
  }
}

function drawPark(ctx, state) {
  const park = state.city.park;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(park.x, park.y, park.w, park.h);
  // A pond in the middle.
  ctx.fillStyle = PALETTE.water;
  ctx.beginPath();
  ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, 70, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  // Paths.
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
  ctx.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
}

function drawBuildings(ctx, state, left, top, right, bottom) {
  for (const b of state.city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    // Shadow, offset south-east.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    // Walls and roof.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Roof details: a lighter panel and an AC box.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, 10);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 6, 16, 12);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w - 18, b.y + 14, 6, b.h - 28);
    }
  }
}

function drawPalms(ctx, state, left, top, right, bottom) {
  for (const palm of state.city.palms) {
    if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 22);
    ctx.stroke();
    ctx.fillStyle = palm.park ? '#3f7d3a' : '#4a9a3f';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 12, palm.y - 24 + Math.sin(a) * 7, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlaces(ctx, state) {
  const places = state.city.places;
  for (const key of Object.keys(places)) {
    const place = places[key];
    // A signpost: a small coloured square with a letter.
    ctx.fillStyle = '#10131a';
    ctx.fillRect(place.x - 14, place.y - 14, 28, 28);
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letter = { garage: 'L', gun: 'G', spray: 'S', clinic: '+', safehouse: 'H', casino: '$', docks: 'D', lot: 'P' }[place.kind] || '?';
    ctx.fillText(letter, place.x, place.y + 1);
  }
}

function drawPostcards(ctx, state) {
  for (const card of state.city.postcards) {
    if (card.found) continue;
    const bob = Math.sin(state.time * 3 + card.x) * 3;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(card.x, card.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', card.x, card.y + bob + 0.5);
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-28, -14, 58, 30);
  // Body.
  ctx.fillStyle = car.color;
  const len = car.model === 'van' ? 62 : 56;
  const wid = car.model === 'van' ? 30 : 26;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -wid / 2 + 4, 20, wid - 8, 4);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
  ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 6);
  ctx.fillRect(-len / 2, wid / 2 - 9, 3, 6);
  if (car.model === 'taxi') {
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -wid / 2 - 5);
  }
  if (car.driver === 'police') {
    ctx.fillStyle = '#f2ede0';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, -wid / 2 - 5);
    // Flashing light bar.
    const phase = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = phase ? '#e23b3b' : '#3b6fe2';
    ctx.fillRect(-6, -wid / 2 + 2, 12, 6);
  }
  ctx.restore();
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    if (car.dead) {
      // A wreck: dark, smoking.
      ctx.fillStyle = '#2a2a2a';
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillRect(-28, -13, 56, 26);
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, car);
    // Damage smoke.
    if (car.hp < car.maxHp * 0.4) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 8 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPeople(ctx, state) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      // Lying down.
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const e of state.enemies) {
    if (e.dead) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    // A red ring marks hostiles.
    ctx.strokeStyle = 'rgba(226,59,59,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(Math.cos(e.angle) * 4, Math.sin(e.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Health bar.
    ctx.fillStyle = '#10131a';
    ctx.fillRect(-12, -22, 24, 4);
    ctx.fillStyle = '#e23b3b';
    ctx.fillRect(-12, -22, 24 * Math.max(0, e.hp / 70), 4);
    ctx.restore();
  }
  for (const cop of state.cops) {
    if (cop.dead) continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = '#2b3a55';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ede0';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', 0, 3.5);
    if (cop.grab > 0) {
      ctx.fillStyle = '#e23b3b';
      ctx.fillRect(-12, -24, 24 * (cop.grab / 1.2), 4);
    }
    ctx.restore();
  }
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const t = pt.life / pt.max;
    if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255, 220, 120, ${t})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 * t + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = `rgba(160, 20, 20, ${t})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7 * t + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255, 240, 160, ${t})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10 * t + 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'explosion') {
      ctx.fillStyle = `rgba(255, ${Math.floor(120 * t)}, 40, ${t})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 46 * (1 - t) + 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'swing') {
      ctx.strokeStyle = `rgba(240, 240, 240, ${t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 1.5);
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return; // the car shows instead
  ctx.save();
  ctx.translate(p.x, p.y);
  // A white ring so the player is easy to find at a glance.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body, facing the aim when armed, the walk direction otherwise.
  const facing = p.weapon === 'fists' ? p.angle : p.aimAngle;
  ctx.rotate(facing);
  ctx.fillStyle = '#e84a4a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2b134';
  ctx.beginPath();
  ctx.arc(6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // The gun, when armed.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 14, 4);
  }
  ctx.restore();
}
