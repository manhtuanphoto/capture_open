import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs-extra';

export interface ImageRecord {
    id: string;
    project_id: string;
    file_path: string;
    file_name: string;
    file_size: number;
    width: number;
    height: number;
    created_at: number;
    modified_at: number;
    rating: number;
    tags?: string[];
}

export class DatabaseManager {
    private db: Database.Database;
    private dbPath: string;
    private operationCount: number = 0;

    constructor() {
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'capture-open.db');

        // Ensure directory exists
        fs.ensureDirSync(path.dirname(this.dbPath));

        // Open database with optimized settings
        this.db = new Database(this.dbPath, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
        });

        // SPEED OPTIMIZATIONS (local app, no security needed)
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = OFF');        // UNSAFE but FAST
        this.db.pragma('cache_size = -128000');     // 128MB cache
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 30000000000');  // 30GB mmap
        this.db.pragma('page_size = 4096');
        this.db.pragma('locking_mode = EXCLUSIVE'); // Faster for single app
        this.db.pragma('foreign_keys = OFF');       // Disable FK checks for speed

        this.initialize();
    }

    private initialize(): void {
        // Create tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT UNIQUE NOT NULL,
                created_at INTEGER NOT NULL,
                last_opened INTEGER NOT NULL,
                cache_size INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS images (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                width INTEGER DEFAULT 0,
                height INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                modified_at INTEGER NOT NULL,
                rating INTEGER DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3b82f6'
            );

            CREATE TABLE IF NOT EXISTS image_tags (
                image_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (image_id, tag_id),
                FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);
            CREATE INDEX IF NOT EXISTS idx_images_rating ON images(rating);
            CREATE INDEX IF NOT EXISTS idx_images_modified ON images(modified_at);
            CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id);
            CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id);

            -- Full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
                file_name,
                tags,
                content='images',
                content_rowid='rowid'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS images_fts_insert AFTER INSERT ON images BEGIN
                INSERT INTO images_fts(rowid, file_name, tags)
                VALUES (new.rowid, new.file_name, '');
            END;

            CREATE TRIGGER IF NOT EXISTS images_fts_delete AFTER DELETE ON images BEGIN
                DELETE FROM images_fts WHERE rowid = old.rowid;
            END;

            CREATE TRIGGER IF NOT EXISTS images_fts_update AFTER UPDATE ON images BEGIN
                UPDATE images_fts SET file_name = new.file_name WHERE rowid = new.rowid;
            END;
        `);

        // Run initial optimization
        this.optimize();
    }

    // Auto-optimization after N operations
    private checkOptimization(): void {
        this.operationCount++;

        if (this.operationCount >= 100) {
            this.db.pragma('optimize');
            this.operationCount = 0;
        }
    }

    // Full optimization (run on startup and shutdown)
    optimize(): void {
        console.log('Optimizing database...');

        try {
            // Update statistics
            this.db.pragma('analyze');

            // Optimize query planner
            this.db.pragma('optimize');

            // WAL checkpoint
            this.db.pragma('wal_checkpoint(TRUNCATE)');

            console.log('Database optimization complete');
        } catch (error) {
            console.error('Database optimization failed:', error);
        }
    }

    // Vacuum database (compact and defragment)
    vacuum(): void {
        console.log('Vacuuming database...');

        try {
            this.db.exec('VACUUM');
            console.log('Database vacuum complete');
        } catch (error) {
            console.error('Database vacuum failed:', error);
        }
    }

    // Upsert project
    upsertProject(id: string, name: string, path: string): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO projects (id, name, path, created_at, last_opened)
            VALUES (?, ?, ?, COALESCE((SELECT created_at FROM projects WHERE id = ?), ?), ?)
        `);

        const now = Date.now();
        stmt.run(id, name, path, id, now, now);
    }

    // Upsert image with conflict resolution
    upsertImage(image: ImageRecord): void {
        const stmt = this.db.prepare(`
            INSERT INTO images (
                id, project_id, file_path, file_name, file_size,
                width, height, created_at, modified_at, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                file_size = excluded.file_size,
                width = excluded.width,
                height = excluded.height,
                modified_at = excluded.modified_at,
                rating = CASE 
                    WHEN excluded.modified_at > modified_at THEN excluded.rating
                    ELSE rating
                END
            WHERE excluded.modified_at > modified_at
        `);

        stmt.run(
            image.id,
            image.project_id,
            image.file_path,
            image.file_name,
            image.file_size,
            image.width,
            image.height,
            image.created_at,
            image.modified_at,
            image.rating
        );

        this.checkOptimization();
    }

    // Batch upsert for better performance
    upsertImagesBatch(images: ImageRecord[]): void {
        const stmt = this.db.prepare(`
            INSERT INTO images (
                id, project_id, file_path, file_name, file_size,
                width, height, created_at, modified_at, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                file_size = excluded.file_size,
                width = excluded.width,
                height = excluded.height,
                modified_at = excluded.modified_at
            WHERE excluded.modified_at > modified_at
        `);

        const transaction = this.db.transaction((images: ImageRecord[]) => {
            for (const image of images) {
                stmt.run(
                    image.id,
                    image.project_id,
                    image.file_path,
                    image.file_name,
                    image.file_size,
                    image.width,
                    image.height,
                    image.created_at,
                    image.modified_at,
                    image.rating
                );
            }
        });

        transaction(images);
        this.checkOptimization();
    }

    // Get images by project
    getImagesByProject(projectId: string): ImageRecord[] {
        const stmt = this.db.prepare(`
            SELECT * FROM images 
            WHERE project_id = ? 
            ORDER BY modified_at DESC
        `);

        return stmt.all(projectId) as ImageRecord[];
    }

    // Full-text search
    searchImages(query: string, projectId?: string): ImageRecord[] {
        let sql = `
            SELECT i.* FROM images i
            JOIN images_fts fts ON i.rowid = fts.rowid
            WHERE images_fts MATCH ?
        `;

        const params: any[] = [query];

        if (projectId) {
            sql += ' AND i.project_id = ?';
            params.push(projectId);
        }

        sql += ' ORDER BY rank';

        const stmt = this.db.prepare(sql);
        return stmt.all(...params) as ImageRecord[];
    }

    // Cleanup orphaned records
    cleanupOrphaned(): number {
        const stmt = this.db.prepare(`
            DELETE FROM images 
            WHERE id NOT IN (
                SELECT DISTINCT image_id FROM image_tags
            ) AND rating = 0
            AND modified_at < ?
        `);

        // Delete untagged, unrated images older than 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const result = stmt.run(thirtyDaysAgo);

        return result.changes;
    }

    // Get database statistics
    getStats(): any {
        const stats = this.db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM projects) as project_count,
                (SELECT COUNT(*) FROM images) as image_count,
                (SELECT COUNT(*) FROM tags) as tag_count,
                (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size
        `).get();

        return stats;
    }

    // Close database properly
    close(): void {
        console.log('Closing database...');

        // Final optimization
        this.optimize();

        // Vacuum if needed (based on fragmentation)
        const stats: any = this.db.pragma('freelist_count');
        if (stats > 1000) {
            this.vacuum();
        }

        this.db.close();
    }
}
