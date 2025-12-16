/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Cursor event types for auto-zoom feature
interface CursorEvent {
  type: 'move' | 'click' | 'scroll'
  timestamp: number // ms since recording start
  x: number // screen x coordinate
  y: number // screen y coordinate
  normalizedX: number // 0-1 normalized to recorded display
  normalizedY: number // 0-1 normalized to recorded display
  button?: number // 1 = left, 2 = right, 3 = middle
  scrollDelta?: number // for scroll events
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
    getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; message?: string }>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string; cancelled?: boolean }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>
    setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    hudOverlayHide: () => void;
    hudOverlayClose: () => void;
    getAssetBasePath: () => Promise<string | null>
    // Mouse tracking APIs for auto-zoom feature
    startMouseTracking: (sourceId: string, recordingStartTime: number) => Promise<{ success: boolean; error?: string }>
    stopMouseTracking: () => Promise<{ success: boolean; events?: CursorEvent[]; error?: string }>
    getCursorEvents: () => Promise<{ success: boolean; events: CursorEvent[] }>
    storeCursorEvents: (events: CursorEvent[], videoFileName: string) => Promise<{ success: boolean; path?: string; error?: string }>
    loadCursorEvents: (videoPath: string) => Promise<{ success: boolean; events: CursorEvent[] }>
  }
}

interface ProcessedDesktopSource {
  id: string
  name: string
  display_id: string
  thumbnail: string | null
  appIcon: string | null
}