import { useState, useRef, useCallback, TouchEvent } from 'react';

interface SwipeToDeleteOptions {
  threshold?: number;
  onDelete: () => void;
}

export const useSwipeToDelete = ({ threshold = 80, onDelete }: SwipeToDeleteOptions) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    currentXRef.current = e.touches[0].clientX;
    const diff = startXRef.current - currentXRef.current;
    
    // Only allow left swipe (positive diff means swiping left)
    if (diff > 0) {
      // Limit the swipe distance with a dampening effect
      const maxSwipe = 120;
      const dampened = Math.min(diff, maxSwipe);
      setTranslateX(-dampened);
    } else {
      setTranslateX(0);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    const diff = startXRef.current - currentXRef.current;
    
    if (diff > threshold) {
      // Trigger delete animation
      setTranslateX(-300);
      setTimeout(() => {
        onDelete();
        setTranslateX(0);
      }, 200);
    } else {
      // Reset position
      setTranslateX(0);
    }
  }, [threshold, onDelete]);

  const resetSwipe = useCallback(() => {
    setTranslateX(0);
    setIsDragging(false);
  }, []);

  return {
    translateX,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetSwipe,
  };
};
