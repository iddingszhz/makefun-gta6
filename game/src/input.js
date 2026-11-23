// Costa Verde — keyboard and mouse input.
// Held keys are sampled every frame; one-shot presses (interact, shoot,
// pause, reload) are collected as action bits and consumed once by the
// loop, so a press is never lost and never counted twice.

export const ACT_INTERACT = 1;
export const ACT_SHOOT = 2;
export const ACT_PAUSE = 4;
export const ACT_RELOAD = 8;
export const ACT_CONFIRM = 16;
export const ACT_SIDEJOB = 32;

// One-shot bindings: key code -> action bit, fired once per press.
const PRESS_BINDINGS = {
  KeyE: ACT_INTERACT,
  KeyR: ACT_RELOAD,
  KeyP: ACT_PAUSE,
  KeyN: ACT_SIDEJOB,
  Escape: ACT_PAUSE,
  Enter: ACT_CONFIRM, // Enter only: Space is the handbrake, and a held
  // brake must not confirm a restart the moment the game-over screen shows.
};

// Held-key groups, sampled every frame.
const HELD_GROUPS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  brake: ['Space'],
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let orbitX = 0;
  let orbitY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let wheelDelta = 0;

  function heldAny(group) {
    for (const code of HELD_GROUPS[group]) if (held.has(code)) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    const action = PRESS_BINDINGS[e.code];
    if (action !== undefined && !e.repeat) queued |= action;
    held.add(e.code);
    // Keep the page from scrolling or activating buttons on game keys.
    if (Object.values(HELD_GROUPS).some((codes) => codes.includes(e.code))) {
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
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
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
    forward() { return heldAny('forward'); },
    back() { return heldAny('back'); },
    left() { return heldAny('left'); },
    right() { return heldAny('right'); },
    run() { return heldAny('run'); },
    brake() { return heldAny('brake'); },
    takeOrbit() {
      const out = { dx: orbitX, dy: orbitY };
      orbitX = 0;
      orbitY = 0;
      return out;
    },
    takeWheel() {
      const out = wheelDelta;
      wheelDelta = 0;
      return out;
    },
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
  };
}
