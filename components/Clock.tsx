"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useFrameNow } from "@/lib/hooks";
import { sfx } from "@/lib/sound";

const R = 46;
const C = 2 * Math.PI * R;
/** Separación entre indicador y pista (Material 3), compensando el remate redondeado del trazo. */
const GAP = 7 + 4;

interface Props {
  /** Instante (performance.now) en que empieza a correr el reloj. Puede estar en el futuro. */
  start: number;
  duration: number;
  pausedAt: number | null;
  color: string;
  running: boolean;
  /** Si se indica, el indicador se muestra lleno y con este texto en lugar de la cuenta atrás. */
  staticText?: string;
  /** Retrasa la aparición del texto fijo (deja ver antes los puntos volando al marcador). */
  delayStatic?: boolean;
  /** Texto pequeño bajo el número (puntos en juego). */
  label?: string;
}

/** Indicador de progreso circular de Material 3 con cuenta atrás de centésimas. */
export default function Clock({ start, duration, pausedAt, color, running, staticText, delayStatic, label }: Props) {
  const now = useFrameNow(running && staticText === undefined, pausedAt);
  const remaining = staticText !== undefined ? duration : Math.min(duration, Math.max(0, start + duration - now));
  const frac = duration > 0 ? remaining / duration : 0;

  const secs = Math.floor(remaining / 1000);
  const cents = Math.floor((remaining % 1000) / 10)
    .toString()
    .padStart(2, "0");
  const urgent = staticText === undefined && running && remaining > 0 && remaining <= 5000;

  // Pitido en cada uno de los últimos cinco segundos.
  const lastSecond = useRef<number | null>(null);
  const whole = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (!running || pausedAt !== null || staticText !== undefined) {
      lastSecond.current = null;
      return;
    }
    if (lastSecond.current !== null && whole !== lastSecond.current && whole <= 5 && whole >= 1) {
      sfx.tick(whole === 1);
    }
    lastSecond.current = whole;
  }, [whole, running, pausedAt, staticText]);

  const bar = C * frac;
  const full = frac >= 0.999;
  const track = full ? 0 : Math.max(0, C - bar - 2 * GAP);

  return (
    <div
      className={`clock${pausedAt !== null ? " paused" : ""}`}
      style={{ "--clock": color } as CSSProperties}
      role="timer"
      aria-label={staticText ?? `${secs} segundos`}
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        {track > 0.5 && (
          <circle
            className="clock-track"
            cx="50"
            cy="50"
            r={R}
            strokeDasharray={`${track} ${C}`}
            strokeDashoffset={-(bar + GAP)}
          />
        )}
        {bar > 0.5 && (
          <circle className="clock-bar" cx="50" cy="50" r={R} strokeDasharray={`${full ? C : bar} ${C}`} />
        )}
      </svg>
      <div className="clock-num">
        {staticText !== undefined ? (
          <span
            className={`clock-static ${staticText.length > 4 ? "title-large" : "headline-medium"} emphasized${delayStatic ? " delayed" : ""}`}
          >
            {staticText}
          </span>
        ) : (
          <span key={urgent ? whole : "n"} className={`headline-large emphasized${urgent ? " clock-beat" : ""}`}>
            {secs}
            <small>,{cents}</small>
          </span>
        )}
        {label && <span className="clock-label label-medium">{label}</span>}
      </div>
    </div>
  );
}
