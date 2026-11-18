export type AmbientSoundType = 'off' | 'rain' | 'brown' | 'ocean' | 'cafe';

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private lfoNode: OscillatorNode | null = null;
  private currentType: AmbientSoundType = 'off';
  private volume = 0.35;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public stop() {
    try {
      this.sourceNode?.stop();
    } catch {
      // ignore
    }
    try {
      this.lfoNode?.stop();
    } catch {
      // ignore
    }
    this.sourceNode?.disconnect();
    this.filterNode?.disconnect();
    this.gainNode?.disconnect();
    this.lfoNode?.disconnect();
    this.sourceNode = null;
    this.filterNode = null;
    this.gainNode = null;
    this.lfoNode = null;
    this.currentType = 'off';
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.05);
    }
  }

  public play(type: AmbientSoundType, vol?: number) {
    if (vol !== undefined) this.volume = Math.max(0, Math.min(1, vol));
    if (type === 'off') {
      this.stop();
      return;
    }
    if (this.currentType === type && this.sourceNode) {
      this.setVolume(this.volume);
      return;
    }

    this.stop();
    const ctx = this.ensureContext();
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise base tailored to sound type
    if (type === 'brown' || type === 'ocean') {
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      }
    } else if (type === 'rain') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    } else {
      // Soft café warm murmur (filtered pink-ish noise)
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.92 + white * 0.08;
        data[i] = last * 2.2;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    if (type === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.5;
    } else if (type === 'brown') {
      filter.type = 'lowpass';
      filter.frequency.value = 320;
    } else if (type === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 480;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.7;
    }

    const gain = ctx.createGain();
    gain.gain.value = this.volume * 0.45;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Gentle wave modulation for ocean
    if (type === 'ocean') {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.lfoNode = lfo;
    }

    source.start();
    this.sourceNode = source;
    this.filterNode = filter;
    this.gainNode = gain;
    this.currentType = type;
  }
}

export const ambientAudio = new AmbientAudioEngine();
