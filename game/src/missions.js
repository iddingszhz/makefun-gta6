// Costa Verde — jobs. Mara calls with five story jobs, in order, each with
// a beacon in the world, an objective line on the HUD and a cash reward.
// Between jobs, a repeatable courier run pays for free-roam driving.

import * as THREE from 'three';
import { AVENUES, JOBS, SIDE_PAY, between, pickOne } from './config.js';

// A point on a street: one avenue, one position along it.
function streetPoint(rng) {
  const across = rng() > 0.5;
  const avenue = pickOne(rng, AVENUES);
  const along = between(rng, -280, 280);
  return across ? { x: avenue, z: along } : { x: along, z: avenue };
}

// A point in a block, well clear of the buildings' footprints.
function blockPoint(rng) {
  const avenue = pickOne(rng, AVENUES);
  const along = between(rng, -280, 280);
  const offset = 35 + rng() * 20;
  const sign = rng() > 0.5 ? 1 : -1;
  return { x: avenue + offset * sign, z: along };
}

// The glowing ring in the world that marks where to go next.
function makeBeacon(G, x, z, radius = 3) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.5, radius, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.08, z);
  G.scene.add(ring);
  return ring;
}

// The next courier checkpoint: 120–320 m away in Manhattan distance,
// chained so the run is always winnable on the clock.
function nextCheckpoint(rng, from) {
  for (let tries = 0; tries < 50; tries += 1) {
    const p = streetPoint(rng);
    const d = Math.abs(p.x - from.x) + Math.abs(p.z - from.z);
    if (d >= 120 && d <= 320) return p;
  }
  return { x: Math.max(-280, Math.min(280, from.x + 160)), z: from.z };
}

export function createMissions(G) {
  const rng = G.rng;
  const api = {
    active: null,
    nextIndex: 0,
    done: 0,
    sideJob: null,
    beacon: null,
    get completed() { return api.done; },
    startNext() { return api.beginJob(); },
    // Jump the story to a state: done jobs completed, nextIndex the job to
    // start. Used by the play-test suite to reach each job directly.
    loadProgress(done, next) {
      api.done = done;
      api.nextIndex = next;
      G.hud.setMissions(api.done, JOBS.length);
    },
    setBeacon(x, z, radius = 3) {
      if (api.beacon) {
        G.scene.remove(api.beacon);
        api.beacon = null;
      }
      if (x === null || x === undefined) return;
      api.beacon = makeBeacon(G, x, z, radius);
    },
    // Start the next story job. Each job stages itself: it picks its
    // locations, sets the objective and the beacon, and registers a handler
    // that runs every frame until the job completes or fails.
    beginJob() {
      const job = JOBS[api.nextIndex];
      if (!job) return false;
      const player = G.player;
      const active = { ...job, stage: 'start', timer: job.limit || 0, target: null, data: {} };
      if (job.id === 'hot-wheels') {
        active.target = { x: 0, z: 20 };
      } else if (job.id === 'courier-rush') {
        // Three checkpoints, chained so each is 120–320 m from the last.
        active.checkpoints = [];
        let from = player.pos;
        for (let i = 0; i < 3; i += 1) {
          const p = nextCheckpoint(rng, from);
          active.checkpoints.push(p);
          from = p;
        }
        active.checkpointIndex = 0;
        active.target = active.checkpoints[0];
      } else if (job.id === 'heat-check') {
        active.target = null;
      } else if (job.id === 'the-pickup') {
        active.target = streetPoint(rng);
      } else if (job.id === 'the-big-score') {
        active.target = { x: 210, z: -210 };
      }
      // Heat Check starts in its raise stage: get to 3 stars first.
      if (job.id === 'heat-check') active.stage = 'raise';
      api.active = active;
      const objectives = {
        'hot-wheels': 'Hot Wheels: Deliver the car to Mara\'s Garage',
        'courier-rush': 'Courier Rush: Hit all 3 checkpoints before time runs out',
        'heat-check': 'Heat Check: Reach 3 stars, then lose the heat',
        'the-pickup': 'The Pickup: Collect the passenger, then deliver to the Marina',
        'the-big-score': 'The Big Score: Rob the Sunrise Mart, then lose 4 stars and reach the Hideout',
      };
      G.hud.setObjective(objectives[job.id]);
      G.hud.showMissionCard(job.title, job.text);
      G.audio.pickup();
      if (active.target) api.setBeacon(active.target.x, active.target.z);
      return true;
    },
    completeJob() {
      const active = api.active;
      if (!active) return;
      G.cash += active.reward;
      api.done += 1;
      api.nextIndex += 1;
      api.active = null;
      api.setBeacon(null);
      G.hud.setCash(G.cash);
      G.hud.setMissions(api.done, JOBS.length);
      G.hud.banner(`Job Complete: ${active.title} +$${active.reward}`);
      G.hud.showMissionCard(active.title, `Paid $${active.reward}. Mara is impressed.`);
      G.audio.missionDone();
      G.save();
    },
    dropJob() {
      api.active = null;
      api.setBeacon(null);
      G.hud.setObjective('Talk to Mara — press M for the next job.');
    },
    startSideJob() {
      api.sideJob = { target: nextCheckpoint(rng, G.player.pos), paid: SIDE_PAY };
      api.setBeacon(api.sideJob.target.x, api.sideJob.target.z);
      G.hud.setObjective('Side Job: Deliver the package — $150');
      G.hud.banner('Side Job: Courier run — $150');
    },
    completeSideJob() {
      G.cash += api.sideJob.paid;
      api.sideJob = null;
      api.setBeacon(null);
      G.hud.setCash(G.cash);
      G.hud.banner('Side Job Complete: +$150');
      G.audio.missionDone();
      G.save();
    },
    update(dt) {
      const active = api.active;
      const player = G.player;
      if (active) {
        if (active.timer > 0) {
          active.timer -= dt;
          if (active.timer <= 0) {
            G.hud.flash(`${active.title} failed — out of time`);
            api.dropJob();
            return;
          }
        }
        const handler = HANDLERS[active.id];
        if (handler) handler(active, dt);
      }
      // A courier beacon you drive through pays out.
      if (api.sideJob) {
        const p = api.sideJob.target;
        if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 4) api.completeSideJob();
      }
      if (api.beacon) {
        api.beacon.rotation.z += dt * 1.5;
        api.beacon.scale.setScalar(1 + Math.sin(G.time * 4) * 0.08);
      }
    },
    reset() {
      api.active = null;
      api.nextIndex = 0;
      api.done = 0;
      api.sideJob = null;
      api.setBeacon(null);
    },
  };

  // One handler per job id. Each returns nothing; it completes or fails the
  // job by calling completeJob / dropJob, or moves the job to its next phase.
  const HANDLERS = {
    'hot-wheels'(job) {
      const player = G.player;
      const garage = { x: 0, z: 20 };
      if (player.inCar && player.car && Math.hypot(player.pos.x - garage.x, player.pos.z - garage.z) < 8) {
        api.completeJob();
      }
    },
    'courier-rush'(job) {
      const player = G.player;
      if (Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 5) {
        job.checkpointIndex += 1;
        if (job.checkpointIndex >= job.checkpoints.length) {
          api.completeJob();
        } else {
          job.target = job.checkpoints[job.checkpointIndex];
          api.setBeacon(job.target.x, job.target.z);
          const left = job.checkpoints.length - job.checkpointIndex;
          G.hud.setObjective(`Courier Rush: ${left} checkpoint${left > 1 ? 's' : ''} left — ${Math.ceil(job.timer)}s`);
          G.audio.pickup();
        }
      }
    },
    'heat-check'(job) {
      const wanted = G.police.wanted;
      if (job.stage === 'raise' && wanted >= 3) {
        job.stage = 'lose';
        G.hud.setObjective('Heat Check: Now lose the heat — get to 0 stars');
      } else if (job.stage === 'lose' && wanted === 0) {
        api.completeJob();
      }
    },
    'the-pickup'(job) {
      const player = G.player;
      if (job.stage === 'start') {
        if (Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 5) {
          job.stage = 'dropoff';
          job.target = { x: 280, z: 280 };
          api.setBeacon(job.target.x, job.target.z);
          G.hud.setObjective('The Pickup: Passenger aboard — deliver to the Marina');
          G.audio.pickup();
          if (G.police.wanted < 2) G.police.addHeat(2, 'Passenger pickup');
        }
      } else if (job.stage === 'dropoff') {
        if (Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 8) {
          api.completeJob();
        }
      }
    },
    'the-big-score'(job, dt) {
      const player = G.player;
      if (job.stage === 'start') {
        if (Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 6) {
          job.stage = 'rob';
          job.robTimer = 0;
          G.hud.setObjective('The Big Score: Rob the store — 0/30s');
          G.audio.pickup();
          G.police.addHeat(2, 'Robbery in progress');
        }
      } else if (job.stage === 'rob') {
        // The robbery only progresses while Alex stands in the store; step
        // outside and the timer drains away twice as fast.
        const inside = Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 6;
        if (inside) {
          job.robTimer += dt;
          G.hud.setObjective(`The Big Score: Rob the store — ${Math.ceil(job.robTimer)}/30s`);
        } else {
          job.robTimer = Math.max(0, job.robTimer - dt * 2);
        }
        if (job.robTimer >= 30) {
          job.stage = 'escape';
          job.target = { x: -280, z: 280 };
          api.setBeacon(job.target.x, job.target.z);
          G.hud.setObjective('The Big Score: Lose 4 stars and reach the Hideout');
          if (G.police.wanted < 4) G.police.addHeat(4 - G.police.wanted, 'The Big Score');
        }
      } else if (job.stage === 'escape') {
        if (G.police.wanted === 0 && Math.hypot(player.pos.x - job.target.x, player.pos.z - job.target.z) < 8) {
          api.completeJob();
        }
      }
    },
  };
  return api;
}
