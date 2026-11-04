// Efectos de sonido sintetizados con Web Audio: no hace falta ningún archivo de audio.

let ctx: AudioContext | null = null;
let muted = false;

export const isMuted = () => muted;
export function setMuted(v: boolean) {
  muted = v;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Debe llamarse dentro de un gesto del usuario (clic o tecla) para desbloquear el audio. */
export function unlockAudio() {
  audio();
}

function tone(
  freq: number,
  at: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {},
) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(at: number, dur: number, gain: number) {
  const c = audio();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 180;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(c.currentTime + at);
}

export const sfx = {
  launch() {
    tone(660, 0, 0.09, { gain: 0.1 });
    tone(990, 0.07, 0.16, { gain: 0.1 });
  },
  buzz(team: 0 | 1) {
    const base = team === 0 ? 523 : 698;
    tone(base, 0, 0.14, { type: "square", gain: 0.08 });
    tone(base * 1.5, 0.08, 0.22, { type: "square", gain: 0.07 });
  },
  blocked() {
    tone(180, 0, 0.08, { type: "square", gain: 0.05 });
  },
  tick(last: boolean) {
    tone(last ? 1400 : 1000, 0, 0.05, { type: "square", gain: 0.04 });
  },
  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.08, 0.4, { type: "triangle", gain: 0.16 }));
    tone(1568, 0.34, 0.6, { gain: 0.06 });
  },
  wrong() {
    tone(196, 0, 0.55, { type: "sawtooth", gain: 0.11, slideTo: 98 });
    tone(185, 0.02, 0.55, { type: "sawtooth", gain: 0.08, slideTo: 92 });
  },
  void() {
    tone(392, 0, 0.28, { type: "triangle", gain: 0.13 });
    tone(330, 0.24, 0.28, { type: "triangle", gain: 0.13 });
    tone(247, 0.48, 0.7, { type: "triangle", gain: 0.13, slideTo: 220 });
  },
  drumroll(seconds: number) {
    for (let t = 0; t < seconds; t += 0.045) noise(t, 0.06, 0.35 + (t / seconds) * 0.5);
  },
  fanfare() {
    const notes: [number, number, number][] = [
      [523.25, 0, 0.18], [523.25, 0.18, 0.12], [523.25, 0.3, 0.12], [698.46, 0.42, 0.7],
      [880, 0.42, 0.7], [783.99, 1.1, 0.16], [880, 1.26, 0.16], [1046.5, 1.42, 1.1],
    ];
    notes.forEach(([f, at, d]) => tone(f, at, d, { type: "triangle", gain: 0.13 }));
    noise(1.42, 0.5, 0.6);
  },
};
