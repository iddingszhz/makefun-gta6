// Costa Verde — every texture is drawn on a canvas at boot, so the game ships
// no image files and loads nothing over the network.
import * as THREE from 'three';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// A building face: flat wall colour, a grid of windows, some of them warmly lit.
export function makeFacadeTexture(rng, base, floors, cols) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // faint vertical grime streaks so big walls do not read as flat colour
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 24; i += 1) {
      ctx.fillStyle = rng() > 0.5 ? '#000000' : '#ffffff';
      ctx.fillRect(Math.floor(rng() * w), 0, 3 + rng() * 8, h);
    }
    ctx.globalAlpha = 1;
    const marginX = 14;
    const marginY = 14;
    const cellW = (w - marginX * 2) / cols;
    const cellH = (h - marginY * 2) / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = marginX + c * cellW + cellW * 0.2;
        const y = marginY + f * cellH + cellH * 0.22;
        const ww = cellW * 0.6;
        const wh = cellH * 0.56;
        const lit = rng();
        ctx.fillStyle = lit < 0.28 ? '#ffd98a' : lit < 0.45 ? '#9fc4e8' : '#20242e';
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, y, ww, 2);
      }
    }
    // ground-floor shopfront band
    ctx.fillStyle = 'rgba(20,22,30,0.85)';
    ctx.fillRect(0, h - 26, w, 26);
  });
}

// Asphalt with a dashed centre line, tiled along a road strip.
export function makeRoadTexture(rng) {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33363d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 200; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
    ctx.fillStyle = '#d8c25a';
    ctx.fillRect(w / 2 - 2, 8, 4, 40);
    ctx.fillRect(w / 2 - 2, 72, 4, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(6, 0, 3, h);
    ctx.fillRect(w - 9, 0, 3, h);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Pale pavement tiles with a darker grid.
export function makeSidewalkTexture(rng) {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
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
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 120; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Warm sand for the beach strip and the marina edge.
export function makeSandTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9c48f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(160,130,80,0.25)';
    for (let i = 0; i < 260; i += 1) {
      ctx.fillRect(rng() * w, rng() * h, 2, 1);
    }
  });
}

// A rooftop seen from above: flat grey with a darker rim and a vent box.
export function makeRoofTexture(rng) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6f6a63';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4c4844';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#8b857c';
    ctx.fillRect(20 + rng() * 40, 20 + rng() * 40, 26, 18);
    ctx.fillStyle = '#55504a';
    ctx.fillRect(70 + rng() * 20, 60 + rng() * 30, 14, 14);
  });
}

// Bright shop awning stripes for the ground floor of storefront buildings.
export function makeAwningTexture(rng) {
  const colors = ['#d94f3d', '#2e7f9e', '#e8a13a', '#4f9e57'];
  const color = colors[Math.floor(rng() * colors.length)];
  return canvasTexture(128, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? color : '#f5efe0';
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
}
