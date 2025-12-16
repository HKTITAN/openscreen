import type { ZoomRegion, ZoomFocus } from "../types";
import { smootherStep, catmullRomInterpolate } from "./mathUtils";
import { TRANSITION_WINDOW_MS } from "./constants";

export function computeRegionStrength(region: ZoomRegion, timeMs: number) {
  const leadInStart = region.startMs - TRANSITION_WINDOW_MS;
  const leadOutEnd = region.endMs + TRANSITION_WINDOW_MS;

  if (timeMs < leadInStart || timeMs > leadOutEnd) {
    return 0;
  }

  // Use smootherStep for more pleasant zoom transitions
  const fadeIn = smootherStep((timeMs - leadInStart) / TRANSITION_WINDOW_MS);
  const fadeOut = smootherStep((leadOutEnd - timeMs) / TRANSITION_WINDOW_MS);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Interpolate focus position from keyframes using Catmull-Rom splines
 * for ultra-smooth cursor following that preserves natural motion.
 */
export function interpolateFocusFromKeyframes(
  region: ZoomRegion,
  currentTimeMs: number
): ZoomFocus {
  const keyframes = region.focusKeyframes;
  
  // If no keyframes, return the static focus
  if (!keyframes || keyframes.length === 0) {
    return region.focus;
  }

  // Calculate time offset within the zoom region
  const timeOffset = currentTimeMs - region.startMs;

  // Before first keyframe - use first keyframe focus
  if (timeOffset <= keyframes[0].timeOffsetMs) {
    return keyframes[0].focus;
  }

  // After last keyframe - use last keyframe focus
  const lastKeyframe = keyframes[keyframes.length - 1];
  if (timeOffset >= lastKeyframe.timeOffsetMs) {
    return lastKeyframe.focus;
  }

  // Find the keyframe index we're at
  let currentIndex = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (timeOffset >= keyframes[i].timeOffsetMs && timeOffset < keyframes[i + 1].timeOffsetMs) {
      currentIndex = i;
      break;
    }
  }

  // Get 4 points for Catmull-Rom: p0, p1 (current), p2 (next), p3
  const p1 = keyframes[currentIndex];
  const p2 = keyframes[currentIndex + 1];
  
  // For edge cases, duplicate endpoints
  const p0 = currentIndex > 0 ? keyframes[currentIndex - 1] : p1;
  const p3 = currentIndex + 2 < keyframes.length ? keyframes[currentIndex + 2] : p2;

  // Calculate interpolation factor (0-1) between p1 and p2
  const segmentDuration = p2.timeOffsetMs - p1.timeOffsetMs;
  if (segmentDuration <= 0) {
    return p1.focus;
  }

  const t = (timeOffset - p1.timeOffsetMs) / segmentDuration;

  // Use Catmull-Rom spline for smooth curves through all keyframes
  return {
    cx: catmullRomInterpolate(p0.focus.cx, p1.focus.cx, p2.focus.cx, p3.focus.cx, t, 0.5),
    cy: catmullRomInterpolate(p0.focus.cy, p1.focus.cy, p2.focus.cy, p3.focus.cy, t, 0.5),
  };
}

export function findDominantRegion(regions: ZoomRegion[], timeMs: number) {
  let bestRegion: ZoomRegion | null = null;
  let bestStrength = 0;

  for (const region of regions) {
    const strength = computeRegionStrength(region, timeMs);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestRegion = region;
    }
  }

  return { region: bestRegion, strength: bestStrength };
}
