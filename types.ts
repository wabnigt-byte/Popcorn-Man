
export interface Vector2 {
  x: number;
  y: number;
}

export interface ColorTheme {
  name: string;
  background: string;
  gridLine: string;
  player: string;
  eatable: string;
  nonEatable: string;
  eaten: string;
  accent: string;
}

export interface GameState {
  score: number;
  inverted: boolean;
  cheatMode: boolean;
  gameFinished: boolean;
  gridSize: number;
  playerPos: Vector2;
  eatenCount: number;
  totalToEat: number;
  startTime: number | null;
  elapsedTime: number;
}

export enum GameMode {
  NORMAL = 'NORMAL',
  INVERTED = 'INVERTED',
  CHEAT = 'CHEAT'
}
