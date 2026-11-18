class AlarmPlayer {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;

  private playChimeOnce() {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.14 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.55);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.6);
      });
    } catch {
      // Audio playback blocked or unavailable
    }
  }

  start(vibrate: boolean) {
    this.stop();
    this.playChimeOnce();
    if (vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 200, 300]);
    }
    this.intervalId = window.setInterval(() => {
      this.playChimeOnce();
      if (vibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 200, 300]);
      }
    }, 2200);
  }

  playPreview() {
    this.playChimeOnce();
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }
}

export const alarmPlayer = new AlarmPlayer();
