import { useState, useRef, useCallback } from 'react';

export const useCamera = () => {
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Kamera erişimi reddedildi veya kamera bulunamadı');
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !isActive) return null;
    
    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.drawImage(video, 0, 0);
      
      // Convert to base64 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl;
    } catch (err) {
      console.error('Capture error:', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isActive]);

  const switchCamera = useCallback(async () => {
    if (!streamRef.current) return;
    
    const currentTrack = streamRef.current.getVideoTracks()[0];
    const currentFacingMode = currentTrack.getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    
    // Stop current stream
    stopCamera();
    
    // Start with new facing mode
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
    } catch (err) {
      console.error('Switch camera error:', err);
      // Fallback to any camera
      await startCamera();
    }
  }, [stopCamera, startCamera]);

  return {
    videoRef,
    isActive,
    isCapturing,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    switchCamera,
  };
};
