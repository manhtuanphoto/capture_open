import { useEffect, useState, useRef } from 'react';

export const useIntersectionObserver = (options = {}) => {
    const [hasIntersected, setHasIntersected] = useState(false);
    const targetRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setHasIntersected(true);
                observer.disconnect();
            }
        }, options);

        if (targetRef.current && !hasIntersected) {
            observer.observe(targetRef.current);
        }

        return () => observer.disconnect();
    }, [hasIntersected, options]);

    return [targetRef, hasIntersected] as const;
};
