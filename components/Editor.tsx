import React, { useState, useEffect } from 'react';
import { Photo, Tool } from '../types';
import { X, ChevronLeft, Wand2, Crop, Sliders, Loader2, ChevronRight, Minus, Plus, Download, Layout } from 'lucide-react';
import { analyzeImage, generateEditedImage, urlToBase64 } from '../services/geminiService';
import { useZoom } from './hooks/useZoom';

interface EditorProps {
  photos: Photo[];
  selectedPhoto: Photo;
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}

export const Editor: React.FC<EditorProps> = ({ photos, selectedPhoto, onSelect, onClose }) => {
  // We use selectedPhoto directly from props
  const [activeTool, setActiveTool] = useState<Tool>(Tool.NONE);
  const [analysis, setAnalysis] = useState<{ description: string; tags: string[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Progressive loading state
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string>(selectedPhoto.thumbnail || selectedPhoto.url);
  const [isLoadingFullPreview, setIsLoadingFullPreview] = useState(false);

  // Use custom zoom hook
  const {
    scale,
    setScale,
    position,
    setPosition,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleOneToOne,
    imageRef
  } = useZoom();

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Progressive image loading: standard → full-size
  useEffect(() => {
    const loadPreview = async () => {
      // Start with standard preview (fast)
      if (selectedPhoto.standardPreview) {
        setCurrentPreviewUrl(selectedPhoto.standardPreview);
      } else if (selectedPhoto.url) {
        setCurrentPreviewUrl(selectedPhoto.url);
      }

      // Then load full-size preview (slower, higher quality)
      if (selectedPhoto.fullPreview && selectedPhoto.fullPreview !== selectedPhoto.standardPreview) {
        setIsLoadingFullPreview(true);

        // Preload full-size image
        const img = new Image();
        img.onload = () => {
          setCurrentPreviewUrl(selectedPhoto.fullPreview!);
          setIsLoadingFullPreview(false);
        };
        img.onerror = () => {
          setIsLoadingFullPreview(false);
        };
        img.src = selectedPhoto.fullPreview;
      } else {
        setIsLoadingFullPreview(false);
      }
    };

    loadPreview();
  }, [selectedPhoto.id, selectedPhoto.standardPreview, selectedPhoto.fullPreview]);

  // Reset tool state and zoom when photo changes
  useEffect(() => {
    setAnalysis(null);
    setGeneratedImage(null);
    setActiveTool(Tool.NONE);
    setPrompt('');
    // Reset Zoom
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedPhoto.id]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool !== Tool.NONE) return; // Disable navigation if editing

      if (e.key === 'ArrowLeft') {
        const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
        if (currentIndex > 0) onSelect(photos[currentIndex - 1]);
      } else if (e.key === 'ArrowRight') {
        const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
        if (currentIndex < photos.length - 1) onSelect(photos[currentIndex + 1]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, selectedPhoto, onSelect, onClose, activeTool]);

  const handleAnalyze = async () => {
    if (analysis) return;
    setIsAnalyzing(true);
    try {
      const base64 = await urlToBase64(selectedPhoto.url);
      const result = await analyzeImage(base64);
      setAnalysis(result);
    } catch (err) {
      console.error("Failed to analyze", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAIEdit = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const base64 = await urlToBase64(selectedPhoto.url);
      const result = await generateEditedImage(base64, prompt);
      if (result) {
        setGeneratedImage(`data:image/jpeg;base64,${result}`);
      }
    } catch (err) {
      console.error("Failed to generate edit", err);
      alert("Could not generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isEditMode = activeTool !== Tool.NONE;



  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const [isFilmstripVisible, setIsFilmstripVisible] = useState(true);

  // Rebuild: Simplified Layout Structure
  return (
    <div className="h-full w-full bg-gray-950 flex flex-col overflow-hidden select-none">

      {/* 1. Main Stage (Canvas) - Flex-1 to take all available space */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-950">

        {/* Image Wrapper - Handles Zoom/Pan Transforms */}
        <div
          className="relative transition-transform duration-100 ease-out will-change-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            // CRITICAL: Ensure wrapper doesn't force overflow when at scale 1
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* The Image - Handles Object Fit */}
          <div className="relative flex items-center justify-center max-w-full max-h-full">

            {/* LAYER 1: Layout Pre-rendering (Blurred Thumbnail) */}
            {/* Visible immediately to hold layout and color context */}
            <img
              src={selectedPhoto.thumbnail || selectedPhoto.url}
              alt="placeholder"
              className="absolute inset-0 w-full h-full object-contain blur-xl scale-105 opacity-50"
              style={{
                maxWidth: '100vw',
                maxHeight: isFilmstripVisible ? 'calc(100vh - 140px)' : '100vh',
              }}
            />

            {/* LAYER 2: Main Image (Progressive Load) */}
            <img
              ref={imageRef}
              src={generatedImage || currentPreviewUrl}
              alt={selectedPhoto.name}
              className={`relative max-w-full max-h-full object-contain shadow-2xl shadow-black/50 pointer-events-none select-none transition-opacity duration-500 ${
                // Fade in when loaded (simple check: if src is different from thumbnail, or just always fade)
                // For now, we just let it render naturally on top. The blur behind provides the "pre-render" feel.
                'z-10'
                }`}
              draggable={false}
              style={{
                // Ensure image never exceeds the viewport bounds in "Fit" mode
                maxWidth: '100vw',
                maxHeight: isFilmstripVisible ? 'calc(100vh - 140px)' : '100vh', // Account for filmstrip if visible
              }}
            />
          </div>

          {/* Loading & Status Overlays */}
          {isLoadingFullPreview && !generatedImage && (
            <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2 text-white text-sm pointer-events-none">
              <Loader2 size={16} className="animate-spin text-accent-500" />
              <span>Loading high quality...</span>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none">
              <Loader2 size={40} className="animate-spin mb-4 text-accent-500" />
              <p className="text-sm font-medium tracking-wide">Refining pixels...</p>
            </div>
          )}
        </div>

        {/* Navigation Arrows (Only visible at 100% fit) */}
        {scale === 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                if (idx > 0) onSelect(photos[idx - 1]);
              }}
              className="absolute left-4 p-3 bg-black/20 hover:bg-black/50 rounded-full text-white/30 hover:text-white transition-all backdrop-blur-sm z-10"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                if (idx < photos.length - 1) onSelect(photos[idx + 1]);
              }}
              className="absolute right-4 p-3 bg-black/20 hover:bg-black/50 rounded-full text-white/30 hover:text-white transition-all backdrop-blur-sm z-10"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}

        {/* Zoom Toolbar - Floating at bottom center */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl transition-all duration-300"
          style={{ marginBottom: isFilmstripVisible ? '0px' : '0px' }} // Adjust if needed
        >
          <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors" title="Zoom Out">
            <Minus size={18} />
          </button>
          <span className="text-xs font-medium text-white/60 w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors" title="Zoom In">
            <Plus size={18} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          <button onClick={handleFit} className="px-2 py-1 hover:bg-white/10 rounded-md text-xs font-medium text-white/80 hover:text-white transition-colors">
            Fit
          </button>
          <button onClick={handleOneToOne} className="px-2 py-1 hover:bg-white/10 rounded-md text-xs font-medium text-white/80 hover:text-white transition-colors">
            1:1
          </button>
          <div className="w-px h-4 bg-white/10 mx-2"></div>
          <button
            onClick={() => {
              const link = document.createElement('a');
              link.href = selectedPhoto.url;
              link.download = selectedPhoto.name;
              link.click();
            }}
            className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors"
            title="Download"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Edit Tools Toolbar (If active) */}
        {isEditMode && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-full px-6 py-3 shadow-xl flex items-center space-x-8 z-30 animate-slide-up">
            <button onClick={() => setActiveTool(Tool.ADJUST)} className={`flex flex-col items-center space-y-1 ${activeTool === Tool.ADJUST ? 'text-accent-500' : 'text-gray-400 hover:text-white'}`}>
              <Sliders size={20} />
              <span className="text-[10px] font-medium">Adjust</span>
            </button>
            <button onClick={() => setActiveTool(Tool.CROP)} className={`flex flex-col items-center space-y-1 ${activeTool === Tool.CROP ? 'text-accent-500' : 'text-gray-400 hover:text-white'}`}>
              <Crop size={20} />
              <span className="text-[10px] font-medium">Crop</span>
            </button>
            <div className="w-px h-8 bg-gray-700 mx-2"></div>
            <button onClick={() => { setActiveTool(Tool.AI_EDIT); setGeneratedImage(null); }} className={`flex flex-col items-center space-y-1 ${activeTool === Tool.AI_EDIT ? 'text-accent-500' : 'text-gray-400 hover:text-white'}`}>
              <Wand2 size={20} />
              <span className="text-[10px] font-medium">Magic</span>
            </button>
          </div>
        )}

      </div>

      {/* 2. Filmstrip Area - Fixed height container at bottom */}
      <div
        className={`relative bg-black/90 backdrop-blur-xl border-t border-white/10 transition-all duration-300 ease-in-out z-30 flex flex-col ${isFilmstripVisible ? 'h-[130px]' : 'h-0 border-none'
          }`}
      >
        {/* Toggle Button - Attached to top of filmstrip */}
        <button
          onClick={() => setIsFilmstripVisible(!isFilmstripVisible)}
          className="absolute -top-10 right-6 bg-black/60 backdrop-blur-md text-white/70 hover:text-white p-2 rounded-t-lg border-t border-l border-r border-white/10 hover:bg-black/80 transition-all shadow-lg flex items-center justify-center"
          title={isFilmstripVisible ? "Hide Filmstrip" : "Show Filmstrip"}
          style={{ height: '40px', width: '48px' }}
        >
          {isFilmstripVisible ? <ChevronRight className="rotate-90" size={20} /> : <Layout size={20} />}
        </button>

        {/* Thumbnails Scroll Area */}
        <div className={`flex-1 flex items-center px-4 space-x-3 overflow-x-auto overflow-y-hidden no-scrollbar ${!isFilmstripVisible && 'hidden'}`}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => onSelect(photo)}
              className={`relative flex-shrink-0 h-[88px] aspect-square cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${photo.id === selectedPhoto.id
                ? 'border-2 border-accent-500 ring-2 ring-accent-500/20 scale-100 opacity-100'
                : 'border border-white/10 opacity-50 hover:opacity-100 hover:border-white/30 hover:scale-[1.02]'
                }`}
            >
              <img
                src={photo.thumbnail || photo.url}
                alt={photo.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar (Tools Panel) - Overlay */}
      {isEditMode && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 flex flex-col animate-slide-in-right z-40 shadow-2xl">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-medium text-sm text-gray-200">
              {activeTool === Tool.AI_EDIT ? "Magic AI" : "Adjustments"}
            </h3>
            <button onClick={() => setActiveTool(Tool.NONE)} className="text-gray-500 hover:text-white"><X size={16} /></button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
            {activeTool === Tool.AI_EDIT ? (
              <div className="space-y-4">
                <Wand2 size={48} className="mx-auto text-gray-600" />
                <p className="text-sm text-gray-400">AI Tools Module</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Sliders size={48} className="mx-auto text-gray-600" />
                <p className="text-sm text-gray-400">Adjustments Module</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};