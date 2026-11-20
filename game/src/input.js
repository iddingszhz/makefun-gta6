// Costa Verde v3 — keyboard and mouse input.
// Held keys are read every frame; one-shot presses (interact, shoot, pause,
// reload) are queued as flags and taken once by the loop, so a press is never
// lost or double-counted.

export const ACT_INTERACT = 1;
export const ACT_SHOOT = 2;
export const ACT_PAUSE = 4;
export const ACT_RELOAD = 8;
export const ACT_CONFIRM = 16;

const FWD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);

function inSet(set, keys) {
  for (const k of keys) if (set.has(k)) return true;
  return false;
}

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let orbitX = 0;
  let orbitY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let wheelDelta = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) queued |= ACT_INTERACT;
    else if (e.code === 'KeyR' && !e.repeat) queued |= ACT_RELOAD;
    else if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) queued |= ACT_PAUSE;
    // Enter only: Space is the handbrake, and a held brake must not confirm
    // a restart the instant the game-over screen appears.
    else if (e.code === 'Enter' && !e.repeat) queued |= ACT_CONFIRM;
    held.add(e.code);
    if (inSet(FWD, [e.code]) || inSet(BACK, [e.code]) || inSet(LEFT, [e.code]) || inSet(RIGHT, [e.code]) || inSet(HANDBRAKE, [e.code])) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    orbitX += e.clientX - lastX;
    orbitY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const stopDrag = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  // A click (press without much drag) is a shot; a drag orbits the camera.
  canvas.addEventListener('click', (e) => {
    if (Math.abs(e.clientX - lastX) < 6 && Math.abs(e.clientY - lastY) < 6) {
      queued |= ACT_SHOOT;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    wheelDelta += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  return {
    forward() { return inSet(FWD, held); },
    back() { return inSet(BACK, held); },
    left() { return inSet(LEFT, held); },
    right() { return inSet(RIGHT, held); },
    run() { return inSet(SPRINT, held); },
    brake() { return inSet(HANDBRAKE, held); },
    takeOrbit() {
      const dx = orbitX;
      const dy = orbitY;
      orbitX = 0;
      orbitY = 0;
      return { dx, dy };
    },
    takeWheel() {
      const w = wheelDelta;
      wheelDelta = 0;
      return w;
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
