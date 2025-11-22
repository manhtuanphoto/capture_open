import { useState, useRef } from 'react';

export const useZoom = () => {
    const [scale, setScale] = useState<number>(1);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 4));

    const handleZoomOut = () => {
        setScale(s => {
            const newScale = Math.max(s - 0.25, 0.1);
            if (newScale <= 1) setPosition({ x: 0, y: 0 });
            return newScale;
        });
    };

    const handleFit = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleOneToOne = () => {
        if (imageRef.current) {
            const img = imageRef.current;
            const containerWidth = img.parentElement?.clientWidth || 1;
            const containerHeight = img.parentElement?.clientHeight || 1;
            const fitScale = Math.min(containerWidth / img.naturalWidth, containerHeight / img.naturalHeight);
            const oneToOneScale = 1 / fitScale;
            setScale(Math.min(oneToOneScale, 4));
        } else {
            setScale(2);
        }
    };

    return {
        scale,
        setScale,
        position,
        setPosition,
        handleZoomIn,
        handleZoomOut,
        handleFit,
        handleOneToOne,
        imageRef,
    };
};
