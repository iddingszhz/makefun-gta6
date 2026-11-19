// Costa Verde — the 2D HUD: wanted stars, cash, health, speed, ammo, objective
// line, a top-down minimap, banners and the title / pause / game-over screens.
// All DOM; the 3D world never draws a pixel of UI.
import { CITY_HALF, MISSION_DEFS, STREETS, WANTED } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud(G) {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let bannerTimer = 0;
  let flashTimer = 0;
  let kick = 0;

  const hud = {
    setWanted(stars) {
      const starsEl = el('stars');
      starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(WANTED.max - stars);
      starsEl.classList.toggle('hot', stars >= 3);
    },
    setCash(cash) {
      el('cash').textContent = `$${cash}`;
    },
    setHealth(health) {
      const bar = el('health-fill');
      bar.style.width = `${Math.max(0, health)}%`;
      bar.classList.toggle('low', health < 30);
    },
    setSpeed(speedKmh, inCar) {
      el('speed').textContent = inCar ? `${Math.round(speedKmh)} km/h` : '';
    },
    setAmmo(ammo, reserve, reloading = false) {
      el('ammo').textContent = reloading ? 'RELOADING…' : `Pistol ${ammo} / ${reserve}`;
    },
    setObjective(text) {
      el('objective').textContent = text;
    },
    setMissions(done, total) {
      el('missions').textContent = `Jobs ${done}/${total}`;
    },
    setClock(seconds) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      el('clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    setBustedProgress(frac) {
      const bar = el('busted');
      bar.style.display = frac > 0 ? 'block' : 'none';
      el('busted-fill').style.width = `${Math.min(100, frac * 100)}%`;
    },
    banner(text) {
      const b = el('banner');
      b.textContent = text;
      b.classList.add('show');
      bannerTimer = 3.2;
    },
    flash(text) {
      const f = el('flash');
      f.textContent = text;
      f.classList.add('show');
      flashTimer = 2.2;
    },
    showMissionCard(title, text) {
      const card = el('mission-card');
      el('mission-card-title').textContent = title;
      el('mission-card-text').textContent = text;
      card.classList.add('show');
      setTimeout(() => card.classList.remove('show'), 6000);
    },
    kickCamera() {
      kick = 0.02;
    },
    takeKick() {
      const k = kick;
      kick = 0;
      return k;
    },
    update(dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el('banner').classList.remove('show');
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) el('flash').classList.remove('show');
      }
    },
    // Top-down map: roads, player arrow, police dots, mission beacon.
    drawMinimap() {
      const size = minimap.width;
      const scale = size / (CITY_HALF * 2 + 40);
      const toMap = (x, z) => [(x + CITY_HALF + 20) * scale, (z + CITY_HALF + 20) * scale];
      mctx.clearRect(0, 0, size, size);
      mctx.fillStyle = 'rgba(20,24,32,0.85)';
      mctx.fillRect(0, 0, size, size);
      // Blocks
      mctx.fillStyle = '#3a3f46';
      for (let i = 0; i < STREETS.length - 1; i += 1) {
        for (let j = 0; j < STREETS.length - 1; j += 1) {
          const [x, z] = toMap(STREETS[i] + 35, STREETS[j] + 35);
          mctx.fillRect(x - 17 * scale, z - 17 * scale, 34 * scale, 34 * scale);
        }
      }
      // Roads
      mctx.strokeStyle = '#8b93a3';
      mctx.lineWidth = 2;
      for (const s of STREETS) {
        const [x1, z1] = toMap(s, -CITY_HALF);
        const [x2, z2] = toMap(s, CITY_HALF);
        mctx.beginPath();
        mctx.moveTo(x1, z1);
        mctx.lineTo(x2, z2);
        mctx.stroke();
        const [x3, z3] = toMap(-CITY_HALF, s);
        const [x4, z4] = toMap(CITY_HALF, s);
        mctx.beginPath();
        mctx.moveTo(x3, z3);
        mctx.lineTo(x4, z4);
        mctx.stroke();
      }
      // Mission / side-job beacon
      const target = G.missions.active?.target ?? G.missions.sideJob?.target;
      if (target) {
        const [x, z] = toMap(target.x, target.z);
        const pulse = 6 + Math.sin(G.time * 5) * 2;
        mctx.fillStyle = '#ffd34d';
        mctx.beginPath();
        mctx.arc(x, z, pulse, 0, Math.PI * 2);
        mctx.fill();
        mctx.fillStyle = '#1c1f26';
        mctx.font = 'bold 10px sans-serif';
        mctx.textAlign = 'center';
        mctx.textBaseline = 'middle';
        mctx.fillText('!', x, z);
      }
      // Police dots
      mctx.fillStyle = '#ff4d4d';
      for (const car of G.police.list) {
        const [x, z] = toMap(car.pos.x, car.pos.z);
        mctx.beginPath();
        mctx.arc(x, z, 3, 0, Math.PI * 2);
        mctx.fill();
      }
      // Player arrow
      const [px, pz] = toMap(G.player.pos.x, G.player.pos.z);
      mctx.save();
      mctx.translate(px, pz);
      mctx.rotate(G.player.heading);
      mctx.fillStyle = '#4fc3f7';
      mctx.beginPath();
      mctx.moveTo(0, -7);
      mctx.lineTo(5, 6);
      mctx.lineTo(-5, 6);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
      // North marker
      mctx.fillStyle = '#eef1f5';
      mctx.font = 'bold 11px sans-serif';
      mctx.textAlign = 'left';
      mctx.fillText('N', 6, 12);
    },
    showScreen(name) {
      for (const screen of ['title', 'pause', 'over']) {
        el(`screen-${screen}`).classList.toggle('show', screen === name);
      }
      el('hud').classList.toggle('dim', name !== null);
    },
    setGameOver(kind, cash, jobs) {
      el('over-title').textContent = kind === 'busted' ? 'BUSTED!' : 'WASTED!';
      el('over-text').textContent = kind === 'busted'
        ? 'The Costa Verde PD caught up with Alex. The crew will have to wait.'
        : 'Alex went down in Costa Verde. The city keeps moving without him.';
      el('over-stats').textContent = `Cash kept: $${cash} · Jobs done: ${jobs}/${MISSION_DEFS.length}`;
    },
  };
  return hud;
}
