const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islandBridge', {
  onStateUpdate: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('zonein-island:state', handler);
    return () => ipcRenderer.removeListener('zonein-island:state', handler);
  },
  sendAction: (action) => {
    ipcRenderer.send('zonein-island:action', action);
  },
  moveBy: (deltaX) => {
    ipcRenderer.send('zonein-island:move-by', deltaX);
  },
  savePosition: () => {
    ipcRenderer.send('zonein-island:save-pos');
  },
});
