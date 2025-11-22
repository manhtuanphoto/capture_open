import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';

export interface Project {
    id: string;
    name: string;
    path: string;
    createdAt: string;
}

export class Store {
    private path: string;
    private data: { projects: Project[] };

    constructor() {
        this.path = path.join(app.getPath('userData'), 'projects.json');
        this.data = { projects: [] };
        this.init();
    }

    private init() {
        try {
            if (fs.existsSync(this.path)) {
                this.data = fs.readJSONSync(this.path);
            } else {
                fs.writeJSONSync(this.path, this.data);
            }
        } catch (error) {
            console.error('Error initializing store:', error);
        }
    }

    public getProjects(): Project[] {
        return this.data.projects;
    }

    public addProject(projectPath: string): Project {
        const name = path.basename(projectPath);
        const id = `proj-${Date.now()}`;
        const newProject: Project = {
            id,
            name,
            path: projectPath,
            createdAt: new Date().toISOString()
        };

        this.data.projects.push(newProject);
        this.save();
        return newProject;
    }

    public removeProject(id: string): void {
        this.data.projects = this.data.projects.filter(p => p.id !== id);
        this.save();
    }

    private save() {
        try {
            fs.writeJSONSync(this.path, this.data);
        } catch (error) {
            console.error('Error saving store:', error);
        }
    }
}
