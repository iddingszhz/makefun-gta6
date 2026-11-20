// Costa Verde v3 — all sound is synthesized with WebAudio. No audio files,
// nothing loaded over the network. Created lazily on the first user gesture
// so browsers allow it.

export function createAudio() {
  let actx = null;
  let bus = null;
  let engOsc = null;
  let engGain = null;
  let sirOsc = null;
  let sirGain = null;
  let sirLfo = null;
  let silent = false;

  function boot() {
    if (actx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      bus = actx.createGain();
      bus.gain.value = 0.5;
      bus.connect(actx.destination);
      // Engine: a low sawtooth whose pitch follows speed, kept quiet.
      engOsc = actx.createOscillator();
      engOsc.type = 'sawtooth';
      engOsc.frequency.value = 55;
      engGain = actx.createGain();
      engGain.gain.value = 0;
      const engFilter = actx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 420;
      engOsc.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(bus);
      engOsc.start();
      // Siren: a sine that swings between two tones on an LFO.
      sirOsc = actx.createOscillator();
      sirOsc.type = 'sine';
      sirOsc.frequency.value = 720;
      sirGain = actx.createGain();
      sirGain.gain.value = 0;
      sirLfo = actx.createOscillator();
      sirLfo.type = 'square';
      sirLfo.frequency.value = 0.7;
      const lfoDepth = actx.createGain();
      lfoDepth.gain.value = 180;
      sirLfo.connect(lfoDepth);
      lfoDepth.connect(sirOsc.frequency);
      sirOsc.connect(sirGain);
      sirGain.connect(bus);
      sirOsc.start();
      sirLfo.start();
    } catch {
      actx = null;
      return false;
    }
    return true;
  }

  function burst(seconds, volume, cutoff) {
    if (!boot()) return;
    const len = Math.floor(actx.sampleRate * seconds);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = actx.createBufferSource();
    src.buffer = buf;
    const filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = actx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start();
  }

  function blip(freq, seconds, volume, shape = 'sine') {
    if (!boot()) return;
    const osc = actx.createOscillator();
    osc.type = shape;
    osc.frequency.value = freq;
    const gain = actx.createGain();
    gain.gain.setValueAtTime(volume, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(bus);
    osc.start();
    osc.stop(actx.currentTime + seconds);
  }

  return {
    unlock() {
      if (boot() && actx.state === 'suspended') actx.resume();
    },
    // Called every frame: speed in m/s, 0 when on foot.
    update(speed, wanted) {
      if (!actx) return;
      const level = silent ? 0 : Math.min(0.09, 0.015 + speed * 0.0022);
      engGain.gain.setTargetAtTime(speed > 0.5 ? level : 0, actx.currentTime, 0.1);
      engOsc.frequency.setTargetAtTime(52 + speed * 3.2, actx.currentTime, 0.08);
      sirGain.gain.setTargetAtTime(silent || wanted < 1 ? 0 : 0.045, actx.currentTime, 0.2);
    },
    gunshot() {
      burst(0.16, 0.5, 2600);
      blip(180, 0.08, 0.25, 'square');
    },
    crash(power = 1) {
      burst(0.25, Math.min(0.6, 0.25 * power), 500);
      blip(70, 0.2, 0.3, 'sine');
    },
    pickup() {
      blip(880, 0.09, 0.2);
      setTimeout(() => blip(1320, 0.12, 0.2), 90);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => blip(f, 0.22, 0.22, 'triangle'), i * 110);
      });
    },
    busted() {
      [392, 311, 233].forEach((f, i) => {
        setTimeout(() => blip(f, 0.3, 0.22, 'triangle'), i * 160);
      });
    },
    // Silence the engine and siren loops (the game-over screen has no update
    // loop, so without this the last loop gains would drone on forever).
    stop() {
      if (!actx) return;
      engGain.gain.setTargetAtTime(0, actx.currentTime, 0.05);
      sirGain.gain.setTargetAtTime(0, actx.currentTime, 0.05);
    },
    toggleMute() {
      silent = !silent;
      if (bus) bus.gain.value = silent ? 0 : 0.5;
      return silent;
    },
  };
}
