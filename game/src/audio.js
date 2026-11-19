// Costa Verde — all sound is synthesized with WebAudio. No audio files,
// nothing loaded over the network. Created lazily on the first user gesture
// so browsers allow it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed, kept quiet.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two tones on an LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ensure()) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type = 'sine') {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    // Called every frame: speed in m/s, 0 when on foot.
    update(speed, wanted) {
      if (!ctx) return;
      const target = muted ? 0 : Math.min(0.09, 0.015 + speed * 0.0022);
      engineGain.gain.setTargetAtTime(speed > 0.5 ? target : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + speed * 3.2, ctx.currentTime, 0.08);
      sirenGain.gain.setTargetAtTime(muted || wanted < 1 ? 0 : 0.045, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.16, 0.5, 2600);
      tone(180, 0.08, 0.25, 'square');
    },
    crash(strength = 1) {
      noiseBurst(0.25, Math.min(0.6, 0.25 * strength), 500);
      tone(70, 0.2, 0.3, 'sine');
    },
    pickup() {
      tone(880, 0.09, 0.2);
      setTimeout(() => tone(1320, 0.12, 0.2), 90);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.22, 0.22, 'triangle'), i * 110);
      });
    },
    busted() {
      [392, 311, 233].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.3, 0.22, 'triangle'), i * 160);
      });
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
