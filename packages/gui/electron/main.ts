import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain } from 'electron';
import { KernelHost, makeDeepSeekClientFromBobbyConfig } from '@bobby/kernel';
import { initAutoUpdate } from './updater';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pendingHost: Promise<KernelHost | null> | null = null;
let hostInitError: Error | null = null;

let mainWindow: BrowserWindow | null = null;

const notifySystem = (message: string) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('kernel:event', {
    type: 'error',
    taskId: 'system',
    message
  });
};

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

const createHost = async () => {
  try {
    const model = await makeDeepSeekClientFromBobbyConfig();
    return new KernelHost(() => model);
  } catch (err) {
    if (err instanceof Error) {
      hostInitError = err;
    } else {
      hostInitError = new Error('Kernel 启动失败');
    }
    return null;
  }
};

const bootstrap = async () => {
  const runtimeHost = await (pendingHost ?? (pendingHost = createHost()));
  if (!runtimeHost) {
    return;
  }

  runtimeHost.subscribe((event) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('kernel:event', event);
  });
};

ipcMain.handle('kernel:command', async (_event, cmd) => {
  const currentHost = await (pendingHost ?? (pendingHost = createHost()));
  if (!currentHost) {
    throw hostInitError ?? new Error('Kernel 主机未就绪，请先完成配置');
  }
  await currentHost.send(cmd);
});

app.whenReady().then(() => {
  createWindow();
  void bootstrap();
  void initAutoUpdate(notifySystem);

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
