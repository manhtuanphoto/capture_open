import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import sharp from 'sharp';
import fs from 'fs-extra';
import { Store } from './store.js';
import { ThumbnailServer } from './thumbnail-server.js';
import { DatabaseManager } from './database.js';
import { SidecarManager } from './sidecar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null;
let watcher: any | null = null;
const store = new Store();

// Initialize new systems
const thumbnailServer = new ThumbnailServer();
const dbManager = new DatabaseManager();
const sidecarManagers = new Map<string, SidecarManager>();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        backgroundColor: '#030712',
    });

    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(async () => {
    try {
        const port = await thumbnailServer.start();
        console.log(`Thumbnail server running on port ${port}`);
    } catch (error) {
        console.error('Failed to start thumbnail server:', error);
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    thumbnailServer.stop();
    dbManager.close();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers ---

ipcMain.handle('get-thumbnail-server-url', () => {
    return thumbnailServer.getUrl();
});

ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('get-projects', () => {
    return store.getProjects();
});

ipcMain.handle('add-project', (event, folderPath) => {
    return store.addProject(folderPath);
});

ipcMain.handle('remove-project', (event, id) => {
    store.removeProject(id);
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow?.close());

ipcMain.handle('start-watching', async (event, folderPath) => {
    if (watcher) {
        await watcher.close();
    }

    console.log(`Starting watch on: ${folderPath}`);

    const projectId = folderPath.replace(/[\\/:]/g, '_');
    let sidecarManager = sidecarManagers.get(projectId);

    if (!sidecarManager) {
        sidecarManager = new SidecarManager(folderPath);
        await sidecarManager.initialize();
        sidecarManagers.set(projectId, sidecarManager);
        thumbnailServer.registerSidecarManager(projectId, sidecarManager);
    }

    // Ensure project exists in database
    const projectName = path.basename(folderPath);
    dbManager.upsertProject(projectId, projectName, folderPath);

    // 1. Return cached images immediately
    const cachedImages = dbManager.getImagesByProject(projectId).map(img => ({
        id: img.id,
        name: img.file_name,
        path: img.file_path,
        thumbnail: `${thumbnailServer.getUrl()}/thumb/${projectId}/${encodeURIComponent(img.file_name)}`,
        standardPreview: `${thumbnailServer.getUrl()}/standard/${projectId}/${encodeURIComponent(img.file_name)}`,
        fullPreview: `${thumbnailServer.getUrl()}/full/${projectId}/${encodeURIComponent(img.file_name)}`,
        url: `${thumbnailServer.getUrl()}/preview/${projectId}/${encodeURIComponent(img.file_name)}`,
        width: img.width,
        height: img.height,
        rating: img.rating,
        tags: []
    }));

    // 2. Background diff for new/removed files
    setImmediate(async () => {
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));

        // Determine new files
        const existingSet = new Set(cachedImages.map(i => i.name));
        const newFiles = imageFiles.filter(f => !existingSet.has(f));

        // Process new files in batches
        const batchSize = 10;
        for (let i = 0; i < newFiles.length; i += batchSize) {
            const batch = newFiles.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(file => processImageWithSidecar(folderPath, file, projectId, sidecarManager!))
            );
            batchResults.forEach(imgData => {
                mainWindow?.webContents.send('file-added', imgData);
            });
        }

        // Detect deleted files
        const dbNames = new Set(cachedImages.map(i => i.name));
        const deletedFiles = [...dbNames].filter(name => !imageFiles.includes(name));
        for (const delName of deletedFiles) {
            // Remove from DB
            dbManager.db.prepare('DELETE FROM images WHERE file_name = ? AND project_id = ?').run(delName, projectId);
            // Notify renderer
            mainWindow?.webContents.send('file-removed', { name: delName, projectId });
        }
    });

    // Watch for future additions
    watcher = chokidar.watch(folderPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        depth: 0
    });

    watcher.on('add', async (filePath: string) => {
        const fileName = path.basename(filePath);
        if (/\.(jpg|jpeg|png|webp|avif)$/i.test(fileName)) {
            console.log(`File added: ${fileName}`);
            const imageData = await processImageWithSidecar(folderPath, fileName, projectId, sidecarManager!);
            mainWindow?.webContents.send('file-added', imageData);
        }
    });

    // Return cached images immediately to renderer
    return cachedImages;
});

async function processImageWithSidecar(
    folderPath: string,
    fileName: string,
    projectId: string,
    sidecarManager: SidecarManager
) {
    const fullPath = path.join(folderPath, fileName);
    const serverUrl = thumbnailServer.getUrl();

    try {
        // PRIORITY 1: Generate thumbnail only (fast!)
        await sidecarManager.generateThumbnail(fullPath, fileName);

        const metadata = await sharp(fullPath).metadata();
        const existingMeta = await sidecarManager.loadMetadata(fileName);

        const imageData = {
            id: fullPath,
            name: fileName,
            path: fullPath,
            thumbnail: `${serverUrl}/thumb/${projectId}/${encodeURIComponent(fileName)}`,
            standardPreview: `${serverUrl}/standard/${projectId}/${encodeURIComponent(fileName)}`,
            fullPreview: `${serverUrl}/full/${projectId}/${encodeURIComponent(fileName)}`,
            url: `${serverUrl}/preview/${projectId}/${encodeURIComponent(fileName)}`, // Fallback
            width: metadata.width || 0,
            height: metadata.height || 0,
            rating: existingMeta?.rating || 0,
            tags: existingMeta?.tags || [],
            date: new Date((await fs.stat(fullPath)).mtimeMs).toISOString()
        };

        dbManager.upsertImage({
            id: fullPath,
            project_id: projectId,
            file_path: fullPath,
            file_name: fileName,
            file_size: (await fs.stat(fullPath)).size,
            width: metadata.width || 0,
            height: metadata.height || 0,
            created_at: (await fs.stat(fullPath)).birthtimeMs,
            modified_at: (await fs.stat(fullPath)).mtimeMs,
            rating: existingMeta?.rating || 0
        });

        // LAZY: Generate previews in background (non-blocking)
        setImmediate(async () => {
            try {
                await sidecarManager.generateStandardPreview(fullPath, fileName);
                const fullPreviewPath = await sidecarManager.generateFullSizePreview(fullPath, fileName);
                console.log(`Generated previews for ${fileName}`);
            } catch (err) {
                console.warn(`Failed to generate previews for ${fileName}:`, err);
            }
        });

        return imageData;
    } catch (error) {
        console.error(`Failed to process image ${fileName}:`, error);

        return {
            id: fullPath,
            name: fileName,
            path: fullPath,
            thumbnail: `file:///${fullPath.replace(/\\/g, '/')}`,
            url: `file:///${fullPath.replace(/\\/g, '/')}`,
            width: 0,
            height: 0,
            rating: 0,
            tags: [],
            date: new Date().toISOString()
        };
    }
}
