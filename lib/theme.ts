import { argbFromHex, hexFromArgb, Hct, MaterialDynamicColors as M, SchemeFidelity } from "@material/material-color-utilities";
import type { CSSProperties } from "react";
import type { Team } from "./types";

export type Theme = "dark" | "light";

/** Roles de color Material 3 de un equipo, generados a partir de su color semilla. */
export interface TeamPalette {
  primary: string;
  onPrimary: string;
  container: string;
  onContainer: string;
}

const cache = new Map<string, TeamPalette>();

/**
 * Esquema "Fidelity" de Material Color Utilities: conserva el color elegido como
 * contenedor del equipo y deriva el resto de roles con contraste garantizado.
 */
export function teamPalette(seed: string, theme: Theme): TeamPalette {
  const key = `${seed}-${theme}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let palette: TeamPalette;
  try {
    const s = new SchemeFidelity(Hct.fromInt(argbFromHex(seed)), theme === "dark", 0);
    palette = {
      primary: hexFromArgb(M.primary.getArgb(s)),
      onPrimary: hexFromArgb(M.onPrimary.getArgb(s)),
      container: hexFromArgb(M.primaryContainer.getArgb(s)),
      onContainer: hexFromArgb(M.onPrimaryContainer.getArgb(s)),
    };
  } catch {
    palette = { primary: seed, onPrimary: "#ffffff", container: seed, onContainer: "#ffffff" };
  }
  cache.set(key, palette);
  return palette;
}

/** Variables CSS --a-* y --b-* con los roles de color de ambos equipos. */
export function teamVars(teams: Team[], theme: Theme): CSSProperties {
  const vars: Record<string, string> = {};
  (["a", "b"] as const).forEach((p, i) => {
    const t = teamPalette(teams[i].color, theme);
    vars[`--${p}-primary`] = t.primary;
    vars[`--${p}-on-primary`] = t.onPrimary;
    vars[`--${p}-container`] = t.container;
    vars[`--${p}-on-container`] = t.onContainer;
  });
  return vars as CSSProperties;
}
