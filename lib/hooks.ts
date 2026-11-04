"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Anima un número hacia su nuevo valor (marcadores). */
export function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}

/** true cuando el ratón lleva `ms` sin moverse: oculta cursor y controles del moderador. */
export function useIdle(ms = 2500): boolean {
  const [idle, setIdle] = useState(true);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), ms);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [ms]);
  return idle;
}

/** Hora actual de alta precisión, refrescada en cada fotograma mientras `active`. */
export function useFrameNow(active: boolean, frozenAt: number | null): number {
  const [now, setNow] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));
  useEffect(() => {
    if (frozenAt !== null) {
      setNow(frozenAt);
      return;
    }
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, frozenAt]);
  return frozenAt ?? now;
}

/** Límites del tamaño general de la interfaz (1 = 100 %). */
export const ZOOM = { min: 0.5, max: 1.6, step: 0.1 };

export const clampZoom = (z: number) => Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(z * 100) / 100));

/**
 * Encoge el contenido hasta que cabe en su contenedor. Mide el alto natural de
 * `content` contra el alto visible de `box` y ajusta la variable CSS --fit, de la
 * que cuelgan los tamaños del bloque. Así las preguntas y las opciones largas se
 * ven completas sin salirse de la pantalla.
 */
export function useFitScale(
  box: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  deps: unknown[],
  min = 0.4,
) {
  useLayoutEffect(() => {
    const b = box.current;
    const c = content.current;
    if (!b || !c) return;
    let busy = false;
    const fit = () => {
      if (busy) return;
      busy = true;
      const apply = (v: number) => c.style.setProperty("--fit", v.toFixed(4));
      const fits = (v: number) => {
        apply(v);
        return c.getBoundingClientRect().height <= b.clientHeight;
      };
      // Búsqueda binaria del mayor tamaño que cabe. Hace falta porque el alto no
      // baja de forma proporcional: encoger la letra quita líneas de golpe, así que
      // una sola estimación se pasaría de pequeña y dejaría hueco sin aprovechar.
      if (b.clientHeight > 0 && !fits(1)) {
        let lo = min;
        let hi = 1;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        apply(lo);
      }
      busy = false;
    };
    fit();
    // El contenedor cambia de alto al redimensionar la ventana o al cambiar el zoom.
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    // Las métricas definitivas llegan cuando termina de cargar la tipografía.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}
