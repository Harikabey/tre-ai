import { useState, useEffect, useCallback } from 'react';
import { Download, Share2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface AnimatedFramesProps {
  frames: string[];
  delay?: number;
  alt?: string;
}

export const AnimatedFrames = ({ frames, delay = 500, alt = 'Animated GIF' }: AnimatedFramesProps) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (frames.length <= 1 || !isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, delay);

    return () => clearInterval(interval);
  }, [frames.length, delay, isPlaying]);

  const handleDownload = useCallback(async () => {
    try {
      // Create a canvas to combine frames into a single image strip
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Download current frame
      const frameUrl = frames[currentFrame];
      const link = document.createElement('a');
      link.href = frameUrl;
      link.download = `gif-frame-${currentFrame + 1}.png`;
      
      // For base64 images, direct download works
      if (frameUrl.startsWith('data:')) {
        link.click();
      } else {
        // For URLs, fetch and convert
        const response = await fetch(frameUrl);
        const blob = await response.blob();
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
      
      toast({ title: 'Kare indirildi', description: `Kare ${currentFrame + 1}/${frames.length}` });
    } catch {
      toast({ title: 'İndirme hatası', description: 'Kare indirilemedi', variant: 'destructive' });
    }
  }, [frames, currentFrame]);

  const handleDownloadAll = useCallback(async () => {
    try {
      for (let i = 0; i < frames.length; i++) {
        const frameUrl = frames[i];
        const link = document.createElement('a');
        link.download = `gif-frame-${i + 1}.png`;
        
        if (frameUrl.startsWith('data:')) {
          link.href = frameUrl;
          link.click();
        } else {
          const response = await fetch(frameUrl);
          const blob = await response.blob();
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
        // Small delay between downloads
        await new Promise(r => setTimeout(r, 300));
      }
      toast({ title: 'Tüm kareler indirildi', description: `${frames.length} kare` });
    } catch {
      toast({ title: 'İndirme hatası', variant: 'destructive' });
    }
  }, [frames]);

  const handleShare = useCallback(async () => {
    const frameUrl = frames[currentFrame];
    
    if (navigator.share) {
      try {
        // Convert to blob for native share
        let blob: Blob;
        if (frameUrl.startsWith('data:')) {
          const res = await fetch(frameUrl);
          blob = await res.blob();
        } else {
          const res = await fetch(frameUrl);
          blob = await res.blob();
        }
        
        const file = new File([blob], 'animation-frame.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: 'GIF Animasyonu' });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(frameUrl);
          toast({ title: 'Bağlantı kopyalandı' });
        }
      }
    } else {
      // Fallback: copy image URL
      try {
        await navigator.clipboard.writeText(frameUrl);
        toast({ title: 'Bağlantı panoya kopyalandı' });
      } catch {
        toast({ title: 'Paylaşım hatası', variant: 'destructive' });
      }
    }
  }, [frames, currentFrame]);

  if (frames.length === 0) return null;

  return (
    <div className="relative inline-block rounded-lg overflow-hidden group">
      <img
        src={frames[currentFrame]}
        alt={alt}
        className="max-w-full max-h-48 sm:max-h-64 rounded-lg object-contain"
      />
      
      {/* Frame indicator */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
        GIF • {currentFrame + 1}/{frames.length}
      </div>

      {/* Controls overlay - visible on hover */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
          onClick={() => setIsPlaying(p => !p)}
          title={isPlaying ? 'Durdur' : 'Oynat'}
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
          onClick={handleDownload}
          title="Bu kareyi indir"
        >
          <Download className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
          onClick={handleShare}
          title="Paylaş"
        >
          <Share2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Download all button - bottom left */}
      <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[9px] bg-black/50 hover:bg-black/70 text-white px-1.5"
          onClick={handleDownloadAll}
        >
          <Download className="w-2.5 h-2.5 mr-0.5" />
          Tümünü İndir
        </Button>
      </div>
    </div>
  );
};
