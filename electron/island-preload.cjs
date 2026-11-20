const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islandBridge', {
  onStateUpdate: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('zonein-island:state', handler);
    return () => ipcRenderer.removeListener('zonein-island:state', handler);
  },
  onConfigUpdate: (callback) => {
    const handler = (_event, config) => callback(config);
    ipcRenderer.on('zonein-island:config', handler);
    return () => ipcRenderer.removeListener('zonein-island:config', handler);
  },
  sendAction: (action) => {
    ipcRenderer.send('zonein-island:action', action);
  },
  moveBy: (deltaX) => {
    ipcRenderer.send('zonein-island:move-by', deltaX);
  },
  resizeBy: (deltaX, side) => {
    ipcRenderer.send('zonein-island:resize-by', { deltaX, side });
  },
  savePosition: () => {
    ipcRenderer.send('zonein-island:save-pos');
  },
  saveLayout: () => {
    ipcRenderer.send('zonein-island:save-pos');
  },
  showContextMenu: () => {
    ipcRenderer.send('zonein-island:context-menu');
  },
});
