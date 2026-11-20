// Every sound is synthesised with WebAudio: no audio files, no network.
// The engine is a looped oscillator whose pitch follows the car's speed;
// sirens, shots and chimes are short scheduled bursts.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function noiseBuffer(duration) {
    const c = ensure();
    if (!c) return null;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst(freq, duration, type, volume, slideTo) {
    const c = ensure();
    if (!c || muted) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + duration);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  function noiseHit(duration, volume, filterFreq) {
    const c = ensure();
    if (!c || muted) return;
    const buffer = noiseBuffer(duration);
    if (!buffer) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter).connect(gain).connect(c.destination);
    source.start();
  }

  return {
    /** Call once from a user gesture so the context is allowed to start. */
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
      }
    },
    isMuted() {
      return muted;
    },
    /** Continuous engine note; speed 0..1, off when not driving. */
    engine(speed, on) {
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = c.createGain();
        engineGain.gain.value = 0;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        engineOsc.connect(filter).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      const target = on && !muted ? 0.03 + speed * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, c.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed * 140, c.currentTime, 0.1);
    },
    /** Two-tone siren while the police are after the player. */
    siren(on, dt) {
      const c = ensure();
      if (!c) return;
      if (!sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = c.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      if (on && !muted) {
        sirenTimer += dt;
        const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
        sirenOsc.frequency.setTargetAtTime(high ? 720 : 540, c.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(0.025, c.currentTime, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
      }
    },
    shot() {
      noiseHit(0.12, 0.25, 1800);
    },
    enemyShot() {
      noiseHit(0.1, 0.12, 1200);
    },
    explosion() {
      noiseHit(0.7, 0.4, 400);
      burst(60, 0.6, 'sine', 0.4, 30);
    },
    pickup() {
      burst(880, 0.12, 'sine', 0.15, 1320);
    },
    coin() {
      burst(1320, 0.09, 'sine', 0.12, 1760);
    },
    click() {
      burst(660, 0.06, 'square', 0.06);
    },
    thud() {
      noiseHit(0.08, 0.2, 300);
    },
    horn() {
      burst(370, 0.18, 'square', 0.08, 370);
      burst(466, 0.18, 'square', 0.06, 466);
    },
    jingle() {
      const c = ensure();
      if (!c || muted) return;
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => burst(freq, 0.18, 'triangle', 0.12), i * 110);
      });
    },
    fail() {
      burst(220, 0.4, 'sawtooth', 0.1, 110);
    },
  };
}
