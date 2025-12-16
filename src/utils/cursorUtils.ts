import type { ZoomRegion, ZoomDepth, ZoomFocus, ZoomFocusKeyframe } from '../components/video-editor/types';

/**
 * Cursor event captured during recording
 */
export interface CursorEvent {
  type: 'move' | 'click' | 'scroll';
  timestamp: number; // ms since recording start
  x: number;
  y: number;
  normalizedX: number; // 0-1
  normalizedY: number; // 0-1
  button?: number;
  scrollDelta?: number;
}

/**
 * Configuration for auto-zoom generation
 */
export interface AutoZoomConfig {
  /** Zoom depth to use for auto-generated zooms (1-6) */
  zoomDepth: ZoomDepth;
  /** Duration of the zoom effect in ms */
  zoomDurationMs: number;
  /** Minimum time between auto-zooms in ms */
  minIntervalMs: number;
  /** Interval for sampling cursor position for keyframes in ms */
  keyframeSampleIntervalMs: number;
  /** Minimum distance (normalized) to create a new keyframe */
  keyframeMinDistance: number;
}

const DEFAULT_AUTO_ZOOM_CONFIG: AutoZoomConfig = {
  zoomDepth: 3,
  zoomDurationMs: 2000,
  minIntervalMs: 500,
  keyframeSampleIntervalMs: 50, // Sample every 50ms for smoother curves
  keyframeMinDistance: 0.01, // 1% of screen - capture finer movements
};

/**
 * Generate focus keyframes from cursor movements during a zoom period.
 * Creates smooth cursor-following animation within the zoom region.
 */
function generateFocusKeyframes(
  cursorEvents: CursorEvent[],
  zoomStartMs: number,
  zoomEndMs: number,
  initialFocus: ZoomFocus,
  config: AutoZoomConfig
): ZoomFocusKeyframe[] {
  const keyframes: ZoomFocusKeyframe[] = [];
  
  // First keyframe at the click position
  keyframes.push({
    timeOffsetMs: 0,
    focus: { ...initialFocus },
  });

  // Get all move events during the zoom period
  const movesDuringZoom = cursorEvents.filter(
    (e) => e.type === 'move' && e.timestamp >= zoomStartMs && e.timestamp <= zoomEndMs
  );

  if (movesDuringZoom.length === 0) {
    return keyframes;
  }

  // Sample cursor positions at regular intervals
  let lastKeyframeFocus = initialFocus;
  let lastSampleTime = zoomStartMs;

  for (const moveEvent of movesDuringZoom) {
    // Check if enough time has passed since last sample
    if (moveEvent.timestamp - lastSampleTime < config.keyframeSampleIntervalMs) {
      continue;
    }

    const newFocus: ZoomFocus = {
      cx: Math.max(0, Math.min(1, moveEvent.normalizedX)),
      cy: Math.max(0, Math.min(1, moveEvent.normalizedY)),
    };

    // Check if cursor moved enough to warrant a new keyframe
    const distance = Math.sqrt(
      Math.pow(newFocus.cx - lastKeyframeFocus.cx, 2) +
      Math.pow(newFocus.cy - lastKeyframeFocus.cy, 2)
    );

    if (distance >= config.keyframeMinDistance) {
      keyframes.push({
        timeOffsetMs: moveEvent.timestamp - zoomStartMs,
        focus: newFocus,
      });
      lastKeyframeFocus = newFocus;
      lastSampleTime = moveEvent.timestamp;
    }
  }

  // Add final position if we have movement and last keyframe is not at the end
  if (movesDuringZoom.length > 0) {
    const lastMove = movesDuringZoom[movesDuringZoom.length - 1];
    const lastKeyframe = keyframes[keyframes.length - 1];
    
    // Only add if significantly different from last keyframe
    if (lastKeyframe && lastMove.timestamp - zoomStartMs - lastKeyframe.timeOffsetMs > 50) {
      const finalFocus: ZoomFocus = {
        cx: Math.max(0, Math.min(1, lastMove.normalizedX)),
        cy: Math.max(0, Math.min(1, lastMove.normalizedY)),
      };
      
      const distance = Math.sqrt(
        Math.pow(finalFocus.cx - lastKeyframe.focus.cx, 2) +
        Math.pow(finalFocus.cy - lastKeyframe.focus.cy, 2)
      );
      
      if (distance >= config.keyframeMinDistance * 0.5) {
        keyframes.push({
          timeOffsetMs: lastMove.timestamp - zoomStartMs,
          focus: finalFocus,
        });
      }
    }
  }

  return keyframes;
}

/**
 * Generate zoom regions from cursor click events.
 * Creates smooth auto-zooms that follow cursor movement throughout the zoom duration.
 */
export function generateAutoZoomRegions(
  cursorEvents: CursorEvent[],
  videoDurationMs: number,
  existingZoomIdCounter: number = 0,
  config: Partial<AutoZoomConfig> = {}
): { regions: ZoomRegion[]; nextIdCounter: number } {
  const cfg: AutoZoomConfig = { ...DEFAULT_AUTO_ZOOM_CONFIG, ...config };
  
  // Filter to only click events (left-click primarily)
  const clickEvents = cursorEvents.filter(
    (e) => e.type === 'click' && (e.button === 1 || e.button === undefined)
  );

  if (clickEvents.length === 0) {
    return { regions: [], nextIdCounter: existingZoomIdCounter };
  }

  const regions: ZoomRegion[] = [];
  let idCounter = existingZoomIdCounter;
  let lastZoomEndMs = -cfg.minIntervalMs;

  for (const clickEvent of clickEvents) {
    // Skip if too close to last zoom
    if (clickEvent.timestamp - lastZoomEndMs < cfg.minIntervalMs) {
      continue;
    }

    const startMs = clickEvent.timestamp;
    const endMs = Math.min(startMs + cfg.zoomDurationMs, videoDurationMs);

    // Skip if zoom would extend beyond video or too short
    if (endMs - startMs < 300) {
      continue;
    }

    // Initial focus on click position
    const initialFocus: ZoomFocus = {
      cx: Math.max(0, Math.min(1, clickEvent.normalizedX)),
      cy: Math.max(0, Math.min(1, clickEvent.normalizedY)),
    };

    // Generate keyframes from cursor movement during the zoom
    const focusKeyframes = generateFocusKeyframes(
      cursorEvents,
      startMs,
      endMs,
      initialFocus,
      cfg
    );

    const region: ZoomRegion = {
      id: `auto-zoom-${++idCounter}`,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      depth: cfg.zoomDepth,
      focus: initialFocus,
      focusKeyframes: focusKeyframes.length > 1 ? focusKeyframes : undefined,
    };

    regions.push(region);
    lastZoomEndMs = endMs;
  }

  return { regions, nextIdCounter: idCounter };
}

/**
 * Merge auto-generated zoom regions with existing manual regions.
 * Manual regions take precedence - auto-zooms are removed if they overlap.
 */
export function mergeZoomRegions(
  autoRegions: ZoomRegion[],
  manualRegions: ZoomRegion[]
): ZoomRegion[] {
  // Start with all manual regions
  const merged: ZoomRegion[] = [...manualRegions];

  // Add auto regions that don't overlap with manual ones
  for (const autoRegion of autoRegions) {
    const overlapsManual = manualRegions.some(
      (manual) =>
        !(autoRegion.endMs <= manual.startMs || autoRegion.startMs >= manual.endMs)
    );

    if (!overlapsManual) {
      merged.push(autoRegion);
    }
  }

  // Sort by start time
  return merged.sort((a, b) => a.startMs - b.startMs);
}

/**
 * Analyze cursor events to provide statistics about the recording
 */
export function analyzeCursorEvents(events: CursorEvent[]): {
  totalClicks: number;
  totalMoves: number;
  totalScrolls: number;
  avgClickInterval: number;
  recordingDuration: number;
} {
  const clicks = events.filter((e) => e.type === 'click');
  const moves = events.filter((e) => e.type === 'move');
  const scrolls = events.filter((e) => e.type === 'scroll');

  let avgClickInterval = 0;
  if (clicks.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < clicks.length; i++) {
      intervals.push(clicks[i].timestamp - clicks[i - 1].timestamp);
    }
    avgClickInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  const recordingDuration = events.length > 0 
    ? Math.max(...events.map((e) => e.timestamp)) 
    : 0;

  return {
    totalClicks: clicks.length,
    totalMoves: moves.length,
    totalScrolls: scrolls.length,
    avgClickInterval,
    recordingDuration,
  };
}
