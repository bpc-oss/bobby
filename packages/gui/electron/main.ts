import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { KernelHost } from '@bobby/kernel';

const host = new KernelHost(() => {
  throw new Error('未配置 DeepSeek Key（见设置/首启向导）');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
};

const bootstrap = () => {
  host.subscribe((event) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('kernel:event', event);
  });

  ipcMain.handle('kernel:command', async (_event, cmd) => {
    await host.send(cmd);
  });
};

app.whenReady().then(() => {
  bootstrap();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
