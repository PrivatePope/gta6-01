// The HUD and the menus, drawn in screen space over the world: wanted
// stars and cash, health and armour, the weapon and ammo, the mission
// objective, the minimap, toasts, the dialogue panel, the gun shop, and the
// title, pause and game-over screens.

import { AVENUES, STREETS } from './city.js';
import { MISSIONS, missionObjective } from './missions.js';
import { RANKS, WEAPONS } from './config.js';
import { taxiMarker } from './activities.js';
import { missionMarker } from './missions.js';

const MINI = 190;

export function drawHUD(ctx, state, screen, view) {
  const { w, h } = view;
  const p = state.player;

  // --- top left: wanted stars + cash + rank ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 22px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = p.wanted > 0 ? '#ffd23e' : 'rgba(242,237,224,0.55)';
  ctx.fillText(stars, 16, 12);
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$${Math.floor(p.cash).toLocaleString('en-US')}`, 16, 42);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,237,224,0.75)';
  ctx.fillText(rankName(p.cash), 16, 68);

  // --- top centre: the objective (taxi fare first, then the mission) ---
  const taxi = taxiMarker(state);
  const objective = taxi ? taxi.label : missionObjective(state);
  if (objective && screen === 'play') {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const ow = ctx.measureText(objective).width + 28;
    ctx.fillStyle = 'rgba(16,19,26,0.78)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - ow / 2, 12, ow, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#f2c230';
    ctx.fillText(objective, w / 2, 19);
    ctx.textAlign = 'left';
  }

  // --- minimap, top right ---
  drawMinimap(ctx, state, w - MINI - 16, 12);

  // --- bottom left: health + armour ---
  const bw = 210;
  ctx.fillStyle = 'rgba(16,19,26,0.78)';
  ctx.beginPath();
  ctx.roundRect(16, h - 58, bw + 16, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(24, h - 50, bw, 10);
  ctx.fillStyle = p.hp > 30 ? '#5fbf5a' : '#e23b3b';
  ctx.fillRect(24, h - 50, bw * Math.max(0, p.hp / 100), 10);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(24, h - 34, bw, 8);
  ctx.fillStyle = '#7fa8c9';
  ctx.fillRect(24, h - 34, bw * Math.max(0, p.armor / 100), 8);
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 24, h - 50);
  ctx.fillText(`ARMOUR ${Math.ceil(p.armor)}`, 24, h - 34);

  // --- bottom right: weapon + ammo, speed when driving ---
  const weapon = WEAPONS[p.weapon];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 17px system-ui, sans-serif';
  const ammo = p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon] || 0);
  ctx.fillText(`${weapon.name}  ${ammo}`, w - 16, h - 52);
  if (p.inCar) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.12)} mph`, w - 16, h - 28);
  } else {
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(242,237,224,0.75)';
    ctx.fillText('WASD move · E interact · Mouse aim · 1-4 weapons · M mute', w - 16, h - 28);
  }
  ctx.textAlign = 'left';

  // --- toasts, bottom centre ---
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  let ty = h - 110;
  for (const toast of state.toasts.slice(-3)) {
    const tw = ctx.measureText(toast.text).width + 24;
    ctx.fillStyle = 'rgba(16,19,26,0.8)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, ty, tw, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#f2ede0';
    ctx.fillText(toast.text, w / 2, ty + 7);
    ty -= 34;
  }
  ctx.textAlign = 'left';

  // --- damage flash ---
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(220, 30, 30, ${state.flash * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  // --- dialogue panel ---
  if (state.dialogue) drawDialogue(ctx, state, view);
  // --- gun shop panel ---
  if (state.shop === 'gun') drawShop(ctx, state, view);
}

function rankName(cash) {
  let name = RANKS[0].name;
  for (const rank of RANKS) if (cash >= rank.cash) name = rank.name;
  return name;
}

function drawMinimap(ctx, state, x, y) {
  const scale = MINI / 3600;
  ctx.fillStyle = 'rgba(16,19,26,0.85)';
  ctx.fillRect(x - 4, y - 4, MINI + 8, 152);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, MINI, 144);
  ctx.clip();
  // Sea and sand.
  ctx.fillStyle = '#3f8fb8';
  ctx.fillRect(x, y + 2460 * scale, MINI, 144 - 2460 * scale);
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(x, y + 2400 * scale, MINI, 60 * scale);
  ctx.fillStyle = '#7fae5a';
  ctx.fillRect(x, y, MINI, 2400 * scale);
  // Roads.
  ctx.fillStyle = '#3d3a38';
  for (const ave of AVENUES) ctx.fillRect(x + ave * scale - 2, y, 4, 144);
  for (const st of STREETS) ctx.fillRect(x, y + st * scale - 2, MINI, 4);
  // Park.
  ctx.fillStyle = '#5d9b4a';
  ctx.fillRect(x + state.city.park.x * scale, y + state.city.park.y * scale, state.city.park.w * scale, state.city.park.h * scale);
  const p = state.player;
  // Mission marker.
  const marker = missionMarker(state);
  if (marker) {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(x + marker.x * scale, y + marker.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // The taxi marker.
  const taxi = taxiMarker(state);
  if (taxi) {
    ctx.fillStyle = '#4fc3b0';
    ctx.beginPath();
    ctx.arc(x + taxi.x * scale, y + taxi.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The next job (L) when no mission is running.
  if (!state.mission && state.missionsDone < MISSIONS.length) {
    const g = state.city.places.garage;
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('L', x + g.x * scale, y + g.y * scale + 4);
    ctx.textAlign = 'left';
  }
  // Police blips.
  ctx.fillStyle = '#3b6fe2';
  for (const car of state.cars) {
    if (car.driver === 'police' && !car.dead) {
      ctx.beginPath();
      ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The player.
  ctx.fillStyle = '#f2ede0';
  ctx.beginPath();
  ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10131a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // North arrow.
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + MINI - 14, y + 16);
}

function drawDialogue(ctx, state, view) {
  const { w, h } = view;
  const d = state.dialogue;
  const line = d.lines[d.index];
  const pw = Math.min(760, w - 80);
  const ph = 110;
  const px = (w - pw) / 2;
  const py = h - ph - 90;
  ctx.fillStyle = 'rgba(16,19,26,0.92)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 10);
  ctx.fill();
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.title, px + 18, py + 16);
  ctx.fillStyle = '#f2ede0';
  ctx.font = '16px system-ui, sans-serif';
  wrapText(ctx, line, px + 18, py + 44, pw - 36, 22);
  ctx.fillStyle = 'rgba(242,237,224,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(d.index + 1 < d.lines.length ? 'E / Space — continue' : 'E / Space — start the job', px + pw - 14, py + ph - 12);
  ctx.textAlign = 'left';
}

function drawShop(ctx, state, view) {
  const { w, h } = view;
  const p = state.player;
  const items = [
    { key: '1', name: 'Ammo refill (+24)', price: 50 },
    { key: '2', name: 'Pistol (+24 ammo)', price: 300 },
    { key: '3', name: 'SMG (+60 ammo)', price: 800 },
    { key: '4', name: 'Shotgun (+12 ammo)', price: 1200 },
    { key: '5', name: 'Body armour (full)', price: 300 },
  ];
  const pw = 420;
  const ph = 300;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ctx.fillStyle = 'rgba(16,19,26,0.94)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 10);
  ctx.fill();
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('IRONWORKS ARMS', px + 20, py + 18);
  ctx.fillStyle = '#f2ede0';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Cash: $${Math.floor(p.cash).toLocaleString('en-US')}`, px + 20, py + 46);
  let y = py + 82;
  for (const item of items) {
    ctx.fillStyle = p.cash >= item.price ? '#f2ede0' : 'rgba(242,237,224,0.4)';
    ctx.fillText(`[${item.key}]  ${item.name}`, px + 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.price}`, px + pw - 20, y);
    ctx.textAlign = 'left';
    y += 32;
  }
  ctx.fillStyle = 'rgba(242,237,224,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Press 1-5 to buy · E to leave', px + 20, py + ph - 16);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function drawTitle(ctx, state, view) {
  const { w, h } = view;
  // Sun-soaked title card over the world.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255, 150, 70, 0.25)');
  g.addColorStop(0.55, 'rgba(16, 19, 26, 0.25)');
  g.addColorStop(1, 'rgba(16, 19, 26, 0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.3);
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('An open-world crime story', w / 2, h * 0.3 + 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,237,224,0.85)';
  ctx.fillText('Jax Carter is back in Solmar — and he owes Vic Marlowe $50,000.', w / 2, h * 0.3 + 86);
  ctx.fillText('Drive, fight, and work the jobs. Pay the debt. Own the city.', w / 2, h * 0.3 + 112);

  const hasSave = state.missionsDone > 0 || state.player.cash !== 250;
  const lines = [
    hasSave ? 'ENTER — Continue' : 'ENTER — New game',
    'WASD / Arrows — move and drive · E — interact · Mouse — aim and shoot',
    '1-4 — weapons · H — taxi fare (in a taxi) · P — pause · M — sound',
    `Missions done: ${state.missionsDone} of ${MISSIONS.length} · Best: $${Math.floor(state.player.cash).toLocaleString('en-US')} earned`,
  ];
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#f2ede0';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.58 + i * 30));
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(16,19,26,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ede0';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', w / 2, h * 0.4);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume · the game saves itself as you play', w / 2, h * 0.4 + 40);
  ctx.textAlign = 'left';
}

export function drawOver(ctx, state, view) {
  const { w, h } = view;
  const over = state.over;
  ctx.fillStyle = 'rgba(16,19,26,0.82)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = over.type === 'wasted' ? '#e23b3b' : '#3b6fe2';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText(over.type === 'wasted' ? 'WASTED' : 'BUSTED', w / 2, h * 0.4);
  ctx.fillStyle = '#f2ede0';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`You lost $${over.lost}. The debt still stands.`, w / 2, h * 0.4 + 44);
  ctx.fillText('ENTER — get back on your feet', w / 2, h * 0.4 + 76);
  ctx.textAlign = 'left';
}
