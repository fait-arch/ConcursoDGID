import type { Question, Settings, Team, TeamId } from "./types";

export type Phase = "ready" | "open" | "answering" | "result" | "final";

export interface TeamStats {
  score: number;
  correct: number;
  /** Aciertos conseguidos en un rebote. */
  rebounds: number;
  /** Suma de tiempos de respuesta (ms) de las preguntas acertadas. */
  timeMs: number;
  buzzes: number;
}

/** Ganador de cada pregunta: null = desierta, undefined = sin jugar. */
export type RoundWinner = TeamId | null | undefined;

export type Outcome =
  | { kind: "correct"; team: TeamId; points: number; rebound: boolean; timeMs: number }
  | { kind: "void"; reason: "timeout" | "both" | "skipped" };

export type Fx =
  | { type: "none" }
  | { type: "launch" }
  | { type: "buzz"; team: TeamId }
  | { type: "blocked"; team: TeamId }
  | { type: "correct"; team: TeamId; points: number }
  | { type: "wrong"; team: TeamId; timeout: boolean }
  | { type: "void"; wrongTeam: TeamId | null; timeout: boolean }
  | { type: "final" };

export interface Buzz {
  team: TeamId;
  /** ms desde que se lanzó la pregunta hasta que se pulsó. */
  reaction: number;
  /** Puntos en juego, congelados en el momento de pulsar. */
  pot: number;
}

export interface Turn {
  team: TeamId;
  attempt: 1 | 2;
  startedAt: number;
  duration: number;
}

interface Core {
  phase: Phase;
  index: number;
  stats: [TeamStats, TeamStats];
  rounds: RoundWinner[];
  activatedAt: number;
  buzz: Buzz | null;
  turn: Turn | null;
  /** Opciones ya descartadas por una respuesta incorrecta. */
  eliminated: number[];
  /** Opción elegida en el veredicto final, para resaltarla. */
  picked: number | null;
  outcome: Outcome | null;
  pausedAt: number | null;
  fx: Fx;
  fxSeq: number;
}

export interface GameState extends Core {
  title: string;
  questions: Question[];
  teams: [Team, Team];
  settings: Settings;
  history: { core: Core; at: number }[];
}

export type Action =
  | { type: "LAUNCH"; now: number }
  | { type: "BUZZ"; team: TeamId; now: number }
  | { type: "PICK"; option: number; now: number }
  | { type: "JUDGE"; correct: boolean; now: number }
  | { type: "TIMEOUT"; now: number }
  | { type: "SKIP"; now: number }
  | { type: "NEXT"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "UNDO"; now: number };

/** Pausa breve antes de que empiece a correr el reloj del rebote, para que se vea la animación de fallo. */
export const REBOUND_DELAY = 1400;

const emptyStats = (): TeamStats => ({ score: 0, correct: 0, rebounds: 0, timeMs: 0, buzzes: 0 });

export function createGame(opts: {
  title: string;
  questions: Question[];
  teams: [Team, Team];
  settings: Settings;
  index?: number;
  stats?: [TeamStats, TeamStats];
  rounds?: RoundWinner[];
}): GameState {
  const index = opts.index ?? 0;
  const done = index >= opts.questions.length;
  return {
    title: opts.title,
    questions: opts.questions,
    teams: opts.teams,
    settings: opts.settings,
    history: [],
    phase: done ? "final" : "ready",
    index: Math.min(index, opts.questions.length - 1),
    stats: opts.stats ?? [emptyStats(), emptyStats()],
    rounds: opts.rounds ?? opts.questions.map(() => undefined),
    activatedAt: 0,
    buzz: null,
    turn: null,
    eliminated: [],
    picked: null,
    outcome: null,
    pausedAt: null,
    fx: { type: "none" },
    fxSeq: 0,
  };
}

/** Puntos en juego tras `elapsed` ms: bajan linealmente del 100 % al mínimo configurado. */
export function potAt(q: Question, s: Settings, elapsed: number): number {
  const f = Math.min(1, Math.max(0, elapsed / (q.buzzTime * 1000)));
  return Math.round(q.points * (1 - (1 - s.minFactor) * f));
}

export const currentQuestion = (s: GameState) => s.questions[s.index];

export function deadline(s: GameState): number | null {
  if (s.phase === "open") return s.activatedAt + currentQuestion(s).buzzTime * 1000;
  if (s.phase === "answering" && s.turn) return s.turn.startedAt + s.turn.duration;
  return null;
}

const other = (t: TeamId): TeamId => (t === 0 ? 1 : 0);

function withFx(s: GameState, fx: Fx): GameState {
  return { ...s, fx, fxSeq: s.fxSeq + 1 };
}

function snapshot(s: GameState, now: number): GameState["history"] {
  const { title: _t, questions: _q, teams: _tm, settings: _s, history, ...core } = s;
  return [...history, { core, at: now }].slice(-40);
}

function setStats(s: GameState, team: TeamId, patch: (t: TeamStats) => TeamStats): [TeamStats, TeamStats] {
  const next: [TeamStats, TeamStats] = [s.stats[0], s.stats[1]];
  next[team] = patch(s.stats[team]);
  return next;
}

function setRound(s: GameState, winner: TeamId | null): RoundWinner[] {
  const r = [...s.rounds];
  r[s.index] = winner;
  return r;
}

function resolveCorrect(s: GameState, now: number, picked: number | null): GameState {
  const turn = s.turn!;
  const buzz = s.buzz!;
  const rebound = turn.attempt === 2;
  const points = rebound ? Math.round(buzz.pot * s.settings.reboundFactor) : buzz.pot;
  const timeMs = rebound ? Math.max(0, now - turn.startedAt) : buzz.reaction;
  return withFx(
    {
      ...s,
      phase: "result",
      picked,
      outcome: { kind: "correct", team: turn.team, points, rebound, timeMs },
      stats: setStats(s, turn.team, (t) => ({
        ...t,
        score: t.score + points,
        correct: t.correct + 1,
        rebounds: t.rebounds + (rebound ? 1 : 0),
        timeMs: t.timeMs + timeMs,
      })),
      rounds: setRound(s, turn.team),
    },
    { type: "correct", team: turn.team, points },
  );
}

function resolveWrong(s: GameState, now: number, chosen: number | null, timeout: boolean): GameState {
  const turn = s.turn!;
  const eliminated = chosen !== null && !s.eliminated.includes(chosen) ? [...s.eliminated, chosen] : s.eliminated;
  if (turn.attempt === 1) {
    return withFx(
      {
        ...s,
        eliminated,
        turn: {
          team: other(turn.team),
          attempt: 2,
          startedAt: now + REBOUND_DELAY,
          duration: currentQuestion(s).answerTime * 1000,
        },
      },
      { type: "wrong", team: turn.team, timeout },
    );
  }
  return withFx(
    {
      ...s,
      eliminated,
      phase: "result",
      picked: null,
      outcome: { kind: "void", reason: "both" },
      rounds: setRound(s, null),
    },
    { type: "void", wrongTeam: turn.team, timeout },
  );
}

const UNDOABLE = new Set<Action["type"]>(["LAUNCH", "BUZZ", "PICK", "JUDGE", "SKIP", "NEXT"]);

export function reducer(state: GameState, action: Action): GameState {
  const next = step(state, action);
  if (next !== state && UNDOABLE.has(action.type) && next.fx.type !== "blocked") {
    return { ...next, history: snapshot(state, action.now) };
  }
  return next;
}

function step(s: GameState, a: Action): GameState {
  const q = currentQuestion(s);
  const paused = s.pausedAt !== null;

  switch (a.type) {
    case "LAUNCH": {
      if (s.phase !== "ready") return s;
      return withFx(
        { ...s, phase: "open", activatedAt: a.now, buzz: null, turn: null, eliminated: [], picked: null, outcome: null },
        { type: "launch" },
      );
    }

    case "BUZZ": {
      if (paused) return s;
      if (s.phase === "open") {
        if (a.now < s.activatedAt) return s;
        const reaction = a.now - s.activatedAt;
        return withFx(
          {
            ...s,
            phase: "answering",
            buzz: { team: a.team, reaction, pot: potAt(q, s.settings, reaction) },
            turn: { team: a.team, attempt: 1, startedAt: a.now, duration: q.answerTime * 1000 },
            stats: setStats(s, a.team, (t) => ({ ...t, buzzes: t.buzzes + 1 })),
          },
          { type: "buzz", team: a.team },
        );
      }
      if (s.phase === "ready" || (s.phase === "answering" && s.turn?.team !== a.team)) {
        return withFx(s, { type: "blocked", team: a.team });
      }
      return s;
    }

    case "PICK": {
      if (paused || s.phase !== "answering" || !q.options.length) return s;
      if (a.option < 0 || a.option >= q.options.length || s.eliminated.includes(a.option)) return s;
      return a.option === q.correct ? resolveCorrect(s, a.now, a.option) : resolveWrong(s, a.now, a.option, false);
    }

    case "JUDGE": {
      if (paused || s.phase !== "answering") return s;
      return a.correct ? resolveCorrect(s, a.now, q.options.length ? q.correct : null) : resolveWrong(s, a.now, null, false);
    }

    case "TIMEOUT": {
      if (paused) return s;
      const d = deadline(s);
      if (d === null || a.now + 15 < d) return s;
      if (s.phase === "open") {
        return withFx(
          { ...s, phase: "result", outcome: { kind: "void", reason: "timeout" }, rounds: setRound(s, null) },
          { type: "void", wrongTeam: null, timeout: true },
        );
      }
      return resolveWrong(s, a.now, null, true);
    }

    case "SKIP": {
      if (s.phase === "result" || s.phase === "final") return s;
      return withFx(
        { ...s, phase: "result", pausedAt: null, outcome: { kind: "void", reason: "skipped" }, rounds: setRound(s, null) },
        { type: "void", wrongTeam: null, timeout: false },
      );
    }

    case "NEXT": {
      if (s.phase !== "result") return s;
      if (s.index + 1 >= s.questions.length) return withFx({ ...s, phase: "final" }, { type: "final" });
      return withFx(
        {
          ...s,
          phase: "ready",
          index: s.index + 1,
          buzz: null,
          turn: null,
          eliminated: [],
          picked: null,
          outcome: null,
        },
        { type: "none" },
      );
    }

    case "PAUSE": {
      if (s.phase !== "open" && s.phase !== "answering") return s;
      if (s.pausedAt === null) return { ...s, pausedAt: a.now };
      const d = a.now - s.pausedAt;
      return {
        ...s,
        pausedAt: null,
        activatedAt: s.activatedAt + d,
        turn: s.turn ? { ...s.turn, startedAt: s.turn.startedAt + d } : null,
      };
    }

    case "UNDO": {
      const last = s.history[s.history.length - 1];
      if (!last) return s;
      // Desplaza los relojes para que el tiempo restante sea el mismo que antes del error.
      const core = last.core;
      const d = a.now - (core.pausedAt ?? last.at);
      return {
        ...s,
        ...core,
        history: s.history.slice(0, -1),
        activatedAt: core.activatedAt + d,
        turn: core.turn ? { ...core.turn, startedAt: core.turn.startedAt + d } : null,
        pausedAt: null,
        fx: { type: "none" },
        fxSeq: s.fxSeq + 1,
      };
    }
  }
}

export interface Ranking {
  winner: TeamId | null;
  /** true si el empate a puntos se decidió por tiempo medio de respuesta. */
  byTime: boolean;
}

export const avgTime = (t: TeamStats) => (t.correct ? t.timeMs / t.correct : Infinity);

export function rank(stats: [TeamStats, TeamStats]): Ranking {
  const [a, b] = stats;
  if (a.score !== b.score) return { winner: a.score > b.score ? 0 : 1, byTime: false };
  const ta = avgTime(a);
  const tb = avgTime(b);
  if (ta === tb || (!Number.isFinite(ta) && !Number.isFinite(tb))) return { winner: null, byTime: false };
  return { winner: ta < tb ? 0 : 1, byTime: true };
}
