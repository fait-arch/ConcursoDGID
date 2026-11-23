import { normalizeKey } from "./keys";
import type { Question, QuestionFile, RawQuestion, Settings, Team } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  buzzTime: 20,
  answerTime: 10,
  points: 100,
  minFactor: 0.5,
  reboundFactor: 1,
  shuffle: false,
  perRound: 5,
};

export const DEFAULT_TEAMS: Team[] = [
  { name: "Equipo Coral", color: "#FF5A4A", key: "KeyA" },
  { name: "Equipo Azul", color: "#3F8CFF", key: "KeyL" },
];

export const TEAM_COLORS = [
  "#FF5A4A", "#FF9F1C", "#F2C230", "#2FC28E", "#22B8CF", "#3F8CFF", "#8B6CFF", "#F15BB5",
];

const LETTERS = "ABCDEF";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function pick(o: Obj, ...names: string[]): unknown {
  for (const n of names) if (o[n] !== undefined) return o[n];
  return undefined;
}

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

function fraction(v: unknown): number | undefined {
  const n = num(v, 0, 100);
  if (n === undefined) return undefined;
  return n > 1 ? n / 100 : n; // admite 0.5 o 50 (%)
}

function str(v: unknown): string | undefined {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

function resolveCorrect(value: unknown, options: string[], where: string, errors: string[]): number {
  if (value === undefined || value === null || value === "") {
    errors.push(`${where}: tiene opciones pero falta "correcta".`);
    return -1;
  }
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1 && value <= options.length) return value - 1;
    errors.push(`${where}: "correcta" debe ser una letra (A–${LETTERS[options.length - 1]}), el número de la opción (1–${options.length}) o su texto exacto.`);
    return -1;
  }
  const s = String(value).trim();
  if (/^[a-f]$/i.test(s)) {
    const i = LETTERS.indexOf(s.toUpperCase());
    if (i < options.length) return i;
  }
  if (/^\d+$/.test(s)) {
    const i = Number(s);
    if (i >= 1 && i <= options.length) return i - 1;
  }
  const byText = options.findIndex((o) => o.toLowerCase() === s.toLowerCase());
  if (byText >= 0) return byText;
  errors.push(`${where}: "correcta" vale "${s}", que no coincide con ninguna opción.`);
  return -1;
}

function parseQuestion(raw: unknown, i: number, errors: string[]): RawQuestion | null {
  const where = `Pregunta ${i + 1}`;
  if (typeof raw === "string") raw = { pregunta: raw };
  if (!isObj(raw)) {
    errors.push(`${where}: debe ser un objeto con al menos "pregunta".`);
    return null;
  }
  const text = str(pick(raw, "pregunta", "texto", "enunciado", "question"));
  if (!text) {
    errors.push(`${where}: falta el texto en "pregunta".`);
    return null;
  }
  const rawOptions = pick(raw, "opciones", "options", "alternativas");
  let options: string[] = [];
  if (rawOptions !== undefined) {
    if (!Array.isArray(rawOptions)) {
      errors.push(`${where}: "opciones" debe ser una lista.`);
      return null;
    }
    options = rawOptions.map((o) => str(o) ?? "").filter(Boolean);
    if (options.length === 1 || options.length > 6) {
      errors.push(`${where}: debe tener entre 2 y 6 opciones (tiene ${options.length}).`);
      return null;
    }
  }

  let correct = -1;
  let answer = str(pick(raw, "respuesta", "answer", "solucion", "solución")) ?? "";
  if (options.length) {
    correct = resolveCorrect(pick(raw, "correcta", "correct", "respuestaCorrecta"), options, where, errors);
    if (correct < 0) return null;
    answer = options[correct];
  } else if (!answer) {
    errors.push(`${where}: sin opciones necesita "respuesta" para mostrarla al final.`);
    return null;
  }

  return {
    text,
    options,
    correct,
    answer,
    category: str(pick(raw, "categoria", "categoría", "tema", "category")),
    points: num(pick(raw, "puntos", "points"), 1, 100000),
    buzzTime: num(pick(raw, "tiempoPulsar", "tiempo", "time"), 3, 600),
    answerTime: num(pick(raw, "tiempoResponder"), 3, 600),
  };
}

/** Lee y valida el contenido de preguntas.json. Lanza un Error con mensajes claros si algo falla. */
export function parseQuestionFile(text: string, source: string): QuestionFile {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`${source} no es un JSON válido: ${(e as Error).message}`);
  }

  const root: Obj = Array.isArray(data) ? { preguntas: data } : isObj(data) ? data : {};
  const list = pick(root, "preguntas", "questions");
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${source} debe tener una lista "preguntas" con al menos una pregunta.`);
  }

  const cfg = isObj(pick(root, "configuracion", "configuración", "config"))
    ? (pick(root, "configuracion", "configuración", "config") as Obj)
    : {};
  const settings: Settings = {
    buzzTime: num(pick(cfg, "tiempoPulsar", "tiempo"), 3, 600) ?? DEFAULT_SETTINGS.buzzTime,
    answerTime: num(pick(cfg, "tiempoResponder"), 3, 600) ?? DEFAULT_SETTINGS.answerTime,
    points: num(pick(cfg, "puntos"), 1, 100000) ?? DEFAULT_SETTINGS.points,
    minFactor: fraction(pick(cfg, "puntosMinimos", "puntosMínimos")) ?? DEFAULT_SETTINGS.minFactor,
    reboundFactor: fraction(pick(cfg, "factorRebote")) ?? DEFAULT_SETTINGS.reboundFactor,
    shuffle: pick(cfg, "mezclar") === true,
    perRound: Math.round(
      num(pick(cfg, "preguntasPorRonda", "preguntasRonda", "porRonda"), 0, 100000) ?? DEFAULT_SETTINGS.perRound,
    ),
  };

  const rawTeams = pick(root, "equipos", "teams");
  const teams: Team[] = DEFAULT_TEAMS.map((def, i) => {
    const t = Array.isArray(rawTeams) && isObj(rawTeams[i]) ? (rawTeams[i] as Obj) : {};
    const color = pick(t, "color");
    return {
      name: str(pick(t, "nombre", "name")) ?? def.name,
      color: isHex(color) ? color.trim() : def.color,
      key: normalizeKey(pick(t, "tecla", "key"), def.key),
    };
  });

  const errors: string[] = [];
  const questions = list
    .map((q, i) => parseQuestion(q, i, errors))
    .filter((q): q is RawQuestion => q !== null);
  if (errors.length) {
    const shown = errors.slice(0, 6);
    const more = errors.length - shown.length;
    throw new Error(
      `Revisa ${source}:\n${shown.join("\n")}${more > 0 ? `\n…y ${more} problema${more > 1 ? "s" : ""} más.` : ""}`,
    );
  }

  return {
    title: str(pick(root, "titulo", "título", "title")) ?? "Concurso",
    settings,
    teams,
    questions,
    source,
  };
}

/** Resuelve tiempos y puntos de cada pregunta y, si se pide, las mezcla. */
export function prepareQuestions(raw: RawQuestion[], s: Settings): Question[] {
  const qs: Question[] = raw.map((q) => ({
    text: q.text,
    options: q.options,
    correct: q.correct,
    answer: q.answer,
    category: q.category,
    points: q.points ?? s.points,
    buzzTime: q.buzzTime ?? s.buzzTime,
    answerTime: q.answerTime ?? s.answerTime,
  }));
  if (s.shuffle) {
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
  }
  return qs;
}

/** Identifica una pregunta entre rondas, para no repetirla. */
export const questionKey = (q: { text: string }) => q.text.trim().toLowerCase();

/** Preguntas del archivo que todavía no han salido en ninguna ronda. */
export function unplayedCount(raw: RawQuestion[], used: string[]): number {
  const seen = new Set(used);
  return raw.filter((q) => !seen.has(questionKey(q))).length;
}

/** Cuántas preguntas se juegan en una ronda con esta configuración. */
export function roundSize(total: number, s: Settings): number {
  return s.perRound > 0 ? Math.min(s.perRound, total) : total;
}

function shuffledCopy<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Round {
  questions: Question[];
  /** Claves de todas las preguntas ya jugadas, incluidas las de esta ronda. */
  used: string[];
  /** true si se agotaron las preguntas sin jugar y el ciclo vuelve a empezar. */
  cycled: boolean;
}

/**
 * Elige al azar las preguntas de una ronda evitando las de las rondas anteriores:
 * con 5 por ronda, la segunda ronda trae otras 5. Cuando ya no quedan suficientes
 * sin jugar se completa la ronda con las que menos falta hacen y el ciclo empieza
 * de nuevo, así que nunca se repite una pregunta antes de haber pasado por todas.
 */
export function selectRound(raw: RawQuestion[], s: Settings, used: string[] = []): Round {
  const n = roundSize(raw.length, s);
  const seen = new Set(used);
  const all = raw.map((_, i) => i);
  const fresh = shuffledCopy(all.filter((i) => !seen.has(questionKey(raw[i]))));
  const played = shuffledCopy(all.filter((i) => seen.has(questionKey(raw[i]))));
  const cycled = fresh.length < n;
  const chosen = [...fresh, ...played].slice(0, n);
  // Sin "mezclar", la ronda sigue el orden del archivo: la elección ya fue al azar.
  if (!s.shuffle) chosen.sort((a, b) => a - b);
  const keys = chosen.map((i) => questionKey(raw[i]));
  return {
    questions: prepareQuestions(
      chosen.map((i) => raw[i]),
      { ...s, shuffle: false },
    ),
    used: cycled ? keys : [...used, ...keys],
    cycled,
  };
}

export const optionLetter = (i: number) => LETTERS[i] ?? String(i + 1);
