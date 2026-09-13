/** Lightweight WebAudio beeps — no external assets */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx)
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

/** Call on first user gesture so iOS/Telegram unlocks audio */
export function resumeAudio() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume();
  } catch {
    /* ignore */
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.08
) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume();
  } catch {
    /* ignore */
  }
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + Math.max(dur, 0.02));
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

/** Soft UI tap */
export function playClickSound() {
  tone(720, 0, 0.035, "sine", 0.035);
}

/** Choice / option select */
export function playSelectSound() {
  tone(540, 0, 0.04, "triangle", 0.04);
  tone(820, 0.03, 0.05, "sine", 0.03);
}

/** Soft chip / bet place */
export function playBetSound() {
  tone(880, 0, 0.06, "sine", 0.06);
  tone(1320, 0.04, 0.08, "triangle", 0.05);
  tone(990, 0.09, 0.1, "sine", 0.035);
}

/** Short spin whoosh */
export function playSpinSound() {
  tone(180, 0, 0.08, "triangle", 0.05);
  tone(220, 0.05, 0.12, "triangle", 0.04);
  tone(160, 0.15, 0.2, "sine", 0.03);
}

/** Win fanfare — brighter / longer */
export function playWinSound() {
  resumeAudio();
  tone(523, 0, 0.14, "sine", 0.11);
  tone(659, 0.12, 0.14, "sine", 0.1);
  tone(784, 0.24, 0.16, "sine", 0.09);
  tone(1046, 0.38, 0.22, "triangle", 0.07);
}

/** Lose down-tone */
export function playLoseSound() {
  resumeAudio();
  tone(320, 0, 0.12, "triangle", 0.07);
  tone(240, 0.12, 0.16, "triangle", 0.06);
  tone(160, 0.26, 0.22, "sine", 0.05);
}

/** Neutral draw */
export function playDrawSound() {
  resumeAudio();
  tone(400, 0, 0.1, "sine", 0.06);
  tone(360, 0.14, 0.12, "sine", 0.05);
}

/** Task / deposit / withdraw success */
export function playSuccessSound() {
  tone(660, 0, 0.07, "sine", 0.07);
  tone(880, 0.07, 0.1, "sine", 0.06);
  tone(1100, 0.14, 0.12, "triangle", 0.04);
}

/** Soft error */
export function playErrorSound() {
  tone(180, 0, 0.1, "sawtooth", 0.035);
  tone(140, 0.08, 0.14, "triangle", 0.03);
}

/** Cancel / refund */
export function playCancelSound() {
  tone(380, 0, 0.07, "triangle", 0.04);
  tone(260, 0.06, 0.12, "sine", 0.035);
}

/** Match found / opponent joined */
export function playMatchSound() {
  tone(480, 0, 0.06, "sine", 0.06);
  tone(640, 0.07, 0.08, "triangle", 0.05);
  tone(800, 0.14, 0.1, "sine", 0.04);
}

/** Copy / subtle confirm */
export function playCopySound() {
  tone(900, 0, 0.04, "sine", 0.04);
  tone(1200, 0.03, 0.05, "sine", 0.03);
}

let wheelTimer: ReturnType<typeof setTimeout> | null = null;

export function startWheelSound(durationMs = 20_000) {
  stopWheelSound();
  resumeAudio();
  const t0 = Date.now();
  const tick = () => {
    const elapsed = Date.now() - t0;
    if (elapsed >= durationMs - 80) {
      stopWheelSound();
      tone(140, 0, 0.12, "sine", 0.04);
      return;
    }
    const p = elapsed / durationMs;
    const interval = 140 + p * p * 420;
    const freq = 480 - p * 240;
    const vol = 0.022 * (1 - p * 0.55);
    tone(freq, 0, 0.035, "triangle", vol);
    wheelTimer = setTimeout(tick, interval);
  };
  tick();
}

export function stopWheelSound() {
  if (wheelTimer != null) {
    clearTimeout(wheelTimer as unknown as number);
    wheelTimer = null;
  }
}
