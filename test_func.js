(() => {
  function init() {
      if (initialized) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.28, ctx.currentTime);
        masterGain.connect(ctx.destination);
        startSpaceDrone();
        initialized = true;
      } catch {
        // AudioContext not allowed before user gesture
      }
    }

    function unlock() {
      if (!initialized) init();
      if (ctx && ctx.state === "suspended") {
        ctx.resume();
      }
    }

    function toggleMute(muted) {
      isMuted = muted !== undefined ? muted : !isMuted;
      if (!masterGain || !ctx) return isMuted;
      masterGain.gain.setTargetAtTime(isMuted ? 0 : 0.28, ctx.currentTime, 0.05);
      return isMuted;
    }

    function startSpaceDrone() {
      if (!ctx || spaceDroneNode) return;
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const droneGain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(43.65, ctx.currentTime);
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(43.95, ctx.currentTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(110, ctx.currentTime);
        droneGain.gain.setValueAtTime(0.1, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(droneGain);
        droneGain.connect(masterGain);

        osc1.start();
        osc2.start();
        spaceDroneNode = { osc1, osc2, droneGain };
      } catch {}
    }

    function playImpact(intensity = 1.0) {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(120 * clamp(intensity, 0.6, 2.5), now);
        subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.45);

        subGain.gain.setValueAtTime(0.65 * Math.min(1.4, intensity), now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        subOsc.connect(subGain);
        subGain.connect(masterGain);

        subOsc.start(now);
        subOsc.stop(now + 0.9);

        const bufferSize = Math.floor(ctx.sampleRate * 0.22);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(550, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35 * intensity, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);

        noise.start(now);
      } catch {}
    }

    function playSolarFlare() {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 1.6);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(340, now);
        filter.Q.setValueAtTime(3.5, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2.1);
      } catch {}
    }

    function playOrbitPlacement() {
      if (!ctx || isMuted) return;
      unlock();
      const now = ctx.currentTime;
      try {
        [523.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);

          gain.gain.setValueAtTime(0.16, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75 + idx * 0.1);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.04);
          osc.stop(now + 0.85 + idx * 0.1);
        });
      } catch {}
    }

    return { init, unlock, toggleMute, playImpact, playSolarFlare, playOrbitPlacement };
  }
})();