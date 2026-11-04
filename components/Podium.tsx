"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Icon from "./Icon";
import { avgTime, rank, type GameState } from "@/lib/game";
import { clearConfetti, confettiCelebration } from "@/lib/effects";
import { points, seconds } from "@/lib/format";
import { useCountUp } from "@/lib/hooks";
import { sfx } from "@/lib/sound";
import { teamPalette, type Theme } from "@/lib/theme";
import type { TeamId } from "@/lib/types";

const DRUMROLL_MS = 2400;

interface Props {
  state: GameState;
  theme: Theme;
  onReplay: () => void;
  onExit: () => void;
}

export default function Podium({ state, theme, onReplay, onExit }: Props) {
  const [shown, setShown] = useState(false);
  const { winner, byTime } = rank(state.stats);
  const tie = winner === null;

  useEffect(() => {
    clearConfetti();
    const stops: (() => void)[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const palette = (t: TeamId) => {
      const p = teamPalette(state.teams[t].color, theme);
      return [p.container, p.primary, state.teams[t].color];
    };
    timers.push(setTimeout(() => sfx.drumroll(DRUMROLL_MS / 1000), 30));
    timers.push(
      setTimeout(() => {
        setShown(true);
        sfx.fanfare();
        stops.push(confettiCelebration(tie ? palette(0) : palette(winner), 7));
        if (tie) timers.push(setTimeout(() => stops.push(confettiCelebration(palette(1), 7)), 300));
      }, DRUMROLL_MS),
    );
    return () => {
      timers.forEach(clearTimeout);
      stops.forEach((stop) => stop());
      clearConfetti();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = tie ? "var(--md-sys-color-primary)" : `var(--${winner === 0 ? "a" : "b"}-primary)`;

  return (
    <div className={`podium-screen${shown ? " shown" : ""}`} style={{ "--w": bg } as CSSProperties}>
      {!shown ? (
        <p className="drum display-medium emphasized" role="status">
          <span>
            Y el ganador es<span className="dots">…</span>
          </span>
        </p>
      ) : (
        <>
          <header className="podium-head">
            <p className="title-medium on-surface-variant">{state.title}</p>
            <h1 className="podium-title display-medium emphasized">
              {tie ? "¡Empate!" : `¡Gana ${state.teams[winner].name}!`}
            </h1>
            {byTime && (
              <p className="podium-note body-large on-surface-variant">
                Empate a puntos: gana el equipo con menor tiempo medio de respuesta.
              </p>
            )}
          </header>
          <div className="podium">
            {([0, 1] as const).map((t) => (
              <Place key={t} state={state} team={t} place={tie ? 1 : t === winner ? 1 : 2} tie={tie} />
            ))}
          </div>
          <div className="podium-actions">
            <button type="button" className="btn btn-filled state" onClick={onReplay}>
              <Icon name="replay" />
              Jugar de nuevo
            </button>
            <button type="button" className="btn btn-outlined state" onClick={onExit}>
              <Icon name="home" />
              Volver al inicio
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Place({ state, team, place, tie }: { state: GameState; team: TeamId; place: 1 | 2; tie: boolean }) {
  const t = state.teams[team];
  const st = state.stats[team];
  const score = useCountUp(st.score, 1800);
  const avg = avgTime(st);
  const first = place === 1;
  const style = {
    "--h": `calc(${tie ? 148 : first ? 176 : 120} * var(--dp))`,
    "--delay": first && !tie ? "0.75s" : "0.15s",
  } as CSSProperties;
  return (
    <section
      className={`place place-${team === 0 ? "a" : "b"}${first ? " first" : ""}`}
      style={style}
      aria-label={`${t.name}: ${st.score} puntos`}
    >
      <div className="place-stack">
        <div className="place-head">
          {first && !tie && (
            <span className="crown" aria-hidden>
              👑
            </span>
          )}
          <span className="headline-small emphasized">{t.name}</span>
        </div>
        <div className="block">
          <span className="block-score display-large">{points(score)}</span>
          <span className="block-unit label-large">puntos</span>
        </div>
      </div>
      <dl className="place-stats">
        <div>
          <dt className="label-medium">Aciertos</dt>
          <dd className="title-large emphasized tnum">{st.correct}</dd>
        </div>
        <div>
          <dt className="label-medium">En rebote</dt>
          <dd className="title-large emphasized tnum">{st.rebounds}</dd>
        </div>
        <div>
          <dt className="label-medium">Tiempo medio</dt>
          <dd className="title-large emphasized tnum">{Number.isFinite(avg) ? seconds(avg) : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
