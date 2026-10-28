/** Small synthesized sounds and phone haptics. No audio files to download. */
export class Sounds {
  muted = false;
  private ctx?: AudioContext;

  /** Call from a tap: phones only allow audio after a user gesture. */
  wake(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) this.ctx = new AC();
  }

  private tone(freq: number, endFreq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Planting a tree: a soft rising pop. */
  plant(): void {
    this.tone(420, 840, 0.11, 'sine', 0.18);
    buzz(8);
  }
  /** Marking ×: a tiny tick. */
  mark(): void {
    this.tone(1400, 900, 0.03, 'triangle', 0.05);
  }
  /** Press-and-hold toggled ×: a tick you can also feel. */
  hold(): void {
    this.tone(1100, 700, 0.05, 'triangle', 0.07);
    buzz(12);
  }
  /** A rule just got broken. */
  oops(): void {
    this.tone(180, 120, 0.16, 'square', 0.05);
    buzz([20, 40, 20]);
  }
  hint(): void {
    this.tone(660, 660, 0.09, 'sine', 0.1);
    this.tone(990, 990, 0.12, 'sine', 0.08, 0.08);
  }
  solved(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.3, 'triangle', 0.12, i * 0.09));
    buzz([15, 60, 15, 60, 40]);
  }
}

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported (iPhone) */
  }
}
