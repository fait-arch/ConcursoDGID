import type { GameState, RoundWinner, TeamStats } from "./game";
import type { Question, Settings, Team } from "./types";

const GAME_KEY = "concurso:partida";
const PREFS_KEY = "concurso:preferencias";

export interface SavedGame {
  savedAt: number;
  title: string;
  questions: Question[];
  teams: [Team, Team];
  settings: Settings;
  stats: [TeamStats, TeamStats];
  rounds: RoundWinner[];
  /** Pregunta por la que se retoma la partida. */
  index: number;
}

export interface Prefs {
  theme?: "dark" | "light";
  teams?: Team[];
  muted?: boolean;
  /** Tamaño general de la interfaz (1 = 100 %). */
  zoom?: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible: se sigue jugando sin guardar */
  }
}

export function saveGame(s: GameState) {
  if (s.phase === "final") return write(GAME_KEY, null);
  if (s.phase !== "ready" && s.phase !== "result") return;
  const saved: SavedGame = {
    savedAt: Date.now(),
    title: s.title,
    questions: s.questions,
    teams: s.teams,
    settings: s.settings,
    stats: s.stats,
    rounds: s.rounds,
    index: s.phase === "ready" ? s.index : s.index + 1,
  };
  write(GAME_KEY, saved);
}

export function loadSavedGame(): SavedGame | null {
  const g = read<SavedGame>(GAME_KEY);
  if (!g || !Array.isArray(g.questions) || g.index > g.questions.length) return null;
  // JSON convierte undefined en null: se recupera "sin jugar" para las preguntas pendientes.
  g.rounds = g.questions.map((_, i) => (i < g.index ? g.rounds?.[i] ?? null : undefined));
  return g;
}

export function clearSavedGame() {
  write(GAME_KEY, null);
}

export function loadPrefs(): Prefs {
  return read<Prefs>(PREFS_KEY) ?? {};
}

export function savePrefs(patch: Prefs) {
  write(PREFS_KEY, { ...loadPrefs(), ...patch });
}
