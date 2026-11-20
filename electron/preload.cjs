const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStorage', {
  isElectron: true,
  saveData: (data) => ipcRenderer.invoke('zonein-storage:save', data),
  loadData: () => ipcRenderer.invoke('zonein-storage:load'),
  getAppDataPath: () => ipcRenderer.invoke('zonein-storage:path'),
});

contextBridge.exposeInMainWorld('electronIsland', {
  sendTimerState: (state) => ipcRenderer.send('zonein-island:update-state', state),
  onAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('zonein-island:action', handler);
    return () => ipcRenderer.removeListener('zonein-island:action', handler);
  },
  setVisible: (visible) => ipcRenderer.invoke('zonein-island:set-visible', visible),
  getVisible: () => ipcRenderer.invoke('zonein-island:get-visible'),
});
