import confetti from "canvas-confetti";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const GOLD = "#FFC94A";

/** Ráfaga de confeti desde el lado del equipo que acierta. */
export function confettiWin(team: 0 | 1, palette: string[]) {
  const colors = [...palette, "#ffffff", GOLD];
  const left = team === 0;
  const base = { colors, zIndex: 60, disableForReducedMotion: false, ticks: 260 };
  confetti({ ...base, particleCount: 140, spread: 70, startVelocity: 62, angle: left ? 62 : 118, origin: { x: left ? 0.08 : 0.92, y: 0.95 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 90, spread: 100, startVelocity: 48, angle: left ? 75 : 105, origin: { x: left ? 0.25 : 0.75, y: 1 } });
  }, 140);
  setTimeout(() => {
    confetti({ ...base, particleCount: 120, spread: 360, startVelocity: 34, gravity: 0.9, scalar: 1.1, origin: { x: 0.5, y: 0.38 } });
  }, 260);
}

/** Lluvia larga de confeti para el podio. Devuelve una función para detenerla. */
export function confettiCelebration(palette: string[], seconds = 6): () => void {
  const colors = [...palette, "#ffffff", GOLD];
  let shapes: confetti.Shape[] | undefined;
  try {
    shapes = ["🏆", "⭐"].map((text) => confetti.shapeFromText({ text, scalar: 3 }));
  } catch {
    shapes = undefined;
  }
  const end = Date.now() + seconds * 1000;
  let stopped = false;
  const frame = () => {
    if (stopped || Date.now() > end) return;
    const common = { colors, zIndex: 60, disableForReducedMotion: false, startVelocity: 58, ticks: 300 };
    confetti({ ...common, particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.85 } });
    confetti({ ...common, particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.85 } });
    if (shapes && Math.random() < 0.12) {
      confetti({ shapes, scalar: 3, particleCount: 1, flat: true, startVelocity: 0, gravity: 0.6, ticks: 400, zIndex: 60, origin: { x: Math.random(), y: -0.1 } });
    }
    requestAnimationFrame(frame);
  };
  confetti({ colors, zIndex: 60, particleCount: 220, spread: 160, startVelocity: 55, origin: { x: 0.5, y: 0.7 }, disableForReducedMotion: false });
  frame();
  return () => {
    stopped = true;
  };
}

export function clearConfetti() {
  confetti.reset();
}

function spawn(layer: HTMLElement, emoji: string, size: number, x: number, y: number): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "fx-emoji";
  el.textContent = emoji;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.fontSize = `${size}px`;
  layer.appendChild(el);
  return el;
}

const WRONG = ["❌", "😬", "🙈", "💥", "😵", "👎", "🤦", "😱", "💔"];
const TIMEOUT = ["⏰", "⌛", "🐢", "😴", "💤", "❌", "😬"];

/** Emojis que estallan desde un punto y salen disparados fuera de la pantalla. */
export function emojiBurst(layer: HTMLElement, opts: { x: number; y: number; timeout?: boolean; count?: number }) {
  const set = opts.timeout ? TIMEOUT : WRONG;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const diag = Math.hypot(W, H);
  const unit = Math.min(W, H);
  const count = opts.count ?? 30;

  // Un emoji grande en el centro que golpea y luego sale volando.
  const hero = spawn(layer, opts.timeout ? "⏰" : "❌", unit * 0.26, opts.x, opts.y);
  hero.animate(
    [
      { transform: "translate(-50%,-50%) scale(0.2) rotate(-20deg)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.15) rotate(6deg)", opacity: 1, offset: 0.18 },
      { transform: "translate(-50%,-50%) scale(1) rotate(-4deg)", opacity: 1, offset: 0.3 },
      { transform: "translate(-50%,-50%) scale(1) rotate(3deg)", opacity: 1, offset: 0.55 },
      { transform: `translate(-50%,-50%) translate(0, ${H}px) scale(0.8) rotate(40deg)`, opacity: 1 },
    ],
    { duration: 1500, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
  ).onfinish = () => hero.remove();

  for (let i = 0; i < count; i++) {
    const el = spawn(layer, pickOne(set), unit * rand(0.05, 0.11), opts.x, opts.y);
    const angle = (i / count) * Math.PI * 2 + rand(-0.25, 0.25);
    const dist = diag * rand(0.75, 1.05);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = rand(-600, 600);
    el.animate(
      [
        { transform: "translate(-50%,-50%) translate(0,0) scale(0.1) rotate(0deg)", opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${dx * 0.07}px, ${dy * 0.07}px) scale(1.25) rotate(${rot * 0.08}deg)`, opacity: 1, offset: 0.14 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(${rand(0.8, 1.6)}) rotate(${rot}deg)`, opacity: 1 },
      ],
      { duration: rand(1300, 2100), delay: rand(60, 260), easing: "cubic-bezier(.2,.65,.35,1)", fill: "both" },
    ).onfinish = () => el.remove();
  }
}

const DESERT = ["🌵", "🦗", "💨", "🏜️", "🍂", "🦗", "🌵"];

/** Pregunta desierta: cactus, grillos y polvo cruzan rodando la pantalla de lado a lado. */
export function desertRoll(layer: HTMLElement) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const unit = Math.min(W, H);
  for (let i = 0; i < 16; i++) {
    const size = unit * rand(0.06, 0.12);
    const y = H * rand(0.5, 0.92);
    const el = spawn(layer, pickOne(DESERT), size, -size, y);
    const travel = W + size * 3;
    const hop = size * rand(0.4, 1.1);
    const turns = rand(1.5, 3.5) * 360;
    const frames: Keyframe[] = [];
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const p = s / steps;
      const bounce = s % 2 === 1 ? -hop : 0;
      frames.push({ transform: `translate(-50%,-50%) translate(${travel * p}px, ${bounce}px) rotate(${turns * p}deg)`, offset: p });
    }
    el.animate(frames, { duration: rand(2400, 3600), delay: rand(0, 900), easing: "linear", fill: "both" }).onfinish = () =>
      el.remove();
  }
}

/** Número de puntos que sube desde el centro y vuela hacia el marcador del equipo. */
export function pointsFly(
  layer: HTMLElement,
  opts: { text: string; background: string; color: string; from: DOMRect; to: DOMRect | null },
) {
  const el = document.createElement("div");
  el.className = "fx-points";
  el.textContent = opts.text;
  el.style.background = opts.background;
  el.style.color = opts.color;
  const sx = opts.from.left + opts.from.width / 2;
  const sy = opts.from.top + opts.from.height / 2;
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  layer.appendChild(el);
  const tx = opts.to ? opts.to.left + opts.to.width / 2 - sx : 0;
  const ty = opts.to ? opts.to.top + opts.to.height / 2 - sy : -sy;
  el.animate(
    [
      { transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1, offset: 0.2 },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: 0.55 },
      { transform: `translate(-50%,-50%) translate(${tx}px, ${ty}px) scale(0.35)`, opacity: 0.2 },
    ],
    { duration: 1500, easing: "cubic-bezier(.6,0,.3,1)", fill: "forwards" },
  ).onfinish = () => el.remove();
}
