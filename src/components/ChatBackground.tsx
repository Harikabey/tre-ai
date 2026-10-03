import { useState } from 'react';
import { useChatBackground } from '@/hooks/useChatBackground';

export function ChatBackground() {
  const { backgroundImage } = useChatBackground();
  const [isDarkImage, setIsDarkImage] = useState(false);

  if (!backgroundImage) return null;

  const inspectBrightness = (image: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return;

    try {
      context.drawImage(image, 0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      setIsDarkImage((red * 299 + green * 587 + blue * 114) / 1000 < 96);
    } catch {
      setIsDarkImage(false);
    }
  };

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[-1] h-full w-full" aria-hidden="true">
      <img
        src={backgroundImage}
        alt=""
        className="h-full w-full object-cover"
        onLoad={(event) => inspectBrightness(event.currentTarget)}
      />
      <div
        className="absolute inset-0 bg-white dark:bg-black"
        style={{ opacity: isDarkImage ? 0.78 : 0.68 }}
      />
    </div>
  );
}
