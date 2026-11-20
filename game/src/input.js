// Costa Verde — keyboard and mouse input.
// Held keys are read every frame; one-shot presses (interact, shoot, pause, reload)
// are queued as flags and taken once by the loop, so a press is never lost or double-counted.

export const ACT_INTERACT = 1;
export const ACT_SHOOT = 2;
export const ACT_PAUSE = 4;
export const ACT_RELOAD = 8;
export const ACT_CONFIRM = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let wheel = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE' && !event.repeat) actions |= ACT_INTERACT;
    else if (event.code === 'KeyR' && !event.repeat) actions |= ACT_RELOAD;
    else if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) actions |= ACT_PAUSE;
    // Enter only: Space is the handbrake, and a held brake must not confirm
    // a restart the instant the game-over screen appears.
    else if (event.code === 'Enter' && !event.repeat) actions |= ACT_CONFIRM;
    keys.add(event.code);
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || BRAKE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    input.orbitDX += event.clientX - dragX;
    input.orbitDY += event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  // A click (press without much drag) is a shot; a drag orbits the camera.
  canvas.addEventListener('click', (event) => {
    if (Math.abs(event.clientX - dragX) < 6 && Math.abs(event.clientY - dragY) < 6) {
      actions |= ACT_SHOOT;
    }
  });
  canvas.addEventListener('wheel', (event) => {
    wheel += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  const input = {
    orbitDX: 0,
    orbitDY: 0,
    forward() {
      return [...keys].some((k) => FORWARD.has(k));
    },
    back() {
      return [...keys].some((k) => BACK.has(k));
    },
    left() {
      return [...keys].some((k) => LEFT.has(k));
    },
    right() {
      return [...keys].some((k) => RIGHT.has(k));
    },
    run() {
      return [...keys].some((k) => RUN.has(k));
    },
    brake() {
      return [...keys].some((k) => BRAKE.has(k));
    },
    takeOrbit() {
      const dx = input.orbitDX;
      const dy = input.orbitDY;
      input.orbitDX = 0;
      input.orbitDY = 0;
      return { dx, dy };
    },
    takeWheel() {
      const w = wheel;
      wheel = 0;
      return w;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
  return input;
}
