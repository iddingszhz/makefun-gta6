// Costa Verde — every texture is drawn on a canvas when the game boots, so
// the game ships no image files and fetches nothing over the network. The
// seeded RNG draws the speckles, so one seed always paints the same walls.

import * as THREE from 'three';

// Draw on a fresh canvas, then hand it to Three as a texture.
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A scatter of darker dots: concrete grain, sand, asphalt grit. Every
// texture uses this, so the speckle density is one number to tune.
function speckle(ctx, rng, count, w, h, colour, alpha = 0.08) {
  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i += 1) {
    const s = 1 + rng() * 2;
    ctx.fillRect(rng() * w, rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

export function sandTexture(rng) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9b088';
    ctx.fillRect(0, 0, w, h);
    // Soft dunes: wide, pale arcs.
    for (let i = 0; i < 10; i += 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 40 + rng() * 60, 12 + rng() * 20, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, rng, 900, w, h, '#8a7f63', 0.12);
  });
}

export function roadTexture(rng) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a4d52';
    ctx.fillRect(0, 0, w, h);
    // Centre dashes down the middle of the tile.
    ctx.fillStyle = '#e8e0c0';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 3, y + 8, 6, 34);
    speckle(ctx, rng, 700, w, h, '#000000', 0.1);
  });
}

export function pavementTexture(rng) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8b0a0';
    ctx.fillRect(0, 0, w, h);
    // Paving joints: a grid of faint lines.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    speckle(ctx, rng, 500, w, h, '#000000', 0.06);
  });
}

export function facadeTexture(rng) {
  return canvasTex(256, 256, (ctx, w, h) => {
    // A pale plaster wall with a grid of dark windows and a few lit ones.
    const base = ['#d8cfc0', '#c8b8a8', '#b8c8d8', '#e8d8b8'][Math.floor(rng() * 4)];
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 18 + col * 60;
        const y = 18 + row * 60;
        ctx.fillStyle = rng() > 0.85 ? '#ffe08a' : '#2a3550';
        ctx.fillRect(x, y, 34, 42);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, y, 34, 4);
      }
    }
    speckle(ctx, rng, 300, w, h, '#000000', 0.05);
  });
}

export function roofTexture(rng) {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a4a3a';
    ctx.fillRect(0, 0, w, h);
    // Terracotta tiles: overlapping arcs.
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 8, 0, Math.PI);
        ctx.stroke();
      }
    }
    speckle(ctx, rng, 200, w, h, '#000000', 0.08);
  });
}

export function awningTexture(rng) {
  return canvasTex(128, 128, (ctx, w, h) => {
    // A striped shop awning: alternating coral and cream.
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#d94f3d' : '#f0e8d8';
      ctx.fillRect(i * 16, 0, 16, h);
    }
    speckle(ctx, rng, 100, w, h, '#000000', 0.05);
  });
}
