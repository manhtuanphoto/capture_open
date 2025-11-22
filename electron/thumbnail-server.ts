import express from 'express';
import { Server } from 'http';
import path from 'path';
import fs from 'fs-extra';

export class ThumbnailServer {
    private app: express.Application;
    private server: Server | null = null;
    private port: number = 0;
    private sidecarManagers: Map<string, any> = new Map();

    constructor() {
        this.app = express();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', port: this.port });
        });

        // Serve thumbnail
        this.app.get('/thumb/:projectId/:filename', async (req, res) => {
            try {
                const { projectId, filename } = req.params;
                const manager = this.sidecarManagers.get(projectId);

                if (!manager) {
                    return res.status(404).send('Project not found');
                }

                const thumbPath = manager.getThumbnailPath(filename);

                if (!await fs.pathExists(thumbPath)) {
                    return res.status(404).send('Thumbnail not found');
                }

                // Set cache headers
                res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
                res.setHeader('Content-Type', 'image/jpeg');

                // Stream the file
                const stream = fs.createReadStream(thumbPath);
                stream.pipe(res);
            } catch (error) {
                console.error('Error serving thumbnail:', error);
                res.status(500).send('Internal server error');
            }
        });

        // Serve preview
        this.app.get('/preview/:projectId/:filename', async (req, res) => {
            try {
                const { projectId, filename } = req.params;
                const manager = this.sidecarManagers.get(projectId);

                if (!manager) {
                    return res.status(404).send('Project not found');
                }

                const previewPath = manager.getPreviewPath(filename);

                if (!await fs.pathExists(previewPath)) {
                    return res.status(404).send('Preview not found');
                }

                res.setHeader('Cache-Control', 'public, max-age=31536000');
                res.setHeader('Content-Type', 'image/jpeg');

                const stream = fs.createReadStream(previewPath);
                stream.pipe(res);
            } catch (error) {
                console.error('Error serving preview:', error);
                res.status(500).send('Internal server error');
            }
        });

        // Serve standard preview (1600px)
        this.app.get('/standard/:projectId/:filename', async (req, res) => {
            try {
                const { projectId, filename } = req.params;
                const manager = this.sidecarManagers.get(projectId);

                if (!manager) {
                    return res.status(404).send('Project not found');
                }

                const standardPath = manager.getStandardPreviewPath(filename);

                if (!await fs.pathExists(standardPath)) {
                    return res.status(404).send('Standard preview not found');
                }

                res.setHeader('Cache-Control', 'public, max-age=31536000');
                res.setHeader('Content-Type', 'image/jpeg');

                const stream = fs.createReadStream(standardPath);
                stream.pipe(res);
            } catch (error) {
                console.error('Error serving standard preview:', error);
                res.status(500).send('Internal server error');
            }
        });

        // Serve full-size preview
        this.app.get('/full/:projectId/:filename', async (req, res) => {
            try {
                const { projectId, filename } = req.params;
                const manager = this.sidecarManagers.get(projectId);

                if (!manager) {
                    return res.status(404).send('Project not found');
                }

                const fullPath = manager.getFullSizePreviewPath(filename);

                if (!await fs.pathExists(fullPath)) {
                    // Fallback to standard if full doesn't exist (small images)
                    const standardPath = manager.getStandardPreviewPath(filename);
                    if (await fs.pathExists(standardPath)) {
                        res.setHeader('Cache-Control', 'public, max-age=31536000');
                        res.setHeader('Content-Type', 'image/jpeg');
                        const stream = fs.createReadStream(standardPath);
                        return stream.pipe(res);
                    }
                    return res.status(404).send('Full preview not found');
                }

                res.setHeader('Cache-Control', 'public, max-age=31536000');
                res.setHeader('Content-Type', 'image/jpeg');

                const stream = fs.createReadStream(fullPath);
                stream.pipe(res);
            } catch (error) {
                console.error('Error serving full preview:', error);
                res.status(500).send('Internal server error');
            }
        });
    }

    registerSidecarManager(projectId: string, manager: any): void {
        this.sidecarManagers.set(projectId, manager);
    }

    unregisterSidecarManager(projectId: string): void {
        this.sidecarManagers.delete(projectId);
    }

    async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            // Try to find an available port starting from 45678
            const tryPort = (port: number) => {
                this.server = this.app.listen(port)
                    .on('listening', () => {
                        this.port = port;
                        console.log(`Thumbnail server started on port ${port}`);
                        resolve(port);
                    })
                    .on('error', (err: any) => {
                        if (err.code === 'EADDRINUSE') {
                            // Port in use, try next one
                            tryPort(port + 1);
                        } else {
                            reject(err);
                        }
                    });
            };

            tryPort(45678);
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            console.log('Thumbnail server stopped');
        }
    }

    getPort(): number {
        return this.port;
    }

    getUrl(): string {
        return `http://localhost:${this.port}`;
    }
}
