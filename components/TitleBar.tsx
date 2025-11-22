import React from 'react';
import { Minus, Square, X, Aperture } from 'lucide-react';

export const TitleBar: React.FC = () => {
    return (
        <div className="h-8 bg-gray-950 flex items-center justify-between select-none border-b border-gray-800 z-50" style={{ WebkitAppRegion: 'drag' } as any}>
            {/* Left: App Title/Icon */}
            <div className="flex items-center px-3 space-x-2">
                <Aperture size={14} className="text-accent-500" />
                <span className="text-xs font-bold tracking-widest text-gray-400">CAPTURE OPEN</span>
            </div>

            {/* Right: Window Controls */}
            <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={() => window.electron?.minimize()}
                    className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors focus:outline-none"
                    title="Minimize"
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={() => window.electron?.maximize()}
                    className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors focus:outline-none"
                    title="Maximize"
                >
                    <Square size={12} />
                </button>
                <button
                    onClick={() => window.electron?.close()}
                    className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white transition-colors focus:outline-none"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};
