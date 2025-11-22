import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';

export interface SidecarPaths {
    root: string;
    thumbnails: string;
    previews: string;
    metadata: string;
}

export class SidecarManager {
    private folderPath: string;
    private sidecarRoot: string;
    public paths: SidecarPaths;

    constructor(folderPath: string) {
        this.folderPath = folderPath;
        this.sidecarRoot = path.join(folderPath, '.capture-open');

        this.paths = {
            root: this.sidecarRoot,
            thumbnails: path.join(this.sidecarRoot, 'thumbnails'),
            previews: path.join(this.sidecarRoot, 'previews'),
            metadata: path.join(this.sidecarRoot, 'metadata')
        };
    }

    async initialize(): Promise<void> {
        await fs.ensureDir(this.paths.thumbnails);
        await fs.ensureDir(this.paths.previews);
        await fs.ensureDir(this.paths.metadata);

        // Set hidden attribute on Windows
        if (process.platform === 'win32') {
            try {
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
                await execAsync(`attrib +h "${this.sidecarRoot}"`);
            } catch (err) {
                console.warn('Could not set hidden attribute:', err);
            }
        }

        const gitignorePath = path.join(this.sidecarRoot, '.gitignore');
        if (!await fs.pathExists(gitignorePath)) {
            await fs.writeFile(gitignorePath, 'thumbnails/\npreviews/\n');
        }
    }

    getThumbnailPath(imageName: string): string {
        return path.join(this.paths.thumbnails, `${imageName}.thumb.webp`);
    }

    getPreviewPath(imageName: string): string {
        return path.join(this.paths.previews, `${imageName}.preview.jpg`);
    }

    getStandardPreviewPath(imageName: string): string {
        return path.join(this.paths.previews, `${imageName}.standard.jpg`);
    }

    getFullSizePreviewPath(imageName: string): string {
        return path.join(this.paths.previews, `${imageName}.full.jpg`);
    }

    getMetadataPath(imageName: string): string {
        return path.join(this.paths.metadata, `${imageName}.json`);
    }

    // Priority 1: Thumbnail (low quality, fast)
    async generateThumbnail(imagePath: string, imageName: string): Promise<string> {
        const thumbPath = this.getThumbnailPath(imageName);

        if (await fs.pathExists(thumbPath)) {
            const imageStat = await fs.stat(imagePath);
            const thumbStat = await fs.stat(thumbPath);
            if (thumbStat.mtime >= imageStat.mtime) {
                return thumbPath;
            }
        }

        await sharp(imagePath)
            .resize(256, 256, {
                fit: 'cover',
                position: 'centre'
            })
            .webp({
                quality: 75,
                effort: 4
            })
            .toFile(thumbPath);

        return thumbPath;
    }

    // Priority 2: Standard Preview (1600px, medium quality)
    async generateStandardPreview(imagePath: string, imageName: string): Promise<string> {
        const previewPath = this.getStandardPreviewPath(imageName);

        if (await fs.pathExists(previewPath)) {
            const imageStat = await fs.stat(imagePath);
            const previewStat = await fs.stat(previewPath);
            if (previewStat.mtime >= imageStat.mtime) {
                return previewPath;
            }
        }

        // Get original image dimensions
        const metadata = await sharp(imagePath).metadata();
        const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);

        // If original is smaller than 1600px, use higher quality
        const quality = maxDimension <= 1600 ? 92 : 80;

        await sharp(imagePath)
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({
                quality,
                progressive: true,
                mozjpeg: true
            })
            .toFile(previewPath);

        return previewPath;
    }

    // Priority 3: Full-size Preview (high quality) - Only if original > 1600px
    async generateFullSizePreview(imagePath: string, imageName: string): Promise<string | null> {
        // Check if original image is larger than 1600px
        const metadata = await sharp(imagePath).metadata();
        const maxDimension = Math.max(metadata.width || 0, metadata.height || 0);

        // If image is small, standard preview IS the full-size preview
        if (maxDimension <= 1600) {
            return null; // Signal that standard preview should be used
        }

        const previewPath = this.getFullSizePreviewPath(imageName);

        if (await fs.pathExists(previewPath)) {
            const imageStat = await fs.stat(imagePath);
            const previewStat = await fs.stat(previewPath);
            if (previewStat.mtime >= imageStat.mtime) {
                return previewPath;
            }
        }

        await sharp(imagePath)
            .jpeg({
                quality: 92,
                progressive: true,
                mozjpeg: true
            })
            .toFile(previewPath);

        return previewPath;
    }

    async saveMetadata(imageName: string, metadata: any): Promise<void> {
        const metadataPath = this.getMetadataPath(imageName);
        await fs.writeJSON(metadataPath, metadata, { spaces: 2 });
    }

    async loadMetadata(imageName: string): Promise<any | null> {
        const metadataPath = this.getMetadataPath(imageName);
        if (await fs.pathExists(metadataPath)) {
            return await fs.readJSON(metadataPath);
        }
        return null;
    }

    async cleanupOrphaned(): Promise<number> {
        let cleanedCount = 0;
        const imageFiles = await fs.readdir(this.folderPath);
        const imageSet = new Set(imageFiles);

        const thumbs = await fs.readdir(this.paths.thumbnails);
        for (const thumb of thumbs) {
            const originalName = thumb.replace('.thumb.webp', '');
            if (!imageSet.has(originalName)) {
                await fs.remove(path.join(this.paths.thumbnails, thumb));
                cleanedCount++;
            }
        }

        const previews = await fs.readdir(this.paths.previews);
        for (const preview of previews) {
            const originalName = preview
                .replace('.standard.jpg', '')
                .replace('.full.jpg', '')
                .replace('.preview.jpg', '');
            if (!imageSet.has(originalName)) {
                await fs.remove(path.join(this.paths.previews, preview));
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    async cleanup(options: { keepMetadata?: boolean } = {}): Promise<void> {
        if (options.keepMetadata) {
            await fs.remove(this.paths.thumbnails);
            await fs.remove(this.paths.previews);
            await fs.ensureDir(this.paths.thumbnails);
            await fs.ensureDir(this.paths.previews);
        } else {
            await fs.remove(this.sidecarRoot);
        }
    }

    async getCacheSize(): Promise<number> {
        let totalSize = 0;

        const countSize = async (dir: string) => {
            if (!await fs.pathExists(dir)) return;
            const files = await fs.readdir(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    totalSize += stat.size;
                }
            }
        };

        await countSize(this.paths.thumbnails);
        await countSize(this.paths.previews);

        return totalSize;
    }
}
