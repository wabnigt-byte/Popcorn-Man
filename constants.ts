
import { ColorTheme } from './types';

export const CANVAS_SIZE = 800;
export const DEFAULT_GRID_SIZE = 200;
export const PLAYER_SPEED = 4;
export const COLLISION_MARGIN = 0.15; // Percent of cell size to allow "wiggle room"

export const THEMES: Record<string, ColorTheme> = {
  modern: {
    name: "Cyber Onyx",
    background: "#0f172a",
    gridLine: "#1e293b",
    player: "#38bdf8",
    eatable: "#fbbf24",
    nonEatable: "#1e293b", // Slightly visible but subtle
    eaten: "#0f172a", // Matches background to "disappear"
    accent: "#0ea5e9"
  },
  emerald: {
    name: "Forest Grid",
    background: "#064e3b",
    gridLine: "#065f46",
    player: "#34d399",
    eatable: "#fcd34d",
    nonEatable: "#064e3b",
    eaten: "#064e3b",
    accent: "#10b981"
  },
  crimson: {
    name: "Red Alert",
    background: "#450a0a",
    gridLine: "#7f1d1d",
    player: "#f87171",
    eatable: "#fbbf24",
    nonEatable: "#450a0a",
    eaten: "#450a0a",
    accent: "#ef4444"
  },
  math: {
    name: "Monochrome Calc",
    background: "#fafafa",
    gridLine: "#e5e5e5",
    player: "#171717",
    eatable: "#525252",
    nonEatable: "#f5f5f5",
    eaten: "#fafafa",
    accent: "#262626"
  }
};
