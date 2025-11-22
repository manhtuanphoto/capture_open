import React from 'react';
import { Album } from '../types';
import { Folder, Plus, Minus, RefreshCw, Aperture } from 'lucide-react';

interface SidebarProps {
  albums: Album[];
  currentAlbumId: string | null;
  onSelectAlbum: (id: string) => void;
  onAddFolder: () => void;
  onRemoveFolder: (id: string) => void;
  onRefreshFolder?: (id: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  albums,
  currentAlbumId,
  onSelectAlbum,
  onAddFolder,
  onRemoveFolder,
  onRefreshFolder,
  className
}) => {
  return (
    <aside className={`w-64 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800/50 flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Folders</h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={onAddFolder}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
              title="Add Folder"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => onRemoveFolder(currentAlbumId!)}
              className={`p-1 text-gray-500 rounded transition-colors ${!currentAlbumId ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-500 hover:bg-gray-800'}`}
              title="Delete Current Folder"
              disabled={!currentAlbumId}
            >
              <Minus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">

          <nav className="space-y-1">
            {albums.map(album => (
              <div
                key={album.id}
                className={`group relative w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentAlbumId === album.id
                  ? 'bg-accent-600/20 text-accent-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <button
                  onClick={() => onSelectAlbum(album.id)}
                  className="flex-1 flex items-center space-x-3 text-left"
                >
                  <Folder size={16} className={currentAlbumId === album.id ? 'text-accent-500' : 'text-gray-500'} />
                  <span className="truncate">{album.name}</span>
                </button>

                {onRefreshFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshFolder(album.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-accent-500 hover:bg-gray-800 rounded transition-all"
                    title="Refresh folder"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div >
      </div >
    </aside >
  );
};