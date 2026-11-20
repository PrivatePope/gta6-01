// Keyboard and pointer input. Held keys give movement and driving; one-shot
// presses (interact, pause, weapon switch, honk, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims and fires.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_HONK = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HONK = new Set(['KeyH']);
const MUTE = new Set(['KeyM']);
const WEAPON_KEYS = { Digit1: 'fists', Digit2: 'pistol', Digit3: 'smg', Digit4: 'shotgun', Digit5: 'armor' };

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };
  let weaponKey = null;

  window.addEventListener('keydown', (event) => {
    if (WEAPON_KEYS[event.code]) {
      weaponKey = WEAPON_KEYS[event.code];
      event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (INTERACT.has(event.code) && !event.repeat) actions |= ACTION_INTERACT;
    else if (PAUSE.has(event.code) && !event.repeat) actions |= ACTION_PAUSE;
    else if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    else if (HONK.has(event.code) && !event.repeat) actions |= ACTION_HONK;
    else if (MUTE.has(event.code) && !event.repeat) actions |= ACTION_MUTE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || CONFIRM.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  const held = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** Movement vector, normalised, from WASD / arrows. */
    move() {
      const x = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
      const y = (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    run() {
      return held(RUN);
    },
    /** Driving: throttle -1..1, steering -1..1 (positive = turn right). */
    drive() {
      return {
        throttle: (held(UP) ? 1 : 0) - (held(DOWN) ? 1 : 0),
        steer: (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0),
        brake: held(CONFIRM),
      };
    },
    mouse() {
      return mouse;
    },
    /** The weapon key pressed since the last call, if any. */
    takeWeaponKey() {
      const key = weaponKey;
      weaponKey = null;
      return key;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
