import { useState, useEffect } from 'react';

interface AnimatedFramesProps {
  frames: string[];
  delay?: number;
  alt?: string;
}

export const AnimatedFrames = ({ frames, delay = 500, alt = 'Animated GIF' }: AnimatedFramesProps) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, delay);

    return () => clearInterval(interval);
  }, [frames.length, delay]);

  if (frames.length === 0) return null;

  return (
    <div className="relative inline-block rounded-lg overflow-hidden">
      <img
        src={frames[currentFrame]}
        alt={alt}
        className="max-w-full max-h-48 sm:max-h-64 rounded-lg object-contain"
      />
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
        GIF • {currentFrame + 1}/{frames.length}
      </div>
    </div>
  );
};
