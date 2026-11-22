import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  runCommand: (command, cwd) => ipcRenderer.invoke('run-command', { command, cwd }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});
