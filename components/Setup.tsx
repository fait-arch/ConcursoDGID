"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { points } from "@/lib/format";
import { toggleFullscreen } from "@/lib/hooks";
import { keyLabel, RESERVED_KEYS } from "@/lib/keys";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS,
  parseQuestionFile,
  roundSize,
  TEAM_COLORS,
  unplayedCount,
} from "@/lib/questions";
import { sfx, unlockAudio } from "@/lib/sound";
import {
  clearSavedGame,
  clearUsedQuestions,
  loadSavedGame,
  loadUsedQuestions,
  type SavedGame,
} from "@/lib/storage";
import { teamPalette, teamVars, type Theme } from "@/lib/theme";
import type { QuestionFile, Settings, Team, TeamId } from "@/lib/types";

interface Props {
  theme: Theme;
  onStart: (file: QuestionFile, teams: [Team, Team], settings: Settings) => void;
  onResume: (saved: SavedGame) => void;
  onToggleTheme: () => void;
}

type Load = { status: "loading" } | { status: "ok"; file: QuestionFile } | { status: "error"; message: string };

function keyProblem(teams: Team[], i: number): string | null {
  const k = teams[i].key;
  if (RESERVED_KEYS.has(k)) return `${keyLabel(k)} la usa el moderador. Elige otra tecla.`;
  if (teams[1 - i].key === k) return `${keyLabel(k)} ya es el pulsador de ${teams[1 - i].name}.`;
  return null;
}

const MODERATOR_KEYS: [string[], string][] = [
  [["Espacio"], "Lanzar la pregunta y pasar a la siguiente"],
  [["1", "9"], "Opción que respondió el equipo, y 0 la décima (se corrige sola)"],
  [["C", "X"], "Respuesta correcta o incorrecta"],
  [["Z"], "Deshacer el último paso"],
  [["P"], "Pausar o continuar el reloj"],
  [["S"], "Anular la pregunta"],
  [["F"], "Pantalla completa"],
  [["M"], "Silenciar o activar el sonido"],
  [["T"], "Tema claro u oscuro"],
  [["H"], "Fijar la barra de controles"],
  [["−", "+", "0"], "Reducir, aumentar o restablecer el tamaño de la interfaz"],
];

export default function Setup({ theme, onStart, onResume, onToggleTheme }: Props) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [teams, setTeams] = useState<[Team, Team]>([DEFAULT_TEAMS[0], DEFAULT_TEAMS[1]]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [binding, setBinding] = useState<TeamId | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);
  const [flash, setFlash] = useState<[number, number]>([0, 0]);
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const accept = useCallback((file: QuestionFile) => {
    setLoad({ status: "ok", file });
    setTeams([file.teams[0], file.teams[1]]);
    setSettings(file.settings);
    setUsed(loadUsedQuestions(file.source));
  }, []);

  const fetchFile = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      const res = await fetch("/api/preguntas", { cache: "no-store" });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          msg = (JSON.parse(text) as { error?: string }).error ?? text;
        } catch {}
        throw new Error(msg);
      }
      accept(parseQuestionFile(text, "preguntas.json"));
    } catch (e) {
      setLoad({ status: "error", message: (e as Error).message });
    }
  }, [accept]);

  const readLocalFile = useCallback(
    async (f: File) => {
      try {
        accept(parseQuestionFile(await f.text(), f.name));
      } catch (e) {
        setLoad({ status: "error", message: (e as Error).message });
      }
    },
    [accept],
  );

  useEffect(() => {
    void fetchFile();
    setSaved(loadSavedGame());
  }, [fetchFile]);

  const problems = [keyProblem(teams, 0), keyProblem(teams, 1)];
  const canStart = load.status === "ok" && !problems[0] && !problems[1] && teams.every((t) => t.name.trim());

  const start = useCallback(() => {
    if (!canStart || load.status !== "ok") return;
    unlockAudio();
    const clean: [Team, Team] = [
      { ...teams[0], name: teams[0].name.trim() },
      { ...teams[1], name: teams[1].name.trim() },
    ];
    onStart(load.file, clean, settings);
  }, [canStart, load, teams, settings, onStart]);

  // Teclado: asignar pulsadores, probarlos y empezar con Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (showKeys) {
        if (e.code === "Escape") setShowKeys(false);
        return;
      }
      if (binding !== null) {
        e.preventDefault();
        if (e.code === "Escape") {
          setBinding(null);
          setBindError(null);
          return;
        }
        const next: [Team, Team] = [{ ...teams[0] }, { ...teams[1] }];
        next[binding].key = e.code;
        const problem = keyProblem(next, binding);
        if (problem) {
          setBindError(problem);
          return;
        }
        setTeams(next);
        setBinding(null);
        setBindError(null);
        unlockAudio();
        sfx.buzz(binding);
        setFlash((f) => (binding === 0 ? [f[0] + 1, f[1]] : [f[0], f[1] + 1]));
        return;
      }
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (typing) {
        if (e.code === "Enter") target.blur();
        return;
      }
      const t = teams.findIndex((tm) => tm.key === e.code);
      if (t === 0 || t === 1) {
        e.preventDefault();
        unlockAudio();
        sfx.buzz(t);
        setFlash((f) => (t === 0 ? [f[0] + 1, f[1]] : [f[0], f[1] + 1]));
        return;
      }
      if (e.code === "Enter" && (target.tagName !== "BUTTON" || target.classList.contains("fab"))) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binding, teams, start, showKeys]);

  // Arrastrar y soltar un JSON en cualquier parte de la pantalla.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer?.files[0];
      if (f) void readLocalFile(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [readLocalFile]);

  const setTeam = (i: TeamId, patch: Partial<Team>) =>
    setTeams((ts) => {
      const next: [Team, Team] = [ts[0], ts[1]];
      next[i] = { ...ts[i], ...patch };
      return next;
    });

  const vars = useMemo(() => teamVars(teams, theme), [teams, theme]);
  const file = load.status === "ok" ? load.file : null;
  const customTimes = file?.questions.some((q) => q.buzzTime !== undefined || q.answerTime !== undefined);
  const openCount = file?.questions.filter((q) => q.options.length === 0).length ?? 0;
  const total = file?.questions.length ?? 0;
  const perRound = total ? roundSize(total, settings) : settings.perRound || DEFAULT_SETTINGS.perRound;
  const unplayed = file ? unplayedCount(file.questions, used) : 0;
  const played = total - unplayed;

  return (
    <div className="setup" style={vars}>
      <header className="appbar">
        <h1 className="appbar-title headline-small emphasized">{file?.title ?? "Concurso"}</h1>
        <button type="button" className="icon-btn state" data-tip="Teclas del moderador" aria-label="Teclas del moderador" onClick={() => setShowKeys(true)}>
          <Icon name="keyboard" />
        </button>
        <button type="button" className="icon-btn state" data-tip="Cambiar tema" aria-label="Cambiar tema" onClick={onToggleTheme}>
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
        </button>
        <button type="button" className="icon-btn state" data-tip="Pantalla completa" aria-label="Pantalla completa" onClick={toggleFullscreen}>
          <Icon name="fullscreen" />
        </button>
      </header>

      <div className="setup-body">
        {saved && (
          <div className="banner span-12" role="status">
            <Icon name="history" />
            <p className="banner-text body-medium">
              Hay una partida a medias de <strong>{saved.title}</strong> en la pregunta{" "}
              {Math.min(saved.index + 1, saved.questions.length)} de {saved.questions.length}: {saved.teams[0].name}{" "}
              {points(saved.stats[0].score)}, {saved.teams[1].name} {points(saved.stats[1].score)}.
            </p>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-text state"
                onClick={() => {
                  clearSavedGame();
                  setSaved(null);
                }}
              >
                Descartar
              </button>
              <button
                type="button"
                className="btn btn-filled state"
                onClick={() => {
                  unlockAudio();
                  onResume(saved);
                }}
              >
                <Icon name="play_arrow" />
                Reanudar
              </button>
            </div>
          </div>
        )}

        {([0, 1] as const).map((i) => (
          <section key={i} className={`team-form team-form-${i === 0 ? "a" : "b"} card span-6`} aria-label={`Equipo ${i + 1}`}>
            <div key={flash[i]} className={`team-form-flash${flash[i] ? " go" : ""}`} aria-hidden />
            <div className="team-form-row">
              <label className="field">
                <span className="field-label">Nombre del equipo {i + 1}</span>
                <input
                  className="title-large"
                  size={1}
                  value={teams[i].name}
                  onChange={(e) => setTeam(i, { name: e.target.value })}
                  maxLength={28}
                  spellCheck={false}
                />
              </label>
              <div className={`field field-static${(binding === i && bindError) || problems[i] ? " error" : ""}`}>
                <span className="field-label">Pulsador</span>
                <span className={`keycap${binding === i ? " waiting" : ""}`}>
                  {binding === i ? "…" : keyLabel(teams[i].key)}
                </span>
                <button
                  type="button"
                  className="btn btn-text state"
                  onClick={() => {
                    setBindError(null);
                    setBinding(binding === i ? null : i);
                  }}
                >
                  {binding === i ? "Cancelar" : "Cambiar"}
                </button>
              </div>
            </div>
            <div className="swatches" role="radiogroup" aria-label={`Color del equipo ${i + 1}`}>
              <span className="label-large on-surface-variant">Color</span>
              {TEAM_COLORS.filter((c) => teams[1 - i].color.toLowerCase() !== c.toLowerCase()).map((c) => {
                const pal = teamPalette(c, theme);
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={teams[i].color.toLowerCase() === c.toLowerCase()}
                    aria-label={c}
                    className="swatch"
                    style={{ background: pal.container, color: pal.onContainer }}
                    onClick={() => setTeam(i, { color: c })}
                  >
                    <Icon name="check" />
                  </button>
                );
              })}
            </div>
            <p className={`supporting body-small${(binding === i && bindError) || problems[i] ? " error" : " on-surface-variant"}`}>
              {binding === i
                ? bindError ?? "Pulsa la tecla o el pulsador que usará este equipo."
                : problems[i] ?? "Pulsa su tecla para probarla: la tarjeta se ilumina."}
            </p>
          </section>
        ))}

        <section className="card source-card span-12" aria-label="Preguntas">
          <div className="source-info">
            <span className={`source-icon${load.status === "error" ? " error" : ""}`}>
              <Icon name={load.status === "error" ? "error" : load.status === "loading" ? "hourglass_top" : "quiz"} />
            </span>
            <div className="source-text">
              {load.status === "loading" && <p className="title-medium">Leyendo preguntas.json…</p>}
              {load.status === "ok" && (
                <>
                  <p className="title-medium">
                    {load.file.questions.length} preguntas · {perRound} por ronda
                  </p>
                  <p className="body-medium on-surface-variant">
                    Cargadas de {load.file.source}
                    {openCount > 0 && `, ${openCount} de respuesta abierta`}.
                    {customTimes && " Las que tienen tiempo propio lo conservan."}
                    {played > 0 &&
                      (unplayed > 0
                        ? ` Ya han salido ${played}: quedan ${unplayed} sin jugar.`
                        : " Ya han salido todas: la próxima ronda empieza el ciclo de nuevo.")}
                  </p>
                </>
              )}
              {load.status === "error" && (
                <>
                  <p className="title-medium">No se pudieron cargar las preguntas</p>
                  <pre className="source-error body-medium on-surface-variant">{load.message}</pre>
                </>
              )}
            </div>
            <div className="source-actions">
              {played > 0 && (
                <button
                  type="button"
                  className="btn btn-text state"
                  data-tip="Vuelven a entrar todas en el sorteo"
                  onClick={() => {
                    clearUsedQuestions();
                    setUsed([]);
                  }}
                >
                  <Icon name="restart_alt" />
                  Reiniciar jugadas
                </button>
              )}
              <button type="button" className="btn btn-text state" onClick={() => void fetchFile()}>
                <Icon name="refresh" />
                Volver a leer
              </button>
              <button type="button" className="btn btn-text state" onClick={() => fileInput.current?.click()}>
                <Icon name="upload_file" />
                Abrir otro archivo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readLocalFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="divider" />
          <div className="settings">
            <label className="field">
              <span className="field-label">Preguntas por ronda</span>
              <input
                type="number"
                size={1}
                min={1}
                max={total || undefined}
                disabled={!total}
                value={perRound}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    perRound: Math.min(total || 9999, Math.max(1, Math.round(Number(e.target.value) || 1))),
                  })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Tiempo para pulsar</span>
              <input
                type="number"
                size={1}
                min={3}
                max={600}
                value={settings.buzzTime}
                onChange={(e) => setSettings({ ...settings, buzzTime: Math.max(3, Number(e.target.value) || 3) })}
              />
              <span className="field-suffix">s</span>
            </label>
            <label className="field">
              <span className="field-label">Tiempo para responder</span>
              <input
                type="number"
                size={1}
                min={3}
                max={600}
                value={settings.answerTime}
                onChange={(e) => setSettings({ ...settings, answerTime: Math.max(3, Number(e.target.value) || 3) })}
              />
              <span className="field-suffix">s</span>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={settings.shuffle}
              className="switch"
              onClick={() => setSettings({ ...settings, shuffle: !settings.shuffle })}
            >
              <span className="switch-track">
                <span className="switch-handle">
                  <Icon name="check" />
                </span>
              </span>
              Mezclar preguntas
            </button>
          </div>
          <p className="supporting body-small on-surface-variant">
            Cada ronda saca {perRound} {perRound === 1 ? "pregunta" : "preguntas"} al azar
            {total > perRound ? ` de las ${total}` : ""} y no las repite en las rondas siguientes hasta
            agotarlas. «Mezclar preguntas» además desordena las de la ronda; sin marcarlo salen en el
            orden del archivo.
          </p>
        </section>

        <div className="setup-actions span-12">
          <p className="body-medium on-surface-variant">
            o pulsa <kbd>Enter</kbd>
          </p>
          <button type="button" className="fab state" disabled={!canStart} onClick={start}>
            <Icon name="play_arrow" filled />
            Comenzar partida
          </button>
        </div>
      </div>

      {showKeys && (
        <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="keys-title" onClick={() => setShowKeys(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <Icon name="keyboard" className="dialog-icon" />
            <h2 id="keys-title" className="headline-small" style={{ textAlign: "center" }}>
              Teclas del moderador
            </h2>
            <dl className="keys-list">
              {MODERATOR_KEYS.map(([keys, desc]) => (
                <div key={desc} style={{ display: "contents" }}>
                  <dt className="label-large">
                    {keys.length === 2 && keys[0] === "1" ? (
                      <>
                        <kbd>{keys[0]}</kbd>–<kbd>{keys[1]}</kbd>
                      </>
                    ) : (
                      keys.map((k, j) => (
                        <span key={k}>
                          {j > 0 && " "}
                          <kbd>{k}</kbd>
                        </span>
                      ))
                    )}
                  </dt>
                  <dd className="body-medium on-surface-variant">{desc}</dd>
                </div>
              ))}
            </dl>
            <div className="dialog-actions">
              <button type="button" className="btn btn-text state" onClick={() => setShowKeys(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {dragging && (
        <div className="drop" aria-hidden>
          <Icon name="upload_file" />
          <p className="headline-small">Suelta el archivo JSON para cargar sus preguntas</p>
        </div>
      )}
    </div>
  );
}
