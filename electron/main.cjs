const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let tray = null;
let staticServer = null;
let isQuitting = false;

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
  return new Promise((resolve) => {
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
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
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
          label: 'Quit',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ])
    );
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  }
}

app.whenReady().then(() => {
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
  if (staticServer) {
    staticServer.close();
  }
});
