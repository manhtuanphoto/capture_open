import React from 'react';
import { Photo } from '../types';
import { Heart, Maximize2 } from 'lucide-react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

interface PhotoGridProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  className?: string;
}

const PhotoItem: React.FC<{ photo: Photo; onSelect: (photo: Photo) => void }> = ({ photo, onSelect }) => {
  const [ref, isVisible] = useIntersectionObserver({ rootMargin: '200px' });

  return (
    <div
      ref={ref}
      className="group relative aspect-square rounded-lg overflow-hidden bg-gray-800 cursor-pointer border border-transparent hover:border-accent-500/50 transition-all duration-200"
      onClick={() => onSelect(photo)}
    >
      {isVisible ? (
        <img
          src={photo.thumbnail || photo.url}
          alt={photo.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 animate-fade-in"
          loading="lazy"
          onError={(e) => {
            console.error('Failed to load image:', photo.thumbnail);
            e.currentTarget.src = photo.url;
          }}
        />
      ) : (
        <div className="w-full h-full bg-gray-800 animate-pulse" />
      )}

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Metadata Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex justify-between items-end">
        <div>
          <p className="text-xs text-white font-medium truncate">{photo.name}</p>
          <p className="text-[10px] text-gray-300">{photo.width} × {photo.height}</p>
        </div>
        <button className="text-white/80 hover:text-accent-500 transition-colors">
          <Heart size={14} />
        </button>
      </div>

      {/* Selection Indicator style (mock) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 size={14} className="text-white drop-shadow-md" />
      </div>
    </div>
  );
};

export const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onSelect, className }) => {
  return (
    <div className={`overflow-y-auto ${className}`}>
      {photos.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-500">
          <p className="text-lg">No photos found</p>
          <p className="text-sm">Try selecting a different album</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {photos.map((photo) => (
            <PhotoItem key={photo.id} photo={photo} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};