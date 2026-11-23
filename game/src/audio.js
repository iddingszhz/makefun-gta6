// Costa Verde — every sound is synthesized with WebAudio. No audio files,
// nothing fetched over the network. The audio context is built lazily on
// the first user gesture, so browsers allow it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null; // { osc, gain }
  let siren = null; // { osc, gain, lfo }
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engine = makeLoop('sawtooth', 55, 420, 0);
      siren = makeSiren();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  // A looping voice: oscillator -> lowpass -> gain -> master.
  function makeLoop(type, freq, cutoff, level) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    return { osc, gain };
  }

  // The siren: a sine whose pitch swings on a square-wave LFO.
  function makeSiren() {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 720;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.7;
    const depth = ctx.createGain();
    depth.gain.value = 180;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    return { osc, gain, lfo };
  }

  // A burst of filtered noise that decays: gunshots, crashes, thuds.
  function noiseBurst(seconds, volume, cutoff) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A short tone that fades out: blips, chimes, pickup notes.
  function tone(freq, seconds, volume, shape = 'sine') {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    osc.type = shape;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function arpeggio(notes, step, seconds, volume, shape = 'triangle') {
    notes.forEach((f, i) => {
      setTimeout(() => tone(f, seconds, volume, shape), i * step);
    });
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    // Called every frame: speed in m/s (0 on foot) and the wanted level.
    update(speed, wanted) {
      if (!ctx) return;
      const level = muted ? 0 : Math.min(0.09, 0.015 + speed * 0.0022);
      engine.gain.gain.setTargetAtTime(speed > 0.5 ? level : 0, ctx.currentTime, 0.1);
      engine.osc.frequency.setTargetAtTime(52 + speed * 3.2, ctx.currentTime, 0.08);
      siren.gain.gain.setTargetAtTime(muted || wanted < 1 ? 0 : 0.045, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.16, 0.5, 2600);
      tone(180, 0.08, 0.25, 'square');
    },
    crash(power = 1) {
      noiseBurst(0.25, Math.min(0.6, 0.25 * power), 500);
      tone(70, 0.2, 0.3, 'sine');
    },
    pickup() {
      tone(880, 0.09, 0.2);
      setTimeout(() => tone(1320, 0.12, 0.2), 90);
    },
    missionDone() {
      arpeggio([440, 554, 659, 880], 110, 0.22, 0.22);
    },
    busted() {
      arpeggio([392, 311, 233], 160, 0.3, 0.22);
    },
    // Silence the engine and siren loops. The game-over screen has no
    // update loop, so without this the last loop gains would drone forever.
    stop() {
      if (!ctx) return;
      engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      siren.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
