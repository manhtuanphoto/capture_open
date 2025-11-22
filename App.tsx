import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PhotoGrid } from './components/PhotoGrid';
import { Editor } from './components/Editor';
import { TitleBar } from './components/TitleBar';
import { Album, Photo, AppView } from './types';
import { Folder, Maximize2, Grid, Download, FolderOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
    const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const [view, setView] = useState<AppView>(AppView.GRID);
    const [currentPath, setCurrentPath] = useState<string | null>(null);

    const [albums, setAlbums] = useState<Album[]>([]);

    const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);

    const currentAlbum = albums.find(a => a.id === currentAlbumId);
    const filteredPhotos = allPhotos.filter(currentAlbum?.filter || (() => false));

    // Listen for new files
    useEffect(() => {
        if (window.electron && window.electron.onFileAdded) {
            const cleanup = window.electron.onFileAdded((newPhoto) => {
                setAllPhotos(prev => {
                    // Avoid duplicates
                    if (prev.some(p => p.name === newPhoto.name)) return prev;
                    return [...prev, newPhoto];
                });
            });
            return cleanup;
        }
    }, []);

    // Listen for removed files
    useEffect(() => {
        if (window.electron && window.electron.onFileRemoved) {
            const cleanup = window.electron.onFileRemoved((file: { name: string, projectId: string }) => {
                setAllPhotos(prev => prev.filter(p => p.name !== file.name));
            });
            return cleanup;
        }
    }, []);

    // Load projects on mount
    useEffect(() => {
        if (window.electron) {
            window.electron.getProjects().then(projects => {
                const loadedAlbums = projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    icon: <Folder size={16} />,
                    filter: (photo: Photo) => photo.path?.startsWith(p.path) || false,
                    path: p.path
                }));
                setAlbums(loadedAlbums);
            });
        }
    }, []);

    // Effect to switch watched folder when album changes
    useEffect(() => {
        const album = albums.find(a => a.id === currentAlbumId);
        if (album && album.path && window.electron) {
            setCurrentPath(album.path);
            setAllPhotos([]); // Clear current view
            window.electron.startWatching(album.path).then(photos => {
                setAllPhotos(photos);
            });
        } else if (!album && currentAlbumId === null) {
            // No album selected, clear photos and path
            setCurrentPath(null);
            setAllPhotos([]);
        }
    }, [currentAlbumId, albums]);

    const handleAddFolder = async () => {
        console.log('handleAddFolder called');
        console.log('window.electron:', window.electron);

        if (window.electron) {
            console.log('Calling selectFolder...');
            const path = await window.electron.selectFolder();
            console.log('Selected path:', path);

            if (path) {
                // Check if already exists
                if (albums.some(a => a.path === path)) {
                    alert("This folder is already added.");
                    return;
                }

                console.log('Adding project...');
                const project = await window.electron.addProject(path);
                console.log('Project added:', project);

                const newAlbum: Album = {
                    id: project.id,
                    name: project.name,
                    icon: <Folder size={16} />,
                    filter: (photo) => photo.path?.startsWith(path) || false,
                    path: project.path
                };

                setAlbums(prev => [...prev, newAlbum]);
                setCurrentAlbumId(project.id);
            }
        } else {
            console.error('window.electron is not available!');
            alert('Electron API not available. Running in browser mode?');
        }
    };

    const handlePhotoSelect = (photo: Photo) => {
        setSelectedPhoto(photo);
        setView(AppView.EDITOR);
    };

    const handleCloseEditor = () => {
        setSelectedPhoto(null);
        setView(AppView.GRID);
    };

    const handleOpenFocusMode = () => {
        if (filteredPhotos.length > 0) {
            if (!selectedPhoto) {
                setSelectedPhoto(filteredPhotos[0]);
            }
            setView(AppView.EDITOR);
        }
    };

    const handleRemoveFolder = async (id: string) => {
        if (confirm("Are you sure you want to remove this folder from the list?")) {
            if (window.electron) {
                await window.electron.removeProject(id);
                setAlbums(prev => prev.filter(album => album.id !== id));
                if (currentAlbumId === id) {
                    setCurrentAlbumId(null);
                }
            }
        }
    };

    const handleRefreshFolder = async (id: string) => {
        const album = albums.find(a => a.id === id);
        if (album && album.path && window.electron) {
            console.log('Refreshing folder:', album.path);
            // Re-watch the folder to reload images
            const newPhotos = await window.electron.startWatching(album.path);
            setAllPhotos(prev => {
                // Remove old photos from this folder and add new ones
                const filtered = prev.filter(p => !p.path?.startsWith(album.path!));
                return [...filtered, ...newPhotos];
            });
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-gray-950 text-gray-100 font-sans overflow-hidden">
            <TitleBar />

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <Sidebar
                    albums={albums}
                    currentAlbumId={currentAlbumId}
                    onSelectAlbum={setCurrentAlbumId}
                    onAddFolder={handleAddFolder}
                    onRemoveFolder={handleRemoveFolder}
                    onRefreshFolder={handleRefreshFolder}
                    className="hidden md:flex"
                />

                {/* Main Content */}
                <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* Mobile Header */}
                    <div className="md:hidden h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between">
                        <span className="font-bold text-lg text-white">CAPTURE OPEN</span>

                    </div>

                    {/* Desktop Header / Toolbar */}
                    <header className="h-14 bg-gray-900/50 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 z-10 flex-shrink-0">
                        <div className="flex items-center space-x-4 min-h-[56px]">
                            <h1 className="font-semibold text-lg text-white truncate max-w-md" title={currentPath || 'No Folder Selected'}>
                                {view === AppView.EDITOR && selectedPhoto ? selectedPhoto.name : (currentAlbum?.name || 'Select a Folder')}
                            </h1>

                        </div>

                        {/* View Switcher (Grid vs Focus) - Absolute Right */}
                        <div className="absolute right-6 flex items-center bg-gray-800/50 rounded-lg p-1 border border-gray-700/50">
                            <button
                                onClick={() => setView(AppView.GRID)}
                                className={`p-1.5 rounded-md transition-all duration-200 ${view === AppView.GRID ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                                title="Grid View"
                            >
                                <Grid size={18} />
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedPhoto) {
                                        setView(AppView.EDITOR);
                                    } else if (filteredPhotos.length > 0) {
                                        handlePhotoSelect(filteredPhotos[0]);
                                    }
                                }}
                                className={`p-1.5 rounded-md transition-all duration-200 ${view === AppView.EDITOR ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                                title="Focus View"
                            >
                                <Maximize2 size={18} />
                            </button>
                        </div>
                    </header>

                    {/* Content Area with AnimatePresence */}
                    <div className="flex-1 overflow-hidden relative bg-gray-950">
                        <AnimatePresence mode="wait">
                            {view === AppView.GRID ? (
                                <motion.div
                                    key="grid"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full w-full"
                                >
                                    <PhotoGrid
                                        photos={filteredPhotos}
                                        onSelect={handlePhotoSelect}
                                        className="h-full w-full p-4"
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="editor"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full w-full absolute inset-0 z-20"
                                >
                                    {selectedPhoto && (
                                        <Editor
                                            photos={filteredPhotos}
                                            selectedPhoto={selectedPhoto}
                                            onSelect={handlePhotoSelect}
                                            onClose={() => setView(AppView.GRID)}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;