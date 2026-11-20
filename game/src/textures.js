// Costa Verde v3 — every texture is painted on a canvas at boot, so the
// game ships no image files and loads nothing over the network. The seeded
// RNG draws the speckles, so a seed rebuilds the same walls and roads.

import * as THREE from 'three';

function paint(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tile(t) {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A building face: flat wall, a grid of windows, a few warmly lit, and a
// dark shopfront band along the ground floor.
export function facadeTexture(rng, base, rows, cols) {
  return paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Weathering: faint vertical streaks so big walls do not read flat.
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 28; i += 1) {
      ctx.fillStyle = rng() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(Math.floor(rng() * w), 0, 2 + rng() * 9, h);
    }
    ctx.globalAlpha = 1;
    const mx = 16;
    const my = 16;
    const cw = (w - mx * 2) / cols;
    const ch = (h - my * 2) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = mx + c * cw + cw * 0.22;
        const y = my + r * ch + ch * 0.24;
        const ww = cw * 0.56;
        const wh = ch * 0.52;
        const roll = rng();
        ctx.fillStyle = roll < 0.26 ? '#ffd98a' : roll < 0.44 ? '#9fc4e8' : '#20242e';
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x, y, ww, 2);
      }
    }
    ctx.fillStyle = 'rgba(18,20,28,0.85)';
    ctx.fillRect(0, h - 26, w, 26);
  });
}

// Asphalt with a dashed centre line and pale edge lines, tiled along a road.
export function roadTexture(rng) {
  return tile(paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33363d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 220; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
    ctx.fillStyle = '#d8c25a';
    ctx.fillRect(w / 2 - 2, 10, 4, 38);
    ctx.fillRect(w / 2 - 2, 74, 4, 38);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(5, 0, 3, h);
    ctx.fillRect(w - 8, 0, 3, h);
  }));
}

// Pale pavement tiles with a darker joint grid.
export function pavementTexture(rng) {
  return tile(paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b9ac93';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,80,60,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let i = 0; i < 130; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }));
}

// Warm sand for the beach and the marina edge.
export function sandTexture(rng) {
  return paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9c48f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(160,130,80,0.28)';
    for (let i = 0; i < 280; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 1);
    }
  });
}

// A rooftop from above: flat grey, a darker rim, a vent box and a skylight.
export function roofTexture(rng) {
  return paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6f6a63';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4c4844';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#8b857c';
    ctx.fillRect(18 + rng() * 42, 18 + rng() * 42, 26, 18);
    ctx.fillStyle = '#55504a';
    ctx.fillRect(72 + rng() * 18, 62 + rng() * 28, 14, 14);
  });
}

// Bright striped awning for a shopfront, in one of four colours.
export function awningTexture(rng) {
  const colours = ['#d94f3d', '#2e7f9e', '#e8a13a', '#4f9e57'];
  const colour = colours[Math.floor(rng() * colours.length)];
  return paint(128, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? colour : '#f5efe0';
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
}
