/** Lightweight WebAudio beeps — no external assets */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

export function playSpinSound() {
  tone(180, 0, 0.08, "triangle", 0.05);
  tone(220, 0.05, 0.12, "triangle", 0.04);
  tone(160, 0.15, 0.2, "sine", 0.03);
}

export function playWinSound() {
  tone(523, 0, 0.12, "sine", 0.09);
  tone(659, 0.1, 0.12, "sine", 0.08);
  tone(784, 0.2, 0.18, "sine", 0.07);
}

export function playLoseSound() {
  tone(300, 0, 0.1, "triangle", 0.05);
  tone(220, 0.1, 0.18, "triangle", 0.04);
}
