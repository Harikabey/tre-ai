import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'image_history';
const MAX_IMAGES = 50;

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
}

export const useImageHistory = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setImages(parsed.map((img: any) => ({
          ...img,
          timestamp: new Date(img.timestamp),
        })));
      }
    } catch (error) {
      console.error('Failed to load image history:', error);
    }
  }, []);

  // Save to localStorage whenever images change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    } catch (error) {
      console.error('Failed to save image history:', error);
    }
  }, [images]);

  const addImage = useCallback((url: string, prompt: string) => {
    const newImage: GeneratedImage = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      prompt,
      timestamp: new Date(),
    };
    
    setImages(prev => {
      const updated = [newImage, ...prev];
      // Keep only the last MAX_IMAGES
      return updated.slice(0, MAX_IMAGES);
    });
    
    return newImage;
  }, []);

  const deleteImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    addImage,
    deleteImage,
    clearImages,
  };
};

