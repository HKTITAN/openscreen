import type { ZoomFocus } from "../types";

export const DEFAULT_FOCUS: ZoomFocus = { cx: 0.5, cy: 0.5 };
export const TRANSITION_WINDOW_MS = 400; // Longer transition for smoother zoom in/out
export const SMOOTHING_FACTOR = 0.08; // Lower = smoother but more lag
export const MIN_DELTA = 0.00005; // Finer precision for smoother stopping
export const VIEWPORT_SCALE = 0.8;
