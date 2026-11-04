"use client";

import { useCallback, useEffect, useState } from "react";
import Game from "./Game";
import Setup from "./Setup";
import { createGame, type GameState } from "@/lib/game";
import { prepareQuestions } from "@/lib/questions";
import { clampZoom, ZOOM } from "@/lib/hooks";
import { setMuted } from "@/lib/sound";
import { clearSavedGame, loadPrefs, savePrefs, type SavedGame } from "@/lib/storage";
import type { Theme } from "@/lib/theme";
import type { QuestionFile, Settings, Team } from "@/lib/types";

export default function App() {
  const [game, setGame] = useState<{ state: GameState; id: number } | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const prefs = loadPrefs();
    if (prefs.theme) setTheme(prefs.theme);
    if (prefs.muted) setMuted(true);
    if (prefs.zoom) setZoom(clampZoom(prefs.zoom));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--zoom", String(zoom));
  }, [zoom]);

  /** `delta` en pasos de zoom; `null` vuelve al 100 %. */
  const changeZoom = useCallback((delta: number | null) => {
    setZoom((z) => {
      const next = delta === null ? 1 : clampZoom(z + delta);
      if (next !== z) savePrefs({ zoom: next });
      return next;
    });
  }, []);

  // − / + / 0 reescalan la interfaz, con o sin Ctrl (⌘). Se hace aquí, y no en la
  // pantalla de juego, para que también funcione en la configuración y en el podio.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return;
      const out = e.code === "Minus" || e.code === "Slash" || e.code === "NumpadSubtract";
      const inn = e.code === "Equal" || e.code === "BracketRight" || e.code === "NumpadAdd";
      const reset = e.code === "Digit0" || e.code === "Numpad0";
      if (!out && !inn && !reset) return;
      // Mientras se escribe en un campo, solo con Ctrl o ⌘: el guion sigue sirviendo para escribir.
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing && !(e.ctrlKey || e.metaKey)) return;
      // Sustituye al zoom del navegador, que en esta interfaz no cambia nada.
      e.preventDefault();
      changeZoom(reset ? null : out ? -ZOOM.step : ZOOM.step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeZoom]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      savePrefs({ theme: next });
      return next;
    });
  }, []);

  const play = (state: GameState) => setGame((g) => ({ state, id: (g?.id ?? 0) + 1 }));

  const start = (file: QuestionFile, teams: [Team, Team], settings: Settings) => {
    clearSavedGame();
    play(createGame({ title: file.title, questions: prepareQuestions(file.questions, settings), teams, settings }));
  };

  const resume = (saved: SavedGame) => {
    play(
      createGame({
        title: saved.title,
        questions: saved.questions,
        teams: saved.teams,
        settings: saved.settings,
        index: saved.index,
        stats: saved.stats,
        rounds: saved.rounds,
      }),
    );
  };

  const replay = (prev: GameState) => {
    clearSavedGame();
    play(
      createGame({
        title: prev.title,
        questions: prepareQuestions(prev.questions, prev.settings),
        teams: prev.teams,
        settings: prev.settings,
      }),
    );
  };

  if (game) {
    return (
      <Game
        key={game.id}
        initial={game.state}
        theme={theme}
        zoom={zoom}
        onZoom={changeZoom}
        onExit={() => setGame(null)}
        onReplay={replay}
        onToggleTheme={toggleTheme}
      />
    );
  }
  return <Setup theme={theme} onStart={start} onResume={resume} onToggleTheme={toggleTheme} />;
}
