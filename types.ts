import { ReactNode } from 'react';

export interface Photo {
  id: string;
  url: string;
  thumbnail?: string;
  standardPreview?: string;  // 1600px medium quality
  fullPreview?: string;      // Full-size high quality
  isLoadingFullPreview?: boolean;
  name: string;
  width?: number;
  height?: number;
  date: string;
  tags: string[];
  category?: string;
  path?: string;
}

export interface Album {
  id: string;
  name: string;
  icon: ReactNode;
  filter: (photo: Photo) => boolean;
  path?: string;
}

export enum AppView {
  GRID = 'GRID',
  EDITOR = 'EDITOR'
}

export interface PhotoGridProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  className?: string;
}

export enum Tool {
  NONE = 'none',
  ADJUST = 'adjust',
  CROP = 'crop',
  AI_EDIT = 'ai_edit'
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

declare global {
  interface Window {
    electron?: {
      selectFolder: () => Promise<string | null>;
      startWatching: (path: string) => Promise<Photo[]>;
      onFileAdded: (callback: (file: Photo) => void) => () => void;
      onFileRemoved: (callback: (file: { name: string, projectId: string }) => void) => () => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      getProjects: () => Promise<Project[]>;
      addProject: (path: string) => Promise<Project>;
      removeProject: (id: string) => Promise<void>;
      getThumbnailServerUrl: () => Promise<string>;
    };
  }
}