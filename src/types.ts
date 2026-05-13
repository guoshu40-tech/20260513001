export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  dx: number;
  dy: number;
}

export interface Ball {
  pos: Point;
  vel: Velocity;
  radius: number;
}

export interface Paddle {
  x: number;
  width: number;
  height: number;
  color: string;
}

export enum BrickType {
  NORMAL,
  STRONG,
  BONUS,
  SPEEDUP,
  EXPAND,
  MULTIBALL,
}

export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  status: number; // 0: broken, 1+: hit points
  type: BrickType;
  color: string;
}

export interface LevelConfig {
  id: number;
  brickMap: number[][]; // BrickType represented by numbers
  ballSpeed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export enum GameStatus {
  START,
  PLAYING,
  GAMEOVER,
  WON,
}
