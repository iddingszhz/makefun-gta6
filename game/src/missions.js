// Costa Verde — missions. Mara calls with five story jobs, in order, each with
// a beacon in the world, an objective line on the HUD and a cash reward.
// Between jobs, a repeatable courier run pays for free-roam driving.
import * as THREE from 'three';
import { MISSION_DEFS, SIDE_JOB_REWARD, STREETS, pick, range } from './config.js';

function randomStreetPoint(rng) {
  const horizontal = rng() > 0.5;
  const street = pick(rng, STREETS);
  const along = range(rng, -260, 260);
  return horizontal ? { x: along, z: street } : { x: street, z: along };
}

export function createMissions(G) {
  const rng = G.rng;
  let index = 0; // next story mission
  let active = null; // { def, stage, target, timer, checkpoints, ... }
  let sideJob = null;
  let completed = 0;

  function setBeacon(x, z) {
    G.city.beacon.position.set(x, 0, z);
    G.city.beacon.visible = true;
  }
  function hideBeacon() {
    G.city.beacon.visible = false;
  }

  function startStory(def) {
    const places = G.city.places;
    if (def.id === 'hot-wheels') {
      active = { def, stage: 'steal', target: { ...places.garage } };
      G.hud.setObjective(`${def.title}: Steal any car (press E near one)`);
    } else if (def.id === 'courier-rush') {
      const points = [randomStreetPoint(rng), randomStreetPoint(rng), randomStreetPoint(rng)];
      active = { def, stage: 'run', checkpoints: points, checkpointIndex: 0, timer: def.timeLimit, target: points[0] };
      setBeacon(points[0].x, points[0].z);
      G.hud.setObjective(`${def.title}: Checkpoint 1 of 3 — ${Math.ceil(def.timeLimit)}s left`);
    } else if (def.id === 'heat-check') {
      active = { def, stage: 'raise', target: null };
      G.hud.setObjective(`${def.title}: Get to 3 stars — steal a car, cause chaos`);
    } else if (def.id === 'the-pickup') {
      active = { def, stage: 'pickup', target: { ...places.coralAve } };
      setBeacon(places.coralAve.x, places.coralAve.z);
      G.hud.setObjective(`${def.title}: Pick up the passenger on Coral Ave`);
    } else if (def.id === 'the-big-score') {
      active = { def, stage: 'rob', target: { ...places.store }, robTimer: 0 };
      setBeacon(places.store.x, places.store.z);
      G.hud.setObjective(`${def.title}: Rob the Sunrise Mart — stand in the marker`);
    }
    G.hud.showMissionCard(def.title, def.text);
  }

  function completeMission() {
    const def = active.def;
    G.player.cash += def.reward;
    completed += 1;
    G.hud.banner(`Mission complete: ${def.title} — +$${def.reward}`);
    G.audio.missionDone();
    G.hud.setCash(G.player.cash);
    G.hud.setMissions(completed, MISSION_DEFS.length);
    hideBeacon();
    active = null;
    index += 1;
    G.save();
    if (index >= MISSION_DEFS.length) {
      G.hud.setObjective('All story missions done! Courier jobs still pay — free roam.');
    }
  }

  function failMission(reason) {
    if (!active) return;
    G.hud.banner(`Mission failed: ${reason}`);
    hideBeacon();
    active = null;
    G.hud.setObjective('Talk to Mara — press M for the next job.');
  }

  const missions = {
    get active() {
      return active;
    },
    get sideJob() {
      return sideJob;
    },
    get completed() {
      return completed;
    },
    get nextIndex() {
      return index;
    },
    startNext() {
      if (active) return;
      if (index >= MISSION_DEFS.length) {
        G.hud.banner('No more story jobs — try a courier run (press M).');
        return;
      }
      startStory(MISSION_DEFS[index]);
    },
    startSideJob() {
      if (sideJob || active) return;
      const points = [randomStreetPoint(rng), randomStreetPoint(rng)];
      sideJob = { checkpoints: points, checkpointIndex: 0, target: points[0] };
      setBeacon(points[0].x, points[0].z);
      G.hud.setObjective(`Courier job: Checkpoint 1 of 2 — $${SIDE_JOB_REWARD} on delivery`);
      G.hud.banner('Courier job started — follow the beacon.');
    },
    update(dt) {
      const playerPos = G.player.pos;
      // --- Story mission progress ---
      if (active) {
        const def = active.def;
        if (def.id === 'hot-wheels') {
          if (active.stage === 'steal' && G.player.inCar) {
            active.stage = 'deliver';
            active.target = { ...G.city.places.garage };
            setBeacon(active.target.x, active.target.z);
            G.hud.setObjective(`${def.title}: Deliver the car to Mara's Garage`);
          } else if (active.stage === 'deliver' && G.player.inCar) {
            const d = Math.hypot(playerPos.x - active.target.x, playerPos.z - active.target.z);
            if (d < 8) completeMission();
          }
        } else if (def.id === 'courier-rush') {
          active.timer -= dt;
          const cp = active.checkpoints[active.checkpointIndex];
          const d = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
          G.hud.setObjective(`${def.title}: Checkpoint ${active.checkpointIndex + 1} of 3 — ${Math.max(0, Math.ceil(active.timer))}s left`);
          if (d < 9) {
            G.audio.pickup();
            active.checkpointIndex += 1;
            if (active.checkpointIndex >= active.checkpoints.length) {
              completeMission();
            } else {
              const next = active.checkpoints[active.checkpointIndex];
              active.target = next;
              setBeacon(next.x, next.z);
            }
          } else if (active.timer <= 0) {
            failMission('Out of time on Courier Rush.');
          }
        } else if (def.id === 'heat-check') {
          if (active.stage === 'raise' && G.police.stars >= 3) {
            active.stage = 'lose';
            G.hud.setObjective(`${def.title}: 3 stars! Now lose the heat — get to 0 stars`);
          } else if (active.stage === 'lose' && G.police.stars === 0) {
            completeMission();
          }
        } else if (def.id === 'the-pickup') {
          if (active.stage === 'pickup') {
            const d = Math.hypot(playerPos.x - active.target.x, playerPos.z - active.target.z);
            if (d < 7) {
              active.stage = 'dropoff';
              active.target = { ...G.city.places.marina };
              setBeacon(active.target.x, active.target.z);
              G.police.setStars(2);
              G.hud.setObjective(`${def.title}: Passenger aboard — drop them at the Marina`);
              G.hud.banner('Passenger aboard! The police are onto you.');
            }
          } else if (active.stage === 'dropoff') {
            const d = Math.hypot(playerPos.x - active.target.x, playerPos.z - active.target.z);
            if (d < 8) completeMission();
          }
        } else if (def.id === 'the-big-score') {
          if (active.stage === 'rob') {
            const d = Math.hypot(playerPos.x - active.target.x, playerPos.z - active.target.z);
            if (d < 7 && !G.player.inCar) {
              active.robTimer += dt;
              G.hud.setObjective(`${def.title}: Robbing the store… ${Math.ceil(5 - active.robTimer)}s — stay in the marker`);
              if (active.robTimer >= 5) {
                active.stage = 'escape';
                active.target = { ...G.city.places.hideout };
                setBeacon(active.target.x, active.target.z);
                G.police.setStars(4);
                G.hud.banner('You got the cash! 4 stars — reach the Hideout!');
              }
            } else {
              active.robTimer = Math.max(0, active.robTimer - dt * 2);
              G.hud.setObjective(`${def.title}: Rob the Sunrise Mart — stand in the marker`);
            }
          } else if (active.stage === 'escape') {
            const d = Math.hypot(playerPos.x - active.target.x, playerPos.z - active.target.z);
            if (d < 8) completeMission();
          }
        }
      }

      // --- Courier side job progress ---
      if (sideJob) {
        const cp = sideJob.checkpoints[sideJob.checkpointIndex];
        const d = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
        if (d < 9) {
          G.audio.pickup();
          sideJob.checkpointIndex += 1;
          if (sideJob.checkpointIndex >= sideJob.checkpoints.length) {
            G.player.cash += SIDE_JOB_REWARD;
            G.hud.banner(`Courier job done — +$${SIDE_JOB_REWARD}`);
            G.hud.setCash(G.player.cash);
            G.save();
            sideJob = null;
            hideBeacon();
            G.hud.setObjective('Free roam — press M for the next job.');
          } else {
            const next = sideJob.checkpoints[sideJob.checkpointIndex];
            sideJob.target = next;
            setBeacon(next.x, next.z);
            G.hud.setObjective(`Courier job: Checkpoint 2 of 2 — $${SIDE_JOB_REWARD} on delivery`);
          }
        }
      }
    },
    reset() {
      index = 0;
      active = null;
      sideJob = null;
      completed = 0;
      hideBeacon();
    },
    loadProgress(savedIndex, savedCompleted) {
      index = Math.min(savedIndex, MISSION_DEFS.length);
      completed = savedCompleted;
      G.hud.setMissions(completed, MISSION_DEFS.length);
    },
  };
  return missions;
}
