import React, { useMemo, useEffect, useState } from 'react';
import type { CursorSettings, CursorStyle } from './types';
import type { CursorEvent } from '@/utils/cursorUtils';

/** Video bounds info for positioning cursor within the video area */
export interface VideoBounds {
  /** X offset of video from container left */
  x: number;
  /** Y offset of video from container top */
  y: number;
  /** Width of the visible video area */
  width: number;
  /** Height of the visible video area */
  height: number;
}

interface CursorOverlayProps {
  cursorEvents: CursorEvent[];
  currentTimeMs: number;
  cursorSettings: CursorSettings;
  containerWidth: number;
  containerHeight: number;
  /** The bounds of the video within the container (accounting for padding) */
  videoBounds: VideoBounds;
}

/**
 * Find the cursor position at a given time by interpolating between cursor events
 */
function getCursorPositionAtTime(
  cursorEvents: CursorEvent[],
  timeMs: number
): { x: number; y: number; isClick: boolean } | null {
  if (cursorEvents.length === 0) return null;

  let beforeEvent: CursorEvent | null = null;
  let afterEvent: CursorEvent | null = null;
  let clickEvent: CursorEvent | null = null;

  for (let i = 0; i < cursorEvents.length; i++) {
    const event = cursorEvents[i];
    
    if (event.type === 'click' && Math.abs(event.timestamp - timeMs) < 300) {
      clickEvent = event;
    }
    
    if (event.timestamp <= timeMs) {
      beforeEvent = event;
    } else if (!afterEvent) {
      afterEvent = event;
      break;
    }
  }

  if (!beforeEvent && afterEvent) {
    return { x: afterEvent.normalizedX, y: afterEvent.normalizedY, isClick: !!clickEvent };
  }

  if (beforeEvent && !afterEvent) {
    return { x: beforeEvent.normalizedX, y: beforeEvent.normalizedY, isClick: !!clickEvent };
  }

  if (beforeEvent && afterEvent) {
    const timeDiff = afterEvent.timestamp - beforeEvent.timestamp;
    if (timeDiff === 0) {
      return { x: beforeEvent.normalizedX, y: beforeEvent.normalizedY, isClick: !!clickEvent };
    }
    
    const progress = (timeMs - beforeEvent.timestamp) / timeDiff;
    const smoothProgress = progress * progress * (3 - 2 * progress);
    
    return {
      x: beforeEvent.normalizedX + (afterEvent.normalizedX - beforeEvent.normalizedX) * smoothProgress,
      y: beforeEvent.normalizedY + (afterEvent.normalizedY - beforeEvent.normalizedY) * smoothProgress,
      isClick: !!clickEvent,
    };
  }

  return null;
}

/** Windows-style cursor SVG (black with white outline) */
const WindowsCursor = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.5 3.21V20.8C5.5 21.11 5.56 21.3 5.68 21.4C5.82 21.5 5.98 21.5 6.18 21.4C6.38 21.3 6.57 21.14 6.76 20.92L10.02 17.12L13.25 21.91C13.48 22.26 13.78 22.35 14.16 22.18C14.34 22.09 14.46 21.97 14.5 21.81C14.56 21.66 14.54 21.5 14.44 21.33L11.12 16.46L16.44 16.24C16.73 16.22 16.94 16.11 17.07 15.93C17.19 15.74 17.21 15.54 17.12 15.31C17.04 15.09 16.87 14.93 16.61 14.83L5.5 3.21Z"
      fill="black"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Windows-style cursor SVG (white with black outline) */
const WindowsCursorWhite = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.5 3.21V20.8C5.5 21.11 5.56 21.3 5.68 21.4C5.82 21.5 5.98 21.5 6.18 21.4C6.38 21.3 6.57 21.14 6.76 20.92L10.02 17.12L13.25 21.91C13.48 22.26 13.78 22.35 14.16 22.18C14.34 22.09 14.46 21.97 14.5 21.81C14.56 21.66 14.54 21.5 14.44 21.33L11.12 16.46L16.44 16.24C16.73 16.22 16.94 16.11 17.07 15.93C17.19 15.74 17.21 15.54 17.12 15.31C17.04 15.09 16.87 14.93 16.61 14.83L5.5 3.21Z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Mac-style cursor SVG (black with white outline) */
const MacCursor = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 2L4 19.5L8.5 15L12.5 22L15 21L11 14L17 14L4 2Z"
      fill="black"
      stroke="white"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Mac-style cursor SVG (white with black outline) */
const MacCursorWhite = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 2L4 19.5L8.5 15L12.5 22L15 21L11 14L17 14L4 2Z"
      fill="white"
      stroke="black"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Renders the cursor based on the style setting
 */
function renderCursor(
  style: CursorStyle,
  size: number,
  color: string,
  opacity: number,
  isClick: boolean,
  clickColor: string,
  showClickAnimation: boolean
): React.ReactNode {
  const effectiveColor = isClick && showClickAnimation ? clickColor : color;
  const clickScale = isClick && showClickAnimation ? 0.9 : 1;
  
  const baseStyle: React.CSSProperties = {
    opacity,
    transform: `scale(${clickScale})`,
    transition: 'transform 0.1s ease-out',
    pointerEvents: 'none',
  };

  switch (style) {
    case 'windows':
      return (
        <div style={baseStyle}>
          <WindowsCursor size={size} />
        </div>
      );
    case 'windows-white':
      return (
        <div style={baseStyle}>
          <WindowsCursorWhite size={size} />
        </div>
      );
    case 'mac':
      return (
        <div style={baseStyle}>
          <MacCursor size={size} />
        </div>
      );
    case 'mac-white':
      return (
        <div style={baseStyle}>
          <MacCursorWhite size={size} />
        </div>
      );
    case 'circle':
      return (
        <div
          style={{
            ...baseStyle,
            width: size,
            height: size,
            backgroundColor: effectiveColor,
            borderRadius: '50%',
            boxShadow: `0 0 ${size / 2}px ${effectiveColor}60, 0 2px 8px rgba(0,0,0,0.3)`,
          }}
        />
      );
    case 'ring':
      return (
        <div
          style={{
            ...baseStyle,
            width: size,
            height: size,
            border: `${Math.max(2, size / 8)}px solid ${effectiveColor}`,
            borderRadius: '50%',
            boxShadow: `0 0 ${size / 3}px ${effectiveColor}50`,
          }}
        />
      );
    case 'dot':
      return (
        <div
          style={{
            ...baseStyle,
            width: size / 2,
            height: size / 2,
            backgroundColor: effectiveColor,
            borderRadius: '50%',
            boxShadow: `0 0 ${size}px ${effectiveColor}80`,
          }}
        />
      );
    default:
      return null;
  }
}

/**
 * CursorOverlay renders a cursor indicator on top of the video
 * based on recorded cursor events and current playback time.
 * The cursor is positioned within the video bounds, accounting for padding.
 */
export function CursorOverlay({
  cursorEvents,
  currentTimeMs,
  cursorSettings,
  videoBounds,
}: CursorOverlayProps) {
  const [clickAnimation, setClickAnimation] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(-1000);

  // Get cursor position at current time (normalized 0-1)
  const cursorPosition = useMemo(() => {
    return getCursorPositionAtTime(cursorEvents, currentTimeMs);
  }, [cursorEvents, currentTimeMs]);

  // Handle click animation
  useEffect(() => {
    if (cursorPosition?.isClick && cursorSettings.showClickAnimation) {
      if (Math.abs(currentTimeMs - lastClickTime) > 100) {
        setClickAnimation(true);
        setLastClickTime(currentTimeMs);
        const timeout = setTimeout(() => setClickAnimation(false), 200);
        return () => clearTimeout(timeout);
      }
    }
  }, [cursorPosition?.isClick, currentTimeMs, lastClickTime, cursorSettings.showClickAnimation]);

  // Don't render if cursor is not visible or no position
  if (!cursorSettings.visible || !cursorPosition) {
    return null;
  }

  // Calculate pixel position within the video bounds
  // The normalized position (0-1) maps to the video area, not the full container
  const pixelX = videoBounds.x + cursorPosition.x * videoBounds.width;
  const pixelY = videoBounds.y + cursorPosition.y * videoBounds.height;

  // Check if cursor is within the video bounds (with small tolerance for cursor size)
  const tolerance = cursorSettings.size / 2;
  const isWithinBounds = 
    pixelX >= videoBounds.x - tolerance && 
    pixelX <= videoBounds.x + videoBounds.width + tolerance &&
    pixelY >= videoBounds.y - tolerance && 
    pixelY <= videoBounds.y + videoBounds.height + tolerance;

  if (!isWithinBounds) {
    return null;
  }

  // For mouse cursor styles, position from top-left corner (hotspot)
  // For abstract styles (circle, ring, dot), center on the point
  const isMouseCursor = ['windows', 'windows-white', 'mac', 'mac-white'].includes(cursorSettings.style);
  
  return (
    <div
      style={{
        position: 'absolute',
        left: pixelX,
        top: pixelY,
        // Mouse cursors: position from top-left (the tip of the cursor)
        // Other styles: center on the point
        transform: isMouseCursor ? 'translate(0, 0)' : 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {renderCursor(
        cursorSettings.style,
        cursorSettings.size,
        cursorSettings.color,
        cursorSettings.opacity,
        clickAnimation,
        cursorSettings.clickColor,
        cursorSettings.showClickAnimation
      )}
      
      {/* Click ripple effect */}
      {clickAnimation && cursorSettings.showClickAnimation && (
        <div
          style={{
            position: 'absolute',
            // For mouse cursors, offset the ripple to appear at the tip
            left: isMouseCursor ? 0 : '50%',
            top: isMouseCursor ? 0 : '50%',
            transform: isMouseCursor ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
            width: cursorSettings.size * 2,
            height: cursorSettings.size * 2,
            border: `2px solid ${cursorSettings.clickColor}`,
            borderRadius: '50%',
            opacity: 0,
            animation: 'cursorRipple 0.4s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}
      
      <style>{`
        @keyframes cursorRipple {
          0% {
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default CursorOverlay;
