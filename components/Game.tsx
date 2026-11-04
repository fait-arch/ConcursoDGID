"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import Clock from "./Clock";
import Icon from "./Icon";
import Podium from "./Podium";
import { currentQuestion, deadline, potAt, reducer, type Action, type GameState } from "@/lib/game";
import { confettiWin, desertRoll, emojiBurst, pointsFly } from "@/lib/effects";
import { points, seconds } from "@/lib/format";
import { toggleFullscreen, useCountUp, useFitScale, useFrameNow, useIdle, ZOOM } from "@/lib/hooks";
import { keyLabel } from "@/lib/keys";
import { optionLetter } from "@/lib/questions";
import { isMuted, setMuted, sfx } from "@/lib/sound";
import { saveGame, savePrefs } from "@/lib/storage";
import { teamPalette, teamVars, type Theme } from "@/lib/theme";
import type { TeamId } from "@/lib/types";

interface Props {
  initial: GameState;
  theme: Theme;
  zoom: number;
  onZoom: (delta: number | null) => void;
  onExit: () => void;
  onReplay: (s: GameState) => void;
  onToggleTheme: () => void;
}

/**
 * Tamaño de partida del enunciado según su longitud. A partir de aquí, useFitScale
 * lo encoge más si hace falta para que quepa junto con las opciones.
 */
function questionSize(text: string): string {
  if (text.length > 260) return "headline-small";
  if (text.length > 190) return "headline-medium";
  if (text.length > 110) return "headline-large";
  return "display-small";
}

type ActionType = Action["type"];
const side = (t: TeamId) => (t === 0 ? "a" : "b");

export default function Game({ initial, theme, zoom, onZoom, onExit, onReplay, onToggleTheme }: Props) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const fxLayer = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const scoreRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const [pinned, setPinned] = useState(false);
  const [muted, setMutedUi] = useState(isMuted());
  const [blocked, setBlocked] = useState<{ team: TeamId; seq: number } | null>(null);
  const idle = useIdle();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const act = useCallback((type: ActionType, extra: Record<string, unknown> = {}) => {
    dispatch({ type, now: performance.now(), ...extra } as Action);
  }, []);

  const toggleMute = useCallback(() => {
    const m = !isMuted();
    setMuted(m);
    setMutedUi(m);
    savePrefs({ muted: m });
  }, []);

  // Guarda la partida al empezar y terminar cada pregunta, por si se recarga la página.
  useEffect(() => {
    saveGame(stateRef.current);
  }, [state.phase, state.index]);

  // Fin de tiempo: un único temporizador apuntado al instante exacto en que vence el reloj.
  useEffect(() => {
    if (state.pausedAt !== null) return;
    const d = deadline(state);
    if (d === null) return;
    const id = setTimeout(() => act("TIMEOUT"), Math.max(0, d - performance.now()) + 20);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.activatedAt, state.turn, state.pausedAt, act]);

  // Efectos visuales y sonoros de cada acontecimiento.
  useEffect(() => {
    const s = stateRef.current;
    const fx = s.fx;
    const layer = fxLayer.current;
    if (!layer) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const shake = () =>
      mainRef.current?.animate(
        [0, -14, 12, -10, 8, -5, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 520, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );

    switch (fx.type) {
      case "launch":
        sfx.launch();
        break;
      case "buzz":
        sfx.buzz(fx.team);
        break;
      case "blocked":
        sfx.blocked();
        setBlocked({ team: fx.team, seq: s.fxSeq });
        break;
      case "correct": {
        sfx.correct();
        const pal = teamPalette(s.teams[fx.team].color, themeRef.current);
        confettiWin(fx.team, [pal.container, pal.primary, s.teams[fx.team].color]);
        const from = clockRef.current?.getBoundingClientRect();
        if (from) {
          pointsFly(layer, {
            text: `+${points(fx.points)}`,
            background: pal.container,
            color: pal.onContainer,
            from,
            to: scoreRefs[fx.team].current?.getBoundingClientRect() ?? null,
          });
        }
        break;
      }
      case "wrong":
        sfx.wrong();
        shake();
        emojiBurst(layer, { x: W / 2, y: H * 0.5, timeout: fx.timeout });
        break;
      case "void": {
        const skipped = s.outcome?.kind === "void" && s.outcome.reason === "skipped";
        if (skipped) break;
        if (fx.wrongTeam !== null) {
          sfx.wrong();
          shake();
          emojiBurst(layer, { x: W / 2, y: H * 0.5, timeout: fx.timeout, count: 22 });
          setTimeout(() => {
            sfx.void();
            desertRoll(layer);
          }, 900);
        } else {
          sfx.void();
          desertRoll(layer);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fxSeq]);

  // Teclado: pulsadores de los equipos y teclas del moderador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Deja pasar los atajos del navegador (Ctrl+R, Cmd+Q…); Ctrl o Alt solos sí pueden ser pulsadores.
      if ((e.ctrlKey || e.metaKey || e.altKey) && !/^(Control|Alt|Meta)/.test(e.code)) return;
      const s = stateRef.current;
      // event.timeStamp comparte reloj con performance.now(): mide el instante real de la pulsación.
      const now = e.timeStamp > 0 ? e.timeStamp : performance.now();
      const team = s.teams.findIndex((t) => t.key === e.code);
      if (team === 0 || team === 1) {
        e.preventDefault();
        dispatch({ type: "BUZZ", team, now });
        return;
      }
      const digit = /^(Digit|Numpad)([1-6])$/.exec(e.code);
      if (digit) {
        dispatch({ type: "PICK", option: Number(digit[2]) - 1, now });
        return;
      }
      switch (e.code) {
        case "Space":
        case "Enter":
          e.preventDefault();
          if (s.phase === "ready") dispatch({ type: "LAUNCH", now });
          else if (s.phase === "result") dispatch({ type: "NEXT", now });
          break;
        case "KeyC":
          dispatch({ type: "JUDGE", correct: true, now });
          break;
        case "KeyX":
          dispatch({ type: "JUDGE", correct: false, now });
          break;
        case "KeyZ":
          dispatch({ type: "UNDO", now: performance.now() });
          break;
        case "KeyP":
          dispatch({ type: "PAUSE", now: performance.now() });
          break;
        case "KeyS":
          dispatch({ type: "SKIP", now });
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "KeyH":
          setPinned((p) => !p);
          break;
        case "KeyT":
          onToggleTheme();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggleTheme, toggleMute]);

  const { teams, phase, turn, outcome } = state;
  const vars = useMemo(() => teamVars(teams, theme), [teams, theme]);
  const q = currentQuestion(state);

  // Enunciado u opciones largos: una columna a todo el ancho y texto algo más corrido.
  const longestOption = q.options.reduce((n, o) => Math.max(n, o.length), 0);
  const long = q.text.length > 150 || longestOption > 80;
  useFitScale(mainRef, fitRef, [state.index, phase, zoom, long]);

  if (phase === "final") {
    return (
      <div style={vars}>
        <Podium state={state} theme={theme} onReplay={() => onReplay(state)} onExit={onExit} />
      </div>
    );
  }

  const winner = outcome?.kind === "correct" ? outcome.team : null;
  const revealTeam: TeamId | null =
    phase === "answering" && turn ? turn.team : phase === "result" && winner !== null ? winner : null;
  const activeTeam = phase === "answering" && turn ? turn.team : null;

  return (
    <div
      className={`stage phase-${phase}${idle && !pinned ? " is-idle" : ""}${state.pausedAt !== null ? " is-paused" : ""}`}
      style={vars}
    >
      {([0, 1] as const).map((t) => (
        <div
          key={t}
          aria-hidden
          className={`reveal reveal-${side(t)}${revealTeam === t ? " on" : ""}${winner === t ? " won" : ""}`}
        />
      ))}

      <header className="topbar">
        <TeamCard
          team={0}
          name={teams[0].name}
          score={state.stats[0].score}
          active={activeTeam === 0 || winner === 0}
          locked={activeTeam !== null && activeTeam !== 0}
          scoreRef={scoreRefs[0]}
        />
        <div className="hud">
          {phase !== "ready" && (
            <>
              <div ref={clockRef}>
                <ClockFor state={state} />
              </div>
              <Status state={state} />
            </>
          )}
        </div>
        <TeamCard
          team={1}
          name={teams[1].name}
          score={state.stats[1].score}
          active={activeTeam === 1 || winner === 1}
          locked={activeTeam !== null && activeTeam !== 1}
          scoreRef={scoreRefs[1]}
        />
      </header>

      <main className="main" ref={mainRef}>
        <div className={`fit${long ? " long" : ""}`} ref={fitRef}>
          {phase === "ready" ? (
            <ReadyCard state={state} />
          ) : (
            <>
              <h1 key={state.index} className={`question ${questionSize(q.text)} emphasized`}>
                {q.text}
              </h1>
              {q.options.length > 0 ? (
                <Options state={state} long={long} onPick={(i) => act("PICK", { option: i })} />
              ) : (
                phase === "result" && (
                  <div
                    className={`answer-card${winner !== null ? " won" : ""}`}
                    style={winner !== null ? winVars(winner) : undefined}
                  >
                    <p className="label-large on-surface-variant">Respuesta</p>
                    <p className="headline-medium emphasized">{q.answer}</p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        {([0, 1] as const).map((t) => (
          <button
            key={`${t}-${blocked?.team === t ? blocked.seq : 0}`}
            type="button"
            tabIndex={-1}
            className={`buzzer buzzer-${side(t)}${phase === "open" ? " armed" : ""}${activeTeam === t ? " hit" : ""}${blocked?.team === t ? " blocked" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              dispatch({ type: "BUZZ", team: t, now: e.timeStamp || performance.now() });
            }}
          >
            <span className="keycap">{keyLabel(teams[t].key)}</span>
            <span className="label-large">Pulsador</span>
          </button>
        ))}
        <Progress state={state} />
      </footer>

      <Toolbar
        phase={phase}
        hasOptions={q.options.length > 0}
        canUndo={state.history.length > 0}
        paused={state.pausedAt !== null}
        muted={muted}
        theme={theme}
        pinned={pinned}
        zoom={zoom}
        act={act}
        onMute={toggleMute}
        onTheme={onToggleTheme}
        onZoom={onZoom}
        onPin={() => setPinned((p) => !p)}
        onExit={onExit}
      />

      {state.pausedAt !== null && (
        <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="dialog">
            <Icon name="pause_circle" className="dialog-icon" />
            <h2 id="pause-title" className="headline-small" style={{ textAlign: "center" }}>
              En pausa
            </h2>
            <p className="body-medium on-surface-variant">
              El reloj está detenido. Pulsa <kbd>P</kbd> o continúa desde aquí.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-text state" onClick={() => act("PAUSE")}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fx-layer" ref={fxLayer} aria-hidden />
    </div>
  );
}

const winVars = (t: TeamId) =>
  ({ "--win": `var(--${side(t)}-container)`, "--win-on": `var(--${side(t)}-on-container)` }) as CSSProperties;

function TeamCard(props: {
  team: TeamId;
  name: string;
  score: number;
  active: boolean;
  locked: boolean;
  scoreRef: RefObject<HTMLDivElement | null>;
}) {
  const shown = useCountUp(props.score);
  const counting = shown !== props.score;
  return (
    <section
      className={`team team-${side(props.team)}${props.active ? " active" : ""}${props.locked ? " locked" : ""}`}
      aria-label={`${props.name}: ${props.score} puntos`}
    >
      <div className="team-head">
        <span className="team-dot" aria-hidden />
        <span className="team-name title-large emphasized">{props.name}</span>
        {props.locked && <Icon name="lock" filled />}
      </div>
      <div ref={props.scoreRef} className={`team-score display-large emphasized${counting ? " counting" : ""}`}>
        {points(shown)}
      </div>
    </section>
  );
}

function ReadyCard({ state }: { state: GameState }) {
  const q = currentQuestion(state);
  return (
    <div className="ready" key={state.index}>
      <p className="title-large on-surface-variant">Pregunta</p>
      <p className="ready-number">
        <span className="display-large tnum">{state.index + 1}</span>
        <span className="headline-small on-surface-variant">de {state.questions.length}</span>
      </p>
      <div className="ready-chips">
        {q.category && (
          <span className="chip">
            <Icon name="sell" />
            {q.category}
          </span>
        )}
        <span className="chip">
          <Icon name="stars" />
          Hasta {points(q.points)} puntos
        </span>
        <span className="chip">
          <Icon name="timer" />
          {q.buzzTime} s para pulsar
        </span>
      </div>
      <p className="ready-hint body-large on-surface-variant">
        Pulsa <kbd>Espacio</kbd> para lanzarla
      </p>
    </div>
  );
}

function Status({ state }: { state: GameState }) {
  const { phase, turn, buzz, outcome, teams } = state;
  let icon = "radio_button_checked";
  let line: ReactNode = null;
  let sub: ReactNode = null;
  let tone: "neutral" | TeamId = "neutral";

  if (phase === "open") {
    icon = "touch_app";
    line = "Pulsador libre";
    sub = "El primer equipo en pulsar responde";
  }
  if (phase === "answering" && turn) {
    tone = turn.team;
    if (turn.attempt === 1) {
      icon = "notifications_active";
      line = `${teams[turn.team].name} responde`;
      sub = buzz ? `Pulsó en ${seconds(buzz.reaction)}` : null;
    } else {
      icon = "replay";
      line = `Rebote para ${teams[turn.team].name}`;
      sub = `${teams[turn.team === 0 ? 1 : 0].name} falló`;
    }
  }
  if (phase === "result" && outcome) {
    if (outcome.kind === "correct") {
      tone = outcome.team;
      icon = "check_circle";
      line = `¡Correcto, ${teams[outcome.team].name}!`;
      sub = outcome.rebound ? "Acierto en el rebote" : `Respondió en ${seconds(outcome.timeMs)}`;
    } else if (outcome.reason === "skipped") {
      icon = "block";
      line = "Pregunta anulada";
    } else {
      icon = "hourglass_disabled";
      line = "Pregunta desierta";
      sub = outcome.reason === "timeout" ? "Nadie pulsó a tiempo" : "Ningún equipo acertó";
    }
  }

  return (
    <div
      key={`${phase}-${turn?.attempt ?? 0}`}
      className={`status${tone === "neutral" ? "" : ` tone-${side(tone)}`}`}
      aria-live="polite"
    >
      <p className="status-line title-large emphasized">
        <Icon name={icon} filled />
        {line}
      </p>
      {sub && <p className="body-medium on-surface-variant">{sub}</p>}
    </div>
  );
}

function ClockFor({ state }: { state: GameState }) {
  const q = currentQuestion(state);
  const { phase, turn, outcome, buzz, settings } = state;
  const live = phase === "open";
  const now = useFrameNow(live, state.pausedAt);
  if (phase === "result") {
    const won = outcome?.kind === "correct";
    return (
      <Clock
        start={0}
        duration={1}
        pausedAt={null}
        running={false}
        color={won ? `var(--${side(outcome.team)}-primary)` : "var(--md-sys-color-outline)"}
        staticText={won ? `+${points(outcome.points)}` : "0"}
        delayStatic={won}
        label="puntos"
      />
    );
  }
  if (phase === "answering" && turn && buzz) {
    const pot = turn.attempt === 2 ? Math.round(buzz.pot * settings.reboundFactor) : buzz.pot;
    return (
      <Clock
        key={`${state.index}-${turn.attempt}`}
        start={turn.startedAt}
        duration={turn.duration}
        pausedAt={state.pausedAt}
        running
        color={`var(--${side(turn.team)}-primary)`}
        label={`${points(pot)} pts`}
      />
    );
  }
  return (
    <Clock
      key={`${state.index}-open`}
      start={state.activatedAt}
      duration={q.buzzTime * 1000}
      pausedAt={state.pausedAt}
      running={live}
      color="var(--md-sys-color-primary)"
      label={`${points(potAt(q, settings, live ? now - state.activatedAt : 0))} pts`}
    />
  );
}

function Options({ state, long, onPick }: { state: GameState; long: boolean; onPick: (i: number) => void }) {
  const q = currentQuestion(state);
  const { phase, outcome, eliminated } = state;
  const reveal = phase === "result";
  const winner = outcome?.kind === "correct" ? outcome.team : null;
  // Las opciones comparten tamaño aunque solo una sea larga: leerlas comparadas
  // es más fácil si todas se ven igual.
  const textSize = long ? "body-large" : "title-large";
  return (
    <ol className={`options${q.options.length > 4 ? " six" : ""}${long ? " long" : ""}`}>
      {q.options.map((opt, i) => {
        const out = eliminated.includes(i);
        const right = reveal && i === q.correct;
        const cls = right ? (winner !== null ? "right won" : "right") : out ? "out" : reveal ? "dim" : "";
        return (
          <li key={`${state.index}-${i}`}>
            <button
              type="button"
              tabIndex={-1}
              className={`option state ${cls}`}
              style={right && winner !== null ? winVars(winner) : undefined}
              disabled={phase !== "answering" || out}
              onPointerDown={(e) => {
                e.preventDefault();
                onPick(i);
              }}
            >
              <span className="option-letter title-medium emphasized">{optionLetter(i)}</span>
              <span className={`option-text ${textSize}`}>{opt}</span>
              {right && <Icon name="check_circle" filled className="option-end" />}
              {out && <Icon name="cancel" className="option-end" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Progress({ state }: { state: GameState }) {
  return (
    <div className="progress">
      <div className="segments" aria-hidden style={{ "--n": state.questions.length } as CSSProperties}>
        {state.questions.map((_, i) => {
          const r = state.rounds[i];
          const cls = r === 0 ? "a" : r === 1 ? "b" : r === null ? "void" : i === state.index ? "now" : "";
          return <span key={i} className={`seg ${cls}`} />;
        })}
      </div>
      <p className="label-large on-surface-variant tnum">
        Pregunta {state.index + 1} de {state.questions.length}
      </p>
    </div>
  );
}

function Toolbar(props: {
  phase: GameState["phase"];
  hasOptions: boolean;
  canUndo: boolean;
  paused: boolean;
  muted: boolean;
  theme: Theme;
  pinned: boolean;
  zoom: number;
  act: (t: ActionType, extra?: Record<string, unknown>) => void;
  onMute: () => void;
  onTheme: () => void;
  onZoom: (delta: number | null) => void;
  onPin: () => void;
  onExit: () => void;
}) {
  const { phase, act } = props;
  const btn = (icon: string, tip: string, onClick: () => void, opts: { disabled?: boolean; filled?: boolean; selected?: boolean } = {}) => (
    <button
      key={tip}
      type="button"
      tabIndex={-1}
      className={`icon-btn state${opts.filled ? " filled" : ""}${opts.selected ? " selected" : ""}`}
      data-tip={tip}
      aria-label={tip}
      disabled={opts.disabled}
      onClick={onClick}
    >
      <Icon name={icon} filled={opts.filled || opts.selected} />
    </button>
  );
  return (
    <nav className="toolbar" aria-label="Controles del moderador">
      {phase === "ready" && btn("play_arrow", "Lanzar (Espacio)", () => act("LAUNCH"), { filled: true })}
      {phase === "result" && btn("skip_next", "Siguiente (Espacio)", () => act("NEXT"), { filled: true })}
      {phase === "answering" && btn("check", props.hasOptions ? "Correcta (C o 1–6)" : "Correcta (C)", () => act("JUDGE", { correct: true }))}
      {phase === "answering" && btn("close", "Incorrecta (X)", () => act("JUDGE", { correct: false }))}
      {(phase === "open" || phase === "answering") &&
        btn(props.paused ? "play_arrow" : "pause", props.paused ? "Continuar (P)" : "Pausa (P)", () => act("PAUSE"))}
      {phase !== "result" && btn("block", "Anular pregunta (S)", () => act("SKIP"))}
      {btn("undo", "Deshacer (Z)", () => act("UNDO"), { disabled: !props.canUndo })}
      <span className="toolbar-divider" />
      {btn(props.muted ? "volume_off" : "volume_up", props.muted ? "Activar sonido (M)" : "Silenciar (M)", props.onMute)}
      {btn("zoom_out", "Reducir tamaño (−)", () => props.onZoom(-ZOOM.step), { disabled: props.zoom <= ZOOM.min })}
      {btn("fit_screen", `Tamaño normal (0) · ${Math.round(props.zoom * 100)} %`, () => props.onZoom(null), {
        disabled: props.zoom === 1,
      })}
      {btn("zoom_in", "Aumentar tamaño (+)", () => props.onZoom(ZOOM.step), { disabled: props.zoom >= ZOOM.max })}
      {btn("fullscreen", "Pantalla completa (F)", toggleFullscreen)}
      {btn(props.theme === "dark" ? "light_mode" : "dark_mode", "Cambiar tema (T)", props.onTheme)}
      {btn("keep", props.pinned ? "Ocultar barra (H)" : "Fijar barra (H)", props.onPin, { selected: props.pinned })}
      {btn("logout", "Salir al inicio", props.onExit)}
    </nav>
  );
}
