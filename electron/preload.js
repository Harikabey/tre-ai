import electron from 'electron';

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('electronAPI', {
  runCommand: (command, cwd) => ipcRenderer.invoke('run-command', { command, cwd }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
});
