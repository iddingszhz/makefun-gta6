// Costa Verde — the 2D HUD: wanted stars, cash, health, speed, ammo, the
// objective line, a top-down minimap, banners and the title / pause /
// game-over screens. All DOM; the 3D world never draws a pixel of UI.

import { AVENUES, CITY_EDGE, HEAT, JOBS } from './config.js';

export function createHud(G) {
  const map = document.getElementById('minimap');
  const mctx = map.getContext('2d');
  const el = {};
  for (const id of ['stars', 'cash', 'missions', 'clock', 'health-fill', 'speed', 'ammo', 'objective', 'banner', 'flash', 'busted', 'busted-fill', 'mission-card', 'mission-card-title', 'mission-card-text', 'over-title', 'over-text', 'over-stats', 'hud']) {
    el[id] = document.getElementById(id);
  }
  let bannerLeft = 0;
  let flashLeft = 0;
  let shake = 0;
  let cardTimer = 0; // one timer per card: a new card must not be hidden by the old one's

  function setText(id, value) {
    el[id].textContent = value;
  }

  function showScreen(name) {
    for (const screen of ['title', 'pause', 'over']) {
      document.getElementById(`screen-${screen}`).classList.toggle('show', screen === name);
    }
    el.hud.classList.toggle('dim', name !== null);
  }

  // --- Minimap layers ------------------------------------------------------
  function drawMinimap() {
    const size = map.width;
    const scale = size / (CITY_EDGE * 2 + 40);
    const toMap = (x, z) => [(x + CITY_EDGE + 20) * scale, (z + CITY_EDGE + 20) * scale];
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = 'rgba(20,24,32,0.85)';
    mctx.fillRect(0, 0, size, size);
    // City blocks.
    mctx.fillStyle = '#3a3f46';
    for (let i = 0; i < AVENUES.length - 1; i += 1) {
      for (let j = 0; j < AVENUES.length - 1; j += 1) {
        const [x, z] = toMap(AVENUES[i] + 35, AVENUES[j] + 35);
        mctx.fillRect(x - 17 * scale, z - 17 * scale, 34 * scale, 34 * scale);
      }
    }
    // Roads.
    mctx.strokeStyle = '#8b93a3';
    mctx.lineWidth = 2;
    for (const s of AVENUES) {
      const [x1, z1] = toMap(s, -CITY_EDGE);
      const [x2, z2] = toMap(s, CITY_EDGE);
      mctx.beginPath();
      mctx.moveTo(x1, z1);
      mctx.lineTo(x2, z2);
      mctx.stroke();
      const [x3, z3] = toMap(-CITY_EDGE, s);
      const [x4, z4] = toMap(CITY_EDGE, s);
      mctx.beginPath();
      mctx.moveTo(x3, z3);
      mctx.lineTo(x4, z4);
      mctx.stroke();
    }
    // Mission or side-job beacon, pulsing gold with an exclamation mark.
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
    // Police dots, red.
    mctx.fillStyle = '#ff4d4d';
    for (const car of G.police.list) {
      const [x, z] = toMap(car.pos.x, car.pos.z);
      mctx.beginPath();
      mctx.arc(x, z, 3, 0, Math.PI * 2);
      mctx.fill();
    }
    // The player arrow, pointing where Alex faces.
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
    // North marker.
    mctx.fillStyle = '#eef1f5';
    mctx.font = 'bold 11px sans-serif';
    mctx.textAlign = 'left';
    mctx.fillText('N', 6, 12);
  }

  const hud = {
    setWanted(stars) {
      setText('stars', '★'.repeat(stars) + '☆'.repeat(HEAT.max - stars));
      el.stars.classList.toggle('hot', stars >= 3);
    },
    setCash(cash) {
      setText('cash', `$${cash}`);
    },
    setHealth(health) {
      el['health-fill'].style.width = `${Math.max(0, health)}%`;
      el['health-fill'].classList.toggle('low', health < 30);
    },
    setSpeed(kmh, inCar) {
      setText('speed', inCar ? `${Math.round(kmh)} km/h` : '');
    },
    setAmmo(ammo, spare, reloading = false) {
      setText('ammo', reloading ? 'RELOADING…' : `Pistol ${ammo} / ${spare}`);
    },
    setObjective(text) {
      setText('objective', text);
    },
    setMissions(done, total) {
      setText('missions', `Jobs ${done}/${total}`);
    },
    setClock(seconds) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      setText('clock', `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    },
    setBustedProgress(frac) {
      el.busted.style.display = frac > 0 ? 'block' : 'none';
      el['busted-fill'].style.width = `${Math.min(100, frac * 100)}%`;
    },
    banner(text) {
      setText('banner', text);
      el.banner.classList.add('show');
      bannerLeft = 3.2;
    },
    flash(text) {
      setText('flash', text);
      el.flash.classList.add('show');
      flashLeft = 2.2;
    },
    showMissionCard(title, text) {
      setText('mission-card-title', title);
      setText('mission-card-text', text);
      el['mission-card'].classList.add('show');
      clearTimeout(cardTimer);
      cardTimer = setTimeout(() => el['mission-card'].classList.remove('show'), 6000);
    },
    kickCamera() {
      shake = 0.02;
    },
    takeKick() {
      const k = shake;
      shake = 0;
      return k;
    },
    update(dt) {
      if (bannerLeft > 0) {
        bannerLeft -= dt;
        if (bannerLeft <= 0) el.banner.classList.remove('show');
      }
      if (flashLeft > 0) {
        flashLeft -= dt;
        if (flashLeft <= 0) el.flash.classList.remove('show');
      }
    },
    drawMinimap,
    showScreen,
    setGameOver(kind, cash, jobs) {
      setText('over-title', kind === 'busted' ? 'BUSTED!' : 'WASTED!');
      setText('over-text', kind === 'busted'
        ? 'The Costa Verde PD caught up with Alex. The crew will have to wait.'
        : 'Alex went down in Costa Verde. The city keeps moving without him.');
      setText('over-stats', `Cash kept: $${cash} · Jobs done: ${jobs}/${JOBS.length}`);
    },
  };
  return hud;
}
