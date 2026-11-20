// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there, with the HUD on top. The game moves between
// four screens: title, play, paused and game over. Dialogue and the gun shop
// pause the world while they are open.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|street|mission|night
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, respawn, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawWorld } from './render.js';
import { drawHUD, drawOver, drawPaused, drawTitle } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const audio = createAudio();
const world = createWorld(createRandom(seed), audio);

function view() {
  return { w: canvas.width, h: canvas.height };
}

function runShot(name) {
  const scene = stageShot(name, world, stepWorld, view());
  let painted = 0;
  function paint() {
    drawWorld(ctx, world, view());
    drawHUD(ctx, world, scene.screen, view());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (world.dialogue) {
      if (actions & (ACTION_CONFIRM | ACTION_INTERACT)) {
        world.dialogue.index += 1;
        if (world.dialogue.index >= world.dialogue.lines.length) world.dialogue = null;
        audio.click();
      }
      return;
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        screen = 'play';
        announce('Playing. Follow the objective at the top of the screen.');
      }
      return;
    }
    if (screen === 'over') {
      if (actions & ACTION_CONFIRM) {
        respawn(world);
        screen = 'play';
        announce('Back on your feet.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === 'play' ? 'paused' : 'play';
      announce(screen === 'paused' ? 'Paused.' : 'Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'title') {
      // The city lives behind the menu: traffic and pedestrians move.
      while (accumulator >= STEP) {
        stepWorld(world, STEP, input, view());
        accumulator -= STEP;
      }
      drawWorld(ctx, world, view());
      drawTitle(ctx, world, view());
      return;
    }
    if (screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(world, STEP, input, view());
        accumulator -= STEP;
      }
      if (world.over) {
        screen = 'over';
        announce(world.over.type === 'wasted' ? 'Wasted.' : 'Busted.');
      }
    } else {
      accumulator = 0;
    }
    drawWorld(ctx, world, view());
    drawHUD(ctx, world, screen, view());
    if (screen === 'paused') drawPaused(ctx, view());
    if (screen === 'over') drawOver(ctx, world, view());
  }

  // Leaving the tab pauses a running game rather than letting the police catch the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
