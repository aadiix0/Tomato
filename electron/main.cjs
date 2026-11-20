const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let islandWindow = null;
let tray = null;
let staticServer = null;
let isQuitting = false;
let lastIslandState = null;

const MIN_ISLAND_WIDTH = 206;
const DEFAULT_ISLAND_WIDTH = 232;
const MAX_ISLAND_WIDTH = 360;
const ISLAND_HEIGHT = 44;
const DEFAULT_TRAY_RIGHT_OFFSET = 225;

const VALID_VISIBILITY_MODES = ['always', 'when_closed_running', 'when_closed', 'off'];
const VALID_WIDE_DETAIL_MODES = ['task', 'goal', 'off'];

const PREFERRED_PORTS = [47831, 47832, 47833, 47834, 47835, 0];

function getDataFilePath() {
  return path.join(app.getPath('userData'), 'zonein-data.json');
}

function registerStorageIpcHandlers() {
  ipcMain.handle('zonein-storage:path', () => getDataFilePath());

  ipcMain.handle('zonein-storage:load', async () => {
    try {
      const filePath = getDataFilePath();
      if (!fs.existsSync(filePath)) {
        return { success: true, data: null };
      }
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, data };
    } catch (err) {
      return { success: false, data: null, error: String(err) };
    }
  });

  ipcMain.handle('zonein-storage:save', async (_event, jsonData) => {
    try {
      const filePath = getDataFilePath();
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmpPath = `${filePath}.tmp`;
      await fs.promises.writeFile(tmpPath, String(jsonData), 'utf-8');
      await fs.promises.rename(tmpPath, filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}

function getIslandConfigPath() {
  return path.join(app.getPath('userData'), 'zonein-island-config.json');
}

function clampWidth(w) {
  const num = Number(w);
  if (!Number.isFinite(num)) return DEFAULT_ISLAND_WIDTH;
  return Math.max(MIN_ISLAND_WIDTH, Math.min(MAX_ISLAND_WIDTH, Math.round(num)));
}

function loadIslandConfig() {
  try {
    const cfgPath = getIslandConfigPath();
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const fallbackMode = parsed.visible === false ? 'off' : 'always';
      const visibilityMode = VALID_VISIBILITY_MODES.includes(parsed.visibilityMode)
        ? parsed.visibilityMode
        : fallbackMode;
      const wideDetailMode = VALID_WIDE_DETAIL_MODES.includes(parsed.wideDetailMode)
        ? parsed.wideDetailMode
        : 'task';
      return {
        visibilityMode,
        locked: parsed.locked !== false,
        customX: typeof parsed.customX === 'number' ? parsed.customX : null,
        customWidth: clampWidth(parsed.customWidth ?? DEFAULT_ISLAND_WIDTH),
        wideDetailMode,
      };
    }
  } catch {
    // ignore malformed config
  }
  return {
    visibilityMode: 'always',
    locked: true,
    customX: null,
    customWidth: DEFAULT_ISLAND_WIDTH,
    wideDetailMode: 'task',
  };
}

function saveIslandConfig(config) {
  try {
    fs.writeFileSync(getIslandConfigPath(), JSON.stringify(config), 'utf-8');
  } catch {
    // ignore write error
  }
}

let islandConfig = {
  visibilityMode: 'always',
  locked: true,
  customX: null,
  customWidth: DEFAULT_ISLAND_WIDTH,
  wideDetailMode: 'task',
};

function computeIslandBounds() {
  const display = screen.getPrimaryDisplay();
  const { bounds, workArea } = display;
  const width = clampWidth(islandConfig.customWidth);
  const taskbarHeight = Math.max(40, bounds.height - workArea.height);
  const y = bounds.y + bounds.height - Math.round((taskbarHeight + ISLAND_HEIGHT) / 2);
  const defaultX = bounds.x + bounds.width - width - DEFAULT_TRAY_RIGHT_OFFSET;
  const rawX = typeof islandConfig.customX === 'number' ? islandConfig.customX : defaultX;
  const minX = bounds.x + 8;
  const maxX = bounds.x + bounds.width - width - 8;
  const x = Math.max(minX, Math.min(maxX, Math.round(rawX)));
  return { x, y, width, height: ISLAND_HEIGHT };
}

function sendIslandConfig() {
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.webContents.send('zonein-island:config', {
      locked: islandConfig.locked,
      customWidth: clampWidth(islandConfig.customWidth),
      wideDetailMode: islandConfig.wideDetailMode,
      visibilityMode: islandConfig.visibilityMode,
    });
  }
}

function isMainWindowForegroundOpen() {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible() &&
      !mainWindow.isMinimized()
  );
}

function shouldShowIsland() {
  const mode = islandConfig.visibilityMode || 'always';
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  const mainOpen = isMainWindowForegroundOpen();
  if (mode === 'when_closed') return !mainOpen;
  if (mode === 'when_closed_running') {
    return !mainOpen && Boolean(lastIslandState && lastIslandState.timerRunning);
  }
  return true;
}

function raiseIslandAboveTaskbar() {
  if (!islandWindow || islandWindow.isDestroyed() || !islandWindow.isVisible()) return;
  islandWindow.setAlwaysOnTop(true, 'screen-saver');
  if (typeof islandWindow.moveTop === 'function') {
    islandWindow.moveTop();
  }
}

function syncIslandVisibility() {
  if (!islandWindow || islandWindow.isDestroyed()) return;
  const show = shouldShowIsland();
  if (show) {
    if (!islandWindow.isVisible()) {
      islandWindow.showInactive();
    }
    raiseIslandAboveTaskbar();
    setTimeout(() => {
      if (shouldShowIsland()) raiseIslandAboveTaskbar();
    }, 65);
  } else if (islandWindow.isVisible()) {
    islandWindow.hide();
  }
}

function setVisibilityMode(mode, notifyMain = true) {
  const nextMode = VALID_VISIBILITY_MODES.includes(mode) ? mode : 'always';
  islandConfig.visibilityMode = nextMode;
  saveIslandConfig(islandConfig);
  syncIslandVisibility();
  sendIslandConfig();
  updateTrayMenu();
  if (notifyMain && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('zonein-island:visibility-mode-changed', nextMode);
  }
  return nextMode;
}

function applyPresetWidth(targetWidth) {
  const display = screen.getPrimaryDisplay();
  const { bounds } = display;
  const nextWidth = clampWidth(targetWidth);
  const prevBounds = islandWindow && !islandWindow.isDestroyed()
    ? islandWindow.getBounds()
    : computeIslandBounds();

  const rightEdge = prevBounds.x + prevBounds.width;
  const minX = bounds.x + 8;
  const maxX = bounds.x + bounds.width - nextWidth - 8;
  const desiredX = typeof islandConfig.customX === 'number'
    ? rightEdge - nextWidth
    : bounds.x + bounds.width - nextWidth - DEFAULT_TRAY_RIGHT_OFFSET;
  const nextX = Math.max(minX, Math.min(maxX, Math.round(desiredX)));

  islandConfig.customWidth = nextWidth;
  if (typeof islandConfig.customX === 'number') {
    islandConfig.customX = nextX;
  }
  saveIslandConfig(islandConfig);

  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.setBounds({ x: nextX, y: prevBounds.y, width: nextWidth, height: ISLAND_HEIGHT });
  }
  sendIslandConfig();
}

function applyPresetPosition(preset) {
  const display = screen.getPrimaryDisplay();
  const { bounds } = display;
  const width = clampWidth(islandConfig.customWidth);
  const current = islandWindow && !islandWindow.isDestroyed()
    ? islandWindow.getBounds()
    : computeIslandBounds();

  let nextX;
  if (preset === 'left') {
    nextX = bounds.x + 140;
  } else if (preset === 'center') {
    nextX = bounds.x + Math.round((bounds.width - width) / 2);
  } else {
    islandConfig.customX = null;
    nextX = bounds.x + bounds.width - width - DEFAULT_TRAY_RIGHT_OFFSET;
  }

  const minX = bounds.x + 8;
  const maxX = bounds.x + bounds.width - width - 8;
  nextX = Math.max(minX, Math.min(maxX, Math.round(nextX)));
  if (preset !== 'default') {
    islandConfig.customX = nextX;
  }
  saveIslandConfig(islandConfig);

  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.setBounds({ x: nextX, y: current.y, width, height: ISLAND_HEIGHT });
  }
}

function resetIslandLayout() {
  islandConfig.customX = null;
  islandConfig.customWidth = DEFAULT_ISLAND_WIDTH;
  saveIslandConfig(islandConfig);
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.setBounds(computeIslandBounds());
  }
  sendIslandConfig();
}

function openIslandContextMenu() {
  if (!islandWindow || islandWindow.isDestroyed()) return;
  const w = clampWidth(islandConfig.customWidth);
  const menu = Menu.buildFromTemplate([
    {
      label: 'Lock Position & Size',
      type: 'checkbox',
      checked: islandConfig.locked,
      click: (item) => {
        islandConfig.locked = Boolean(item.checked);
        saveIslandConfig(islandConfig);
        sendIslandConfig();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Taskbar Position',
      submenu: [
        {
          label: 'Default (Near Tray)',
          click: () => applyPresetPosition('default'),
        },
        {
          label: 'Center',
          click: () => applyPresetPosition('center'),
        },
        {
          label: 'Left',
          click: () => applyPresetPosition('left'),
        },
      ],
    },
    {
      label: 'Island Width',
      submenu: [
        {
          label: 'Compact',
          type: 'radio',
          checked: w < 245,
          click: () => applyPresetWidth(220),
        },
        {
          label: 'Balanced',
          type: 'radio',
          checked: w >= 245 && w < 305,
          click: () => applyPresetWidth(276),
        },
        {
          label: 'Wide',
          type: 'radio',
          checked: w >= 305,
          click: () => applyPresetWidth(338),
        },
      ],
    },
    {
      label: 'Wide Mode Details',
      submenu: [
        {
          label: 'Show Active Task / Topic',
          type: 'radio',
          checked: islandConfig.wideDetailMode === 'task',
          click: () => {
            islandConfig.wideDetailMode = 'task';
            saveIslandConfig(islandConfig);
            sendIslandConfig();
          },
        },
        {
          label: 'Show Daily Goal Progress',
          type: 'radio',
          checked: islandConfig.wideDetailMode === 'goal',
          click: () => {
            islandConfig.wideDetailMode = 'goal';
            saveIslandConfig(islandConfig);
            sendIslandConfig();
          },
        },
        {
          label: 'Off (Clean Spacing Only)',
          type: 'radio',
          checked: islandConfig.wideDetailMode === 'off',
          click: () => {
            islandConfig.wideDetailMode = 'off';
            saveIslandConfig(islandConfig);
            sendIslandConfig();
          },
        },
      ],
    },
    {
      label: 'Visibility',
      submenu: [
        {
          label: 'Always Show on Taskbar',
          type: 'radio',
          checked: islandConfig.visibilityMode === 'always',
          click: () => setVisibilityMode('always', true),
        },
        {
          label: 'When Closed While Running',
          type: 'radio',
          checked: islandConfig.visibilityMode === 'when_closed_running',
          click: () => setVisibilityMode('when_closed_running', true),
        },
        {
          label: 'When Minimized or Closed',
          type: 'radio',
          checked: islandConfig.visibilityMode === 'when_closed',
          click: () => setVisibilityMode('when_closed', true),
        },
        {
          label: 'Hide Island',
          type: 'radio',
          checked: islandConfig.visibilityMode === 'off',
          click: () => setVisibilityMode('off', true),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Reset Position & Size',
      click: () => resetIslandLayout(),
    },
    {
      label: 'Open Zonein',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
  ]);

  menu.popup({ window: islandWindow });
}

function createTaskbarIsland() {
  if (islandWindow && !islandWindow.isDestroyed()) return;

  islandConfig = loadIslandConfig();
  const { x, y, width, height } = computeIslandBounds();

  islandWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    hasShadow: false,
    type: 'toolbar',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'island-preload.cjs'),
    },
  });

  islandWindow.setAlwaysOnTop(true, 'screen-saver');
  islandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  void islandWindow.loadFile(path.join(__dirname, 'taskbar-island.html'));

  islandWindow.webContents.on('did-finish-load', () => {
    sendIslandConfig();
    if (lastIslandState && islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('zonein-island:state', lastIslandState);
    }
  });

  islandWindow.once('ready-to-show', () => {
    sendIslandConfig();
    if (lastIslandState && islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('zonein-island:state', lastIslandState);
    }
    syncIslandVisibility();
  });

  islandWindow.on('closed', () => {
    islandWindow = null;
  });
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show Zonein',
        click: () => {
          if (mainWindow?.isMinimized()) mainWindow.restore();
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Taskbar Island Visibility',
        submenu: [
          {
            label: 'Always Show',
            type: 'radio',
            checked: islandConfig.visibilityMode === 'always',
            click: () => setVisibilityMode('always', true),
          },
          {
            label: 'When Closed While Running',
            type: 'radio',
            checked: islandConfig.visibilityMode === 'when_closed_running',
            click: () => setVisibilityMode('when_closed_running', true),
          },
          {
            label: 'When Minimized or Closed',
            type: 'radio',
            checked: islandConfig.visibilityMode === 'when_closed',
            click: () => setVisibilityMode('when_closed', true),
          },
          {
            label: 'Off (Hidden)',
            type: 'radio',
            checked: islandConfig.visibilityMode === 'off',
            click: () => setVisibilityMode('off', true),
          },
        ],
      },
      {
        label: 'Lock Island Position & Size',
        type: 'checkbox',
        checked: islandConfig.locked,
        click: (menuItem) => {
          islandConfig.locked = Boolean(menuItem.checked);
          saveIslandConfig(islandConfig);
          sendIslandConfig();
        },
      },
      {
        label: 'Reset Island Position & Size',
        click: () => resetIslandLayout(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function registerIslandIpcHandlers() {
  ipcMain.on('zonein-island:update-state', (_event, state) => {
    const prevRunning = Boolean(lastIslandState && lastIslandState.timerRunning);
    lastIslandState = state;
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('zonein-island:state', state);
    }
    if (Boolean(state && state.timerRunning) !== prevRunning) {
      syncIslandVisibility();
    }
  });

  ipcMain.on('zonein-island:action', (_event, action) => {
    if (action === 'show-main') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zonein-island:action', action);
    }
  });

  ipcMain.on('zonein-island:move-by', (_event, deltaX) => {
    if (islandConfig.locked) return;
    if (!islandWindow || islandWindow.isDestroyed()) return;
    const display = screen.getPrimaryDisplay();
    const { bounds } = display;
    const current = islandWindow.getBounds();
    const minX = bounds.x + 8;
    const maxX = bounds.x + bounds.width - current.width - 8;
    const nextX = Math.max(minX, Math.min(maxX, Math.round(current.x + Number(deltaX || 0))));
    islandWindow.setBounds({ x: nextX, y: current.y, width: current.width, height: ISLAND_HEIGHT });
    islandConfig.customX = nextX;
  });

  ipcMain.on('zonein-island:resize-by', (_event, payload) => {
    if (islandConfig.locked) return;
    if (!islandWindow || islandWindow.isDestroyed() || !payload) return;
    const display = screen.getPrimaryDisplay();
    const { bounds } = display;
    const current = islandWindow.getBounds();
    const delta = Math.round(Number(payload.deltaX || 0));
    if (!delta) return;

    const side = payload.side === 'left' ? 'left' : 'right';
    let nextWidth = current.width;
    let nextX = current.x;

    if (side === 'right') {
      const maxAllowed = Math.min(MAX_ISLAND_WIDTH, bounds.x + bounds.width - 8 - current.x);
      nextWidth = Math.max(MIN_ISLAND_WIDTH, Math.min(maxAllowed, current.width + delta));
    } else {
      const rightEdge = current.x + current.width;
      const maxAllowed = Math.min(MAX_ISLAND_WIDTH, rightEdge - (bounds.x + 8));
      nextWidth = Math.max(MIN_ISLAND_WIDTH, Math.min(maxAllowed, current.width - delta));
      nextX = rightEdge - nextWidth;
    }

    islandWindow.setBounds({ x: nextX, y: current.y, width: nextWidth, height: ISLAND_HEIGHT });
    islandConfig.customWidth = nextWidth;
    islandConfig.customX = nextX;
    sendIslandConfig();
  });

  ipcMain.on('zonein-island:save-pos', () => {
    saveIslandConfig(islandConfig);
  });

  ipcMain.on('zonein-island:context-menu', () => {
    openIslandContextMenu();
  });

  ipcMain.handle('zonein-island:get-visible', () => islandConfig.visibilityMode !== 'off');

  ipcMain.handle('zonein-island:set-visible', (_event, visible) => {
    const mode = setVisibilityMode(visible ? 'always' : 'off', false);
    return mode !== 'off';
  });

  ipcMain.handle('zonein-island:get-visibility-mode', () => islandConfig.visibilityMode);

  ipcMain.handle('zonein-island:set-visibility-mode', (_event, mode) => {
    return setVisibilityMode(mode, false);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function startLocalServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = (req.url || '/').split('?')[0];
      let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    let portIdx = 0;
    const tryListen = () => {
      const portToTry = PREFERRED_PORTS[portIdx++];
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && portIdx < PREFERRED_PORTS.length) {
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(portToTry, '127.0.0.1', () => {
        const address = server.address();
        resolve({ server, port: address.port });
      });
    };

    tryListen();
  });
}

async function createWindow() {
  const distDir = path.join(__dirname, '..', 'dist');
  const { server, port } = await startLocalServer(distDir);
  staticServer = server;

  const iconPath = path.join(distDir, 'pwa-192x192.png');
  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 420,
    minHeight: 600,
    title: 'Zonein',
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Allow Google OAuth popups and open other external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('accounts.google.com') ||
      url.includes('firebaseapp.com') ||
      url.includes('127.0.0.1') ||
      url.includes('localhost')
    ) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Minimize to system tray instead of quitting so notifications & reminders keep running
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      syncIslandVisibility();
    }
  });

  mainWindow.on('show', () => syncIslandVisibility());
  mainWindow.on('hide', () => syncIslandVisibility());
  mainWindow.on('minimize', () => syncIslandVisibility());
  mainWindow.on('restore', () => syncIslandVisibility());
  mainWindow.on('focus', () => syncIslandVisibility());
  mainWindow.on('blur', () => syncIslandVisibility());

  if (appIcon) {
    tray = new Tray(appIcon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Zonein Pomodoro');
    updateTrayMenu();
    tray.on('double-click', () => {
      if (mainWindow?.isMinimized()) mainWindow.restore();
      mainWindow?.show();
      mainWindow?.focus();
    });
  }

  createTaskbarIsland();

  screen.on('display-metrics-changed', () => {
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.setBounds(computeIslandBounds());
    }
  });
}

app.whenReady().then(() => {
  registerStorageIpcHandlers();
  registerIslandIpcHandlers();
  void createWindow();
  app.on('activate', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.destroy();
  }
  if (staticServer) {
    staticServer.close();
  }
});
