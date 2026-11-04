/** Teclas que usa el moderador; no pueden asignarse a un equipo. */
export const RESERVED_KEYS = new Set<string>([
  "Space", "Enter", "Escape", "Tab",
  "KeyC", "KeyX", "KeyZ", "KeyP", "KeyS", "KeyM", "KeyF", "KeyH", "KeyT",
  // Zoom de la interfaz: − / + / 0. Se reservan las variantes de los teclados
  // español e inglés y las del teclado numérico.
  "Minus", "Slash", "NumpadSubtract", "Equal", "BracketRight", "NumpadAdd", "Digit0", "Numpad0",
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`Digit${n}`, `Numpad${n}`]),
]);

const ALIASES: Record<string, string> = {
  "shift": "ShiftLeft",
  "shift izq": "ShiftLeft",
  "shift izquierdo": "ShiftLeft",
  "shift der": "ShiftRight",
  "shift derecho": "ShiftRight",
  "ctrl izq": "ControlLeft",
  "ctrl der": "ControlRight",
  "alt izq": "AltLeft",
  "alt der": "AltRight",
  "izquierda": "ArrowLeft",
  "derecha": "ArrowRight",
  "arriba": "ArrowUp",
  "abajo": "ArrowDown",
};

/** Convierte "a", "L", "7" o "ShiftLeft" en un KeyboardEvent.code. */
export function normalizeKey(input: unknown, fallback: string): string {
  if (typeof input !== "string" || !input.trim()) return fallback;
  const s = input.trim();
  if (/^[a-zñ]$/i.test(s)) return s.toLowerCase() === "ñ" ? "Semicolon" : `Key${s.toUpperCase()}`;
  if (/^[0-9]$/.test(s)) return `Digit${s}`;
  const alias = ALIASES[s.toLowerCase().replace(/\.$/, "")];
  return alias ?? s;
}

const LABELS: Record<string, string> = {
  Space: "Espacio",
  Escape: "Esc",
  ShiftLeft: "Shift izq.",
  ShiftRight: "Shift der.",
  ControlLeft: "Ctrl izq.",
  ControlRight: "Ctrl der.",
  AltLeft: "Alt izq.",
  AltRight: "Alt der.",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Semicolon: "Ñ",
  Backspace: "Retroceso",
  Comma: ",",
  Period: ".",
  Slash: "-",
  Minus: "'",
  Backquote: "º",
  BracketLeft: "`",
  BracketRight: "+",
  Quote: "´",
  Backslash: "ç",
  IntlBackslash: "<",
  NumpadEnter: "Enter num.",
  NumpadAdd: "+ num.",
  NumpadSubtract: "− num.",
};

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad") && /\d$/.test(code)) return `${code.slice(6)} num.`;
  return LABELS[code] ?? code;
}
