// Costa Verde v3 — jobs. Mara calls with five story jobs, in order, each with
// a beacon in the world, an objective line on the HUD and a cash reward.
// Between jobs, a repeatable courier run pays for free-roam driving.

import * as THREE from 'three';
import { AVENUES, JOBS, SIDE_PAY, between, pickOne } from './config.js';

function streetPoint(rng) {
  const across = rng() > 0.5;
  const avenue = pickOne(rng, AVENUES);
  const along = between(rng, -260, 260);
  return across ? { x: along, z: avenue } : { x: avenue, z: along };
}

// A checkpoint a short drive from `from`, so a timed route is a fair race
// instead of an RNG lottery: three legs of 120–320 m each fit the 90 s limit
// at a casual driving pace, with room to steal a car first.
function chainedPoint(rng, from, minD, maxD) {
  const mid = (minD + maxD) / 2;
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < 24; i += 1) {
    const p = streetPoint(rng);
    const d = Math.abs(p.x - from.x) + Math.abs(p.z - from.z);
    if (d >= minD && d <= maxD) return p;
    const score = Math.abs(d - mid);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function createMissions(G) {
  const rng = G.rng;
  let next = 0; // next story job
  let current = null; // { def, stage, target, timer, checkpoints, ... }
  let courier = null;
  let done = 0;

  function showBeacon(x, z) {
    G.city.beacon.position.set(x, 0, z);
    G.city.beacon.visible = true;
  }
  function hideBeacon() {
    G.city.beacon.visible = false;
  }

  function beginJob(def) {
    const places = G.city.places;
    if (def.id === 'hot-wheels') {
      current = { def, stage: 'steal', target: { ...places.garage } };
      G.hud.setObjective(`${def.title}: Steal any car (press E near one)`);
    } else if (def.id === 'courier-rush') {
      // Chained from the player's spot, so the whole route stays near 600 m
      // and the 90 s limit is the same race every time, not a draw.
      const points = [chainedPoint(rng, { x: G.player.pos.x, z: G.player.pos.z }, 60, 320)];
      for (let i = 1; i < 3; i += 1) points.push(chainedPoint(rng, points[i - 1], 120, 320));
      current = { def, stage: 'run', checkpoints: points, checkpointIndex: 0, timer: def.limit, target: points[0] };
      showBeacon(points[0].x, points[0].z);
      G.hud.setObjective(`${def.title}: Checkpoint 1 of 3 — ${Math.ceil(def.limit)}s left`);
    } else if (def.id === 'heat-check') {
      current = { def, stage: 'raise', target: null };
      G.hud.setObjective(`${def.title}: Get to 3 stars — steal a car, cause chaos`);
    } else if (def.id === 'the-pickup') {
      current = { def, stage: 'pickup', target: { ...places.coralAve } };
      showBeacon(places.coralAve.x, places.coralAve.z);
      G.hud.setObjective(`${def.title}: Pick up the passenger on Coral Ave`);
    } else if (def.id === 'the-big-score') {
      current = { def, stage: 'rob', target: { ...places.store }, robTimer: 0 };
      showBeacon(places.store.x, places.store.z);
      G.hud.setObjective(`${def.title}: Rob the Sunrise Mart — stand in the marker`);
    }
    G.hud.showMissionCard(def.title, def.text);
  }

  function finishJob() {
    const def = current.def;
    G.player.cash += def.reward;
    done += 1;
    G.hud.banner(`Mission complete: ${def.title} — +$${def.reward}`);
    G.audio.missionDone();
    G.hud.setCash(G.player.cash);
    G.hud.setMissions(done, JOBS.length);
    hideBeacon();
    current = null;
    next += 1;
    G.save();
    if (next >= JOBS.length) {
      G.hud.setObjective('All story missions done! Courier jobs still pay — free roam.');
    }
  }

  function dropJob(reason) {
    if (!current) return;
    G.hud.banner(`Mission failed: ${reason}`);
    hideBeacon();
    current = null;
    G.hud.setObjective('Talk to Mara — press M for the next job.');
  }

  const missions = {
    get active() {
      return current;
    },
    get sideJob() {
      return courier;
    },
    get completed() {
      return done;
    },
    get nextIndex() {
      return next;
    },
    startNext() {
      if (current) return;
      if (next >= JOBS.length) {
        G.hud.banner('No more story jobs — try a courier run (press M).');
        return;
      }
      beginJob(JOBS[next]);
    },
    startSideJob() {
      if (courier || current) return;
      const points = [streetPoint(rng), streetPoint(rng)];
      courier = { checkpoints: points, checkpointIndex: 0, target: points[0] };
      showBeacon(points[0].x, points[0].z);
      G.hud.setObjective(`Courier job: Checkpoint 1 of 2 — $${SIDE_PAY} on delivery`);
      G.hud.banner('Courier job started — follow the beacon.');
    },
    update(dt) {
      const pp = G.player.pos;
      // --- Story job progress ---
      if (current) {
        const def = current.def;
        if (def.id === 'hot-wheels') {
          if (current.stage === 'steal' && G.player.inCar) {
            current.stage = 'deliver';
            current.target = { ...G.city.places.garage };
            showBeacon(current.target.x, current.target.z);
            G.hud.setObjective(`${def.title}: Deliver the car to Mara's Garage`);
          } else if (current.stage === 'deliver' && G.player.inCar) {
            const d = Math.hypot(pp.x - current.target.x, pp.z - current.target.z);
            if (d < 8) finishJob();
          }
        } else if (def.id === 'courier-rush') {
          current.timer -= dt;
          const cp = current.checkpoints[current.checkpointIndex];
          const d = Math.hypot(pp.x - cp.x, pp.z - cp.z);
          G.hud.setObjective(`${def.title}: Checkpoint ${current.checkpointIndex + 1} of 3 — ${Math.max(0, Math.ceil(current.timer))}s left`);
          if (d < 9) {
            G.audio.pickup();
            current.checkpointIndex += 1;
            if (current.checkpointIndex >= current.checkpoints.length) {
              finishJob();
            } else {
              const nxt = current.checkpoints[current.checkpointIndex];
              current.target = nxt;
              showBeacon(nxt.x, nxt.z);
            }
          } else if (current.timer <= 0) {
            dropJob('Out of time on Courier Rush.');
          }
        } else if (def.id === 'heat-check') {
          if (current.stage === 'raise' && G.police.stars >= 3) {
            current.stage = 'lose';
            G.hud.setObjective(`${def.title}: 3 stars! Now lose the heat — get to 0 stars`);
          } else if (current.stage === 'lose' && G.police.stars === 0) {
            finishJob();
          }
        } else if (def.id === 'the-pickup') {
          if (current.stage === 'pickup') {
            const d = Math.hypot(pp.x - current.target.x, pp.z - current.target.z);
            if (d < 7) {
              current.stage = 'dropoff';
              current.target = { ...G.city.places.marina };
              showBeacon(current.target.x, current.target.z);
              G.police.setStars(2);
              G.hud.setObjective(`${def.title}: Passenger aboard — drop them at the Marina`);
              G.hud.banner('Passenger aboard! The police are onto you.');
            }
          } else if (current.stage === 'dropoff') {
            const d = Math.hypot(pp.x - current.target.x, pp.z - current.target.z);
            if (d < 8) finishJob();
          }
        } else if (def.id === 'the-big-score') {
          if (current.stage === 'rob') {
            const d = Math.hypot(pp.x - current.target.x, pp.z - current.target.z);
            if (d < 7 && !G.player.inCar) {
              current.robTimer += dt;
              G.hud.setObjective(`${def.title}: Robbing the store… ${Math.ceil(5 - current.robTimer)}s — stay in the marker`);
              if (current.robTimer >= 5) {
                current.stage = 'escape';
                current.target = { ...G.city.places.hideout };
                showBeacon(current.target.x, current.target.z);
                G.police.setStars(4);
                G.hud.banner('You got the cash! 4 stars — reach the Hideout!');
              }
            } else {
              current.robTimer = Math.max(0, current.robTimer - dt * 2);
              G.hud.setObjective(`${def.title}: Rob the Sunrise Mart — stand in the marker`);
            }
          } else if (current.stage === 'escape') {
            const d = Math.hypot(pp.x - current.target.x, pp.z - current.target.z);
            if (d < 8) finishJob();
          }
        }
      }

      // --- Courier side job progress ---
      if (courier) {
        const cp = courier.checkpoints[courier.checkpointIndex];
        const d = Math.hypot(pp.x - cp.x, pp.z - cp.z);
        if (d < 9) {
          G.audio.pickup();
          courier.checkpointIndex += 1;
          if (courier.checkpointIndex >= courier.checkpoints.length) {
            G.player.cash += SIDE_PAY;
            G.hud.banner(`Courier job done — +$${SIDE_PAY}`);
            G.hud.setCash(G.player.cash);
            G.save();
            courier = null;
            hideBeacon();
            G.hud.setObjective('Free roam — press M for the next job.');
          } else {
            const nxt = courier.checkpoints[courier.checkpointIndex];
            courier.target = nxt;
            showBeacon(nxt.x, nxt.z);
            G.hud.setObjective(`Courier job: Checkpoint 2 of 2 — $${SIDE_PAY} on delivery`);
          }
        }
      }
    },
    reset() {
      next = 0;
      current = null;
      courier = null;
      done = 0;
      hideBeacon();
    },
    loadProgress(savedIndex, savedCompleted) {
      next = Math.min(savedIndex, JOBS.length);
      done = savedCompleted;
      G.hud.setMissions(done, JOBS.length);
    },
  };
  return missions;
}
