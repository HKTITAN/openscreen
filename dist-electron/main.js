var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { ipcMain, screen, BrowserWindow, desktopCapturer, shell, app, dialog, nativeImage, Tray, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { uIOhook } from "uiohook-napi";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST$1 = path.join(APP_ROOT, "dist");
let hudOverlayWindow = null;
ipcMain.on("hud-overlay-hide", () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});
function createHudOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const windowWidth = 500;
  const windowHeight = 100;
  const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
  const y = Math.floor(workArea.y + workArea.height - windowHeight - 5);
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 100,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  hudOverlayWindow = win;
  win.on("closed", () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
  }
  return win;
}
function createEditorWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "OpenScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });
  win.maximize();
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "editor" }
    });
  }
  return win;
}
function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return win;
}
class MouseTracker {
  constructor() {
    __publicField(this, "isTracking", false);
    __publicField(this, "events", []);
    __publicField(this, "config", null);
    __publicField(this, "displayBounds", null);
    __publicField(this, "lastMoveTime", 0);
    __publicField(this, "moveThrottleMs", 8);
    /**
     * Handle mouse move events (throttled)
     */
    __publicField(this, "handleMouseMove", (e) => {
      var _a, _b;
      if (!this.isTracking || !this.config) return;
      const now = Date.now();
      if (now - this.lastMoveTime < this.moveThrottleMs) {
        return;
      }
      this.lastMoveTime = now;
      const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y);
      const event = {
        type: "move",
        timestamp: this.getTimestamp(),
        x: e.x,
        y: e.y,
        normalizedX,
        normalizedY
      };
      this.events.push(event);
      (_b = (_a = this.config).onCursorEvent) == null ? void 0 : _b.call(_a, event);
    });
    /**
     * Handle mouse click events
     */
    __publicField(this, "handleMouseDown", (e) => {
      var _a, _b;
      if (!this.isTracking || !this.config) return;
      const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y);
      const event = {
        type: "click",
        timestamp: this.getTimestamp(),
        x: e.x,
        y: e.y,
        normalizedX,
        normalizedY,
        button: typeof e.button === "number" ? e.button : void 0
      };
      this.events.push(event);
      (_b = (_a = this.config).onCursorEvent) == null ? void 0 : _b.call(_a, event);
    });
    /**
     * Handle scroll wheel events
     */
    __publicField(this, "handleWheel", (e) => {
      var _a, _b;
      if (!this.isTracking || !this.config) return;
      const { normalizedX, normalizedY } = this.normalizeCoordinates(e.x, e.y);
      const event = {
        type: "scroll",
        timestamp: this.getTimestamp(),
        x: e.x,
        y: e.y,
        normalizedX,
        normalizedY,
        scrollDelta: e.rotation
      };
      this.events.push(event);
      (_b = (_a = this.config).onCursorEvent) == null ? void 0 : _b.call(_a, event);
    });
  }
  // ~120fps for ultra-smooth cursor tracking
  /**
   * Start tracking mouse events
   */
  start(config) {
    if (this.isTracking) {
      console.warn("Mouse tracker is already running");
      return;
    }
    this.config = config;
    this.events = [];
    this.isTracking = true;
    this.displayBounds = this.getDisplayBoundsForSource(config.sourceId);
    uIOhook.on("mousemove", this.handleMouseMove);
    uIOhook.on("mousedown", this.handleMouseDown);
    uIOhook.on("wheel", this.handleWheel);
    uIOhook.start();
    console.log("Mouse tracker started for source:", config.sourceId);
  }
  /**
   * Stop tracking and return all captured events
   */
  stop() {
    if (!this.isTracking) {
      return [];
    }
    uIOhook.off("mousemove", this.handleMouseMove);
    uIOhook.off("mousedown", this.handleMouseDown);
    uIOhook.off("wheel", this.handleWheel);
    try {
      uIOhook.stop();
    } catch (e) {
      console.error("Error stopping uIOhook:", e);
    }
    this.isTracking = false;
    const capturedEvents = [...this.events];
    this.events = [];
    this.config = null;
    this.displayBounds = null;
    console.log(`Mouse tracker stopped. Captured ${capturedEvents.length} events`);
    return capturedEvents;
  }
  /**
   * Get the current events without stopping
   */
  getEvents() {
    return [...this.events];
  }
  /**
   * Check if tracker is running
   */
  isRunning() {
    return this.isTracking;
  }
  /**
   * Get display bounds for the given source ID
   */
  getDisplayBoundsForSource(sourceId) {
    const displays = screen.getAllDisplays();
    if (sourceId.startsWith("screen:")) {
      const parts = sourceId.split(":");
      if (parts.length >= 2) {
        const displayIndex = parseInt(parts[1], 10);
        const display = displays[displayIndex] || screen.getPrimaryDisplay();
        return display.bounds;
      }
    }
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.bounds;
  }
  /**
   * Normalize coordinates to 0-1 range based on display bounds
   */
  normalizeCoordinates(x, y) {
    if (!this.displayBounds) {
      return { normalizedX: 0.5, normalizedY: 0.5 };
    }
    const { x: bx, y: by, width, height } = this.displayBounds;
    const clampedX = Math.max(bx, Math.min(x, bx + width));
    const clampedY = Math.max(by, Math.min(y, by + height));
    const normalizedX = (clampedX - bx) / width;
    const normalizedY = (clampedY - by) / height;
    return { normalizedX, normalizedY };
  }
  /**
   * Calculate timestamp relative to recording start
   */
  getTimestamp() {
    if (!this.config) return 0;
    return Date.now() - this.config.recordingStartTime;
  }
}
const mouseTracker = new MouseTracker();
let selectedSource = null;
let currentCursorEvents = [];
function registerIpcHandlers(createEditorWindow2, createSourceSelectorWindow2, getMainWindow, getSourceSelectorWindow, onRecordingStateChange) {
  ipcMain.handle("get-sources", async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });
  ipcMain.handle("select-source", (_, source) => {
    selectedSource = source;
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.close();
    }
    return selectedSource;
  });
  ipcMain.handle("get-selected-source", () => {
    return selectedSource;
  });
  ipcMain.handle("open-source-selector", () => {
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.focus();
      return;
    }
    createSourceSelectorWindow2();
  });
  ipcMain.handle("switch-to-editor", () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      mainWin.close();
    }
    createEditorWindow2();
  });
  ipcMain.handle("store-recorded-video", async (_, videoData, fileName) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName);
      await fs.writeFile(videoPath, Buffer.from(videoData));
      currentVideoPath = videoPath;
      return {
        success: true,
        path: videoPath,
        message: "Video stored successfully"
      };
    } catch (error) {
      console.error("Failed to store video:", error);
      return {
        success: false,
        message: "Failed to store video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("get-recorded-video-path", async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR);
      const videoFiles = files.filter((file) => file.endsWith(".webm"));
      if (videoFiles.length === 0) {
        return { success: false, message: "No recorded video found" };
      }
      const latestVideo = videoFiles.sort().reverse()[0];
      const videoPath = path.join(RECORDINGS_DIR, latestVideo);
      return { success: true, path: videoPath };
    } catch (error) {
      console.error("Failed to get video path:", error);
      return { success: false, message: "Failed to get video path", error: String(error) };
    }
  });
  ipcMain.handle("set-recording-state", (_, recording) => {
    const source = selectedSource || { name: "Screen" };
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name);
    }
  });
  ipcMain.handle("open-external-url", async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open URL:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("get-asset-base-path", () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, "assets");
      }
      return path.join(app.getAppPath(), "public", "assets");
    } catch (err) {
      console.error("Failed to resolve asset base path:", err);
      return null;
    }
  });
  ipcMain.handle("save-exported-video", async (_, videoData, fileName) => {
    try {
      const result = await dialog.showSaveDialog({
        title: "Save Exported Video",
        defaultPath: path.join(app.getPath("downloads"), fileName),
        filters: [
          { name: "MP4 Video", extensions: ["mp4"] }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: "Export cancelled"
        };
      }
      await fs.writeFile(result.filePath, Buffer.from(videoData));
      return {
        success: true,
        path: result.filePath,
        message: "Video exported successfully"
      };
    } catch (error) {
      console.error("Failed to save exported video:", error);
      return {
        success: false,
        message: "Failed to save exported video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("open-video-file-picker", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Select Video File",
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error("Failed to open file picker:", error);
      return {
        success: false,
        message: "Failed to open file picker",
        error: String(error)
      };
    }
  });
  let currentVideoPath = null;
  ipcMain.handle("set-current-video-path", (_, path2) => {
    currentVideoPath = path2;
    return { success: true };
  });
  ipcMain.handle("get-current-video-path", () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });
  ipcMain.handle("clear-current-video-path", () => {
    currentVideoPath = null;
    return { success: true };
  });
  ipcMain.handle("get-platform", () => {
    return process.platform;
  });
  ipcMain.handle("start-mouse-tracking", (_, sourceId, recordingStartTime) => {
    try {
      currentCursorEvents = [];
      mouseTracker.start({
        sourceId,
        recordingStartTime,
        onCursorEvent: (event) => {
          currentCursorEvents.push(event);
        }
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to start mouse tracking:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("stop-mouse-tracking", () => {
    try {
      const events = mouseTracker.stop();
      currentCursorEvents = events;
      return { success: true, events };
    } catch (error) {
      console.error("Failed to stop mouse tracking:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("get-cursor-events", () => {
    return { success: true, events: currentCursorEvents };
  });
  ipcMain.handle("store-cursor-events", async (_, events, videoFileName) => {
    try {
      const eventsFileName = videoFileName.replace(/\.(webm|mp4)$/, "-cursor-events.json");
      const eventsPath = path.join(RECORDINGS_DIR, eventsFileName);
      await fs.writeFile(eventsPath, JSON.stringify(events, null, 2));
      return { success: true, path: eventsPath };
    } catch (error) {
      console.error("Failed to store cursor events:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("load-cursor-events", async (_, videoPath) => {
    try {
      const eventsPath = videoPath.replace(/\.(webm|mp4)$/, "-cursor-events.json");
      const data = await fs.readFile(eventsPath, "utf-8");
      const events = JSON.parse(data);
      return { success: true, events };
    } catch (error) {
      console.log("No cursor events found for video:", videoPath);
      return { success: false, events: [] };
    }
  });
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");
async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
    console.log("User Data Path:", app.getPath("userData"));
  } catch (error) {
    console.error("Failed to create recordings directory:", error);
  }
}
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
let tray = null;
let selectedSourceName = "";
function createWindow() {
  mainWindow = createHudOverlayWindow();
}
function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC || RENDERER_DIST, "rec-button.png");
  let icon = nativeImage.createFromPath(iconPath);
  icon = icon.resize({ width: 24, height: 24, quality: "best" });
  tray = new Tray(icon);
  updateTrayMenu();
}
function updateTrayMenu() {
  if (!tray) return;
  const menuTemplate = [
    {
      label: "Stop Recording",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stop-recording-from-tray");
        }
      }
    }
  ];
  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Recording: ${selectedSourceName}`);
}
function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  mainWindow = createEditorWindow();
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
app.on("window-all-closed", () => {
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  const { ipcMain: ipcMain2 } = await import("electron");
  ipcMain2.on("hud-overlay-close", () => {
    app.quit();
  });
  await ensureRecordingsDir();
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording, sourceName) => {
      selectedSourceName = sourceName;
      if (recording) {
        if (!tray) createTray();
        updateTrayMenu();
      } else {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        if (mainWindow) mainWindow.restore();
      }
    }
  );
  createWindow();
});
export {
  MAIN_DIST,
  RECORDINGS_DIR,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
