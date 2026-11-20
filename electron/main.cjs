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

const ISLAND_WIDTH = 210;
const ISLAND_HEIGHT = 44;
const DEFAULT_TRAY_RIGHT_OFFSET = 225;

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

function loadIslandConfig() {
  try {
    const cfgPath = getIslandConfigPath();
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return {
        visible: parsed.visible !== false,
        customX: typeof parsed.customX === 'number' ? parsed.customX : null,
      };
    }
  } catch {
    // ignore malformed config
  }
  return { visible: true, customX: null };
}

function saveIslandConfig(config) {
  try {
    fs.writeFileSync(getIslandConfigPath(), JSON.stringify(config), 'utf-8');
  } catch {
    // ignore write error
  }
}

let islandConfig = { visible: true, customX: null };

function computeIslandBounds() {
  const display = screen.getPrimaryDisplay();
  const { bounds, workArea } = display;
  const taskbarHeight = Math.max(40, bounds.height - workArea.height);
  const y = bounds.y + bounds.height - Math.round((taskbarHeight + ISLAND_HEIGHT) / 2);
  const defaultX = bounds.x + bounds.width - ISLAND_WIDTH - DEFAULT_TRAY_RIGHT_OFFSET;
  const rawX = typeof islandConfig.customX === 'number' ? islandConfig.customX : defaultX;
  const minX = bounds.x + 8;
  const maxX = bounds.x + bounds.width - ISLAND_WIDTH - 8;
  const x = Math.max(minX, Math.min(maxX, Math.round(rawX)));
  return { x, y, width: ISLAND_WIDTH, height: ISLAND_HEIGHT };
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

  islandWindow.once('ready-to-show', () => {
    if (islandConfig.visible && islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.showInactive();
      if (lastIslandState) {
        islandWindow.webContents.send('zonein-island:state', lastIslandState);
      }
    }
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
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Show Taskbar Dynamic Island',
        type: 'checkbox',
        checked: islandConfig.visible,
        click: (menuItem) => {
          islandConfig.visible = menuItem.checked;
          saveIslandConfig(islandConfig);
          if (islandWindow && !islandWindow.isDestroyed()) {
            if (islandConfig.visible) {
              islandWindow.showInactive();
            } else {
              islandWindow.hide();
            }
          }
        },
      },
      {
        label: 'Reset Island Position',
        click: () => {
          islandConfig.customX = null;
          saveIslandConfig(islandConfig);
          if (islandWindow && !islandWindow.isDestroyed()) {
            const b = computeIslandBounds();
            islandWindow.setBounds(b);
          }
        },
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
    lastIslandState = state;
    if (islandWindow && !islandWindow.isDestroyed()) {
      islandWindow.webContents.send('zonein-island:state', state);
    }
  });

  ipcMain.on('zonein-island:action', (_event, action) => {
    if (action === 'show-main') {
      if (mainWindow && !mainWindow.isDestroyed()) {
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
    if (!islandWindow || islandWindow.isDestroyed()) return;
    const display = screen.getPrimaryDisplay();
    const { bounds } = display;
    const current = islandWindow.getBounds();
    const minX = bounds.x + 8;
    const maxX = bounds.x + bounds.width - ISLAND_WIDTH - 8;
    const nextX = Math.max(minX, Math.min(maxX, Math.round(current.x + Number(deltaX || 0))));
    islandWindow.setBounds({ x: nextX, y: current.y, width: ISLAND_WIDTH, height: ISLAND_HEIGHT });
    islandConfig.customX = nextX;
  });

  ipcMain.on('zonein-island:save-pos', () => {
    saveIslandConfig(islandConfig);
  });

  ipcMain.handle('zonein-island:get-visible', () => islandConfig.visible);

  ipcMain.handle('zonein-island:set-visible', (_event, visible) => {
    islandConfig.visible = Boolean(visible);
    saveIslandConfig(islandConfig);
    if (islandWindow && !islandWindow.isDestroyed()) {
      if (islandConfig.visible) {
        islandWindow.showInactive();
      } else {
        islandWindow.hide();
      }
    }
    updateTrayMenu();
    return islandConfig.visible;
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
    }
  });

  if (appIcon) {
    tray = new Tray(appIcon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Zonein Pomodoro');
    updateTrayMenu();
    tray.on('double-click', () => {
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
