const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    startWatching: (path) => ipcRenderer.invoke('start-watching', path),
    onFileAdded: (callback) => {
        const subscription = (_event, file) => callback(file);
        ipcRenderer.on('file-added', subscription);
        return () => {
            ipcRenderer.removeListener('file-added', subscription);
        };
    },
    onFileRemoved: (callback) => {
        const subscription = (_event, file) => callback(file);
        ipcRenderer.on('file-removed', subscription);
        return () => {
            ipcRenderer.removeListener('file-removed', subscription);
        };
    },
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    addProject: (path) => ipcRenderer.invoke('add-project', path),
    removeProject: (id) => ipcRenderer.invoke('remove-project', id),
    getThumbnailServerUrl: () => ipcRenderer.invoke('get-thumbnail-server-url')
});
