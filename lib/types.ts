export type TeamId = 0 | 1;

export interface Team {
  name: string;
  color: string;
  /** KeyboardEvent.code de la tecla o pulsador asignado (p. ej. "KeyA", "ShiftLeft"). */
  key: string;
}

export interface Settings {
  /** Segundos que tienen los equipos para pulsar. */
  buzzTime: number;
  /** Segundos que tiene el equipo con el turno para responder. */
  answerTime: number;
  /** Puntos por defecto de cada pregunta. */
  points: number;
  /** Fracción de los puntos que se garantiza aunque se pulse en el último instante (0–1). */
  minFactor: number;
  /** Fracción del bote que gana el equipo que acierta en el rebote (0–1). */
  reboundFactor: number;
  shuffle: boolean;
}

/** Pregunta tal como se lee del JSON, con tiempos opcionales. */
export interface RawQuestion {
  text: string;
  options: string[];
  /** Índice de la opción correcta, o -1 si es de respuesta abierta. */
  correct: number;
  answer: string;
  category?: string;
  points?: number;
  buzzTime?: number;
  answerTime?: number;
}

/** Pregunta lista para jugar, con todos los valores resueltos. */
export interface Question {
  text: string;
  options: string[];
  correct: number;
  answer: string;
  category?: string;
  points: number;
  buzzTime: number;
  answerTime: number;
}

export interface QuestionFile {
  title: string;
  settings: Settings;
  teams: Team[];
  questions: RawQuestion[];
  source: string;
}
