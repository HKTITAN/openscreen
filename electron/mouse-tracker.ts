import { uIOhook, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi'
import { screen } from 'electron'

/**
 * Represents a cursor event captured during recording
 */
export interface CursorEvent {
  type: 'move' | 'click' | 'scroll'
  timestamp: number // ms since recording start
  x: number // screen x coordinate
  y: number // screen y coordinate
  normalizedX: number // 0-1 normalized to recorded display
  normalizedY: number // 0-1 normalized to recorded display
  button?: number // 1 = left, 2 = right, 3 = middle
  scrollDelta?: number // for scroll events
}

/**
 * Configuration for the mouse tracker
 */
export interface MouseTrackerConfig {
  sourceId: string // The Electron desktopCapturer source ID being recorded
  recordingStartTime: number
  onCursorEvent?: (event: CursorEvent) => void
}

class MouseTracker {
  private isTracking = false
  private events: CursorEvent[] = []
  private config: MouseTrackerConfig | null = null
  private displayBounds: { x: number; y: number; width: number; height: number } | null = null
  private lastMoveTime = 0
  private moveThrottleMs = 8 // ~120fps for ultra-smooth cursor tracking

  /**
   * Start tracking mouse events
   */
  start(config: MouseTrackerConfig): void {
    if (this.isTracking) {
      console.warn('Mouse tracker is already running')
      return
    }

    this.config = config
    this.events = []
    this.isTracking = true

    // Determine display bounds based on source ID
    this.displayBounds = this.getDisplayBoundsForSource(config.sourceId)

    // Register event handlers
    uIOhook.on('mousemove', this.handleMouseMove)
    uIOhook.on('mousedown', this.handleMouseDown)
    uIOhook.on('wheel', this.handleWheel)

    // Start the hook
    uIOhook.start()

    console.log('Mouse tracker started for source:', config.sourceId)
  }

  /**
   * Stop tracking and return all captured events
   */
  stop(): CursorEvent[] {
    if (!this.isTracking) {
      return []
    }

    uIOhook.off('mousemove', this.handleMouseMove)
    uIOhook.off('mousedown', this.handleMouseDown)
    uIOhook.off('wheel', this.handleWheel)

    try {
      uIOhook.stop()
    } catch (e) {
      console.error('Error stopping uIOhook:', e)
    }

    this.isTracking = false
    const capturedEvents = [...this.events]
    this.events = []
    this.config = null
    this.displayBounds = null

    console.log(`Mouse tracker stopped. Captured ${capturedEvents.length} events`)
    return capturedEvents
  }

  /**
   * Get the current events without stopping
   */
  getEvents(): CursorEvent[] {
    return [...this.events]
  }

  /**
   * Check if tracker is running
   */
  isRunning(): boolean {
    return this.isTracking
  }

  /**
   * Get display bounds for the given source ID
   */
  private getDisplayBoundsForSource(sourceId: string): { x: number; y: number; width: number; height: number } {
    const displays = screen.getAllDisplays()
    
    // For screen sources (e.g., "screen:0:0"), parse the display ID
    if (sourceId.startsWith('screen:')) {
      const parts = sourceId.split(':')
      if (parts.length >= 2) {
        const displayIndex = parseInt(parts[1], 10)
        const display = displays[displayIndex] || screen.getPrimaryDisplay()
        return display.bounds
      }
    }

    // For window sources or fallback, use primary display
    // Window sources capture relative to the window, but we track global cursor
    const primaryDisplay = screen.getPrimaryDisplay()
    
    // For windows, we still track the whole screen but normalize to primary
    // The video editor will need to know this was a window capture
    return primaryDisplay.bounds
  }

  /**
   * Normalize coordinates to 0-1 range based on display bounds
   */
  private normalizeCoordinates(x: number, y: number): { normalizedX: number; normalizedY: number } {
    if (!this.displayBounds) {
      return { normalizedX: 0.5, normalizedY: 0.5 }
    }

    const { x: bx, y: by, width, height } = this.displayBounds
    
    // Clamp coordinates within display bounds
    const clampedX = Math.max(bx, Math.min(x, bx + width))
    const clampedY = Math.max(by, Math.min(y, by + height))
    
    const normalizedX = (clampedX - bx) / width
    const normalizedY = (clampedY - by) / height

    return { normalizedX, normalizedY }
  }

  /**
   * Calculate timestamp relative to recording start
   */
  private getTimestamp(): number {
    if (!this.config) return 0
    return Date.now() - this.config.recordingStartTime
  }

  /**
   * Handle mouse move events (throttled)
   */
  private handleMouseMove = (e: UiohookMouseEvent): void => {
    if (!this.isTracking || !this.config) return

    const now = Date.now()
    if (now - this.lastMoveTime < this.moveThrottleMs) {
      return // Throttle move events
    }
    this.lastMoveTime = now

    const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y)
    
    const event: CursorEvent = {
      type: 'move',
      timestamp: this.getTimestamp(),
      x: e.x,
      y: e.y,
      normalizedX,
      normalizedY,
    }

    this.events.push(event)
    this.config.onCursorEvent?.(event)
  }

  /**
   * Handle mouse click events
   */
  private handleMouseDown = (e: UiohookMouseEvent): void => {
    if (!this.isTracking || !this.config) return

    const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y)

    const event: CursorEvent = {
      type: 'click',
      timestamp: this.getTimestamp(),
      x: e.x,
      y: e.y,
      normalizedX,
      normalizedY,
      button: typeof e.button === 'number' ? e.button : undefined,
    }

    this.events.push(event)
    this.config.onCursorEvent?.(event)
  }

  /**
   * Handle scroll wheel events
   */
  private handleWheel = (e: UiohookWheelEvent): void => {
    if (!this.isTracking || !this.config) return

    const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y)

    const event: CursorEvent = {
      type: 'scroll',
      timestamp: this.getTimestamp(),
      x: e.x,
      y: e.y,
      normalizedX,
      normalizedY,
      scrollDelta: e.rotation,
    }

    this.events.push(event)
    this.config.onCursorEvent?.(event)
  }
}

// Export singleton instance
export const mouseTracker = new MouseTracker()
