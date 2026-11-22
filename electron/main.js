import { app, BrowserWindow, ipcMain } from 'electron';
import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const forbiddenCommandPatterns = [
  /\brm(?:\.exe)?\s+(?=[^\n]*(?:-[^\s]*r[^\s]*f|-[^\s]*f[^\s]*r|--recursive))[^\n]*\s\/(?:\s|\*|$)/i,
  /\bformat(?:\.exe)?(?:\s|$)/i,
  /\bdel\s+\/[a-z]*f[a-z]*\s+\/[a-z]*s[a-z]*\s+\/[a-z]*q[a-z]*\s+(?:[a-z]:\\|%systemdrive%)/i,
  /\brmdir\s+\/s\s+\/q\s+(?:[a-z]:\\|%systemdrive%)/i,
  /\bmkfs\b/i,
  /\bfdisk\b/i,
  /\bparted\b/i,
  /\bdiskpart\b/i,
  /\bcipher\s+\/w\b/i,
  /\b(?:shutdown|reboot)\b/i,
  /\breg\s+delete\b/i,
];

const isForbiddenCommand = (command) => {
  const normalized = command.trim();
  return forbiddenCommandPatterns.some((pattern) => pattern.test(normalized));
};

const isNewerVersion = (latest, current) => {
  const latestParts = latest.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));
  const currentParts = current.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));
  const length = Math.max(latestParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const latestPart = latestParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }
  return false;
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (!app.isPackaged) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
};

ipcMain.handle('run-command', async (_event, payload) => {
  try {
    if (!payload || typeof payload.command !== 'string') {
      return { success: false, stdout: '', stderr: '', error: 'Komut belirtilmedi.' };
    }

    const command = payload.command.trim();
    if (!command) {
      return { success: false, stdout: '', stderr: '', error: 'Komut belirtilmedi.' };
    }

    if (isForbiddenCommand(command)) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: 'Bu komut güvenlik nedeniyle engellendi.',
      };
    }

    const cwd = typeof payload.cwd === 'string' && payload.cwd.trim()
      ? payload.cwd
      : process.cwd();

    return await new Promise((resolve) => {
      exec(command, { cwd, timeout: 120_000, shell: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error?.killed) {
          resolve({
            success: false,
            stdout: String(stdout),
            stderr: String(stderr),
            timedOut: true,
            error: 'Komut 120 saniye zaman aşımına uğradı ve sonlandırıldı.',
          });
          return;
        }

        if (error) {
          resolve({
            success: false,
            stdout: String(stdout),
            stderr: String(stderr),
            error: error.message,
          });
          return;
        }

        resolve({
          success: true,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? error.message : 'Komut çalıştırılamadı.',
    };
  }
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const response = await fetch('https://tre-ai-app.vercel.app/version.json', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Güncelleme bilgisi alınamadı (${response.status}).`);
    }

    const data = await response.json();
    if (!data || typeof data.version !== 'string') {
      throw new Error('Güncelleme bilgisi geçersiz.');
    }

    const currentVersion = app.getVersion();
    const updateAvailable = isNewerVersion(data.version, currentVersion);
    return {
      updateAvailable,
      currentVersion,
      latestVersion: data.version,
      downloadUrl: typeof data.downloadUrl === 'string'
        ? data.downloadUrl
        : 'https://github.com/Harikabey/tre-ai/releases/latest',
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Güncelleme kontrol edilemedi');
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
