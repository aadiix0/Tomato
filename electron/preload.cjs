const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStorage', {
  isElectron: true,
  saveData: (data) => ipcRenderer.invoke('zonein-storage:save', data),
  loadData: () => ipcRenderer.invoke('zonein-storage:load'),
  getAppDataPath: () => ipcRenderer.invoke('zonein-storage:path'),
});
