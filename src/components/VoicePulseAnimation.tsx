import { useEffect, useState } from 'react';
import aiLogo from '@/assets/ai-logo.jpg';

interface VoicePulseAnimationProps {
  isActive: boolean;
  mood?: string;
}

const moodColors: Record<string, string> = {
  mutlu: 'from-green-400/40 to-emerald-500/40',
  üzgün: 'from-blue-400/40 to-indigo-500/40',
  kızgın: 'from-red-400/40 to-orange-500/40',
  endişeli: 'from-yellow-400/40 to-amber-500/40',
  heyecanlı: 'from-pink-400/40 to-rose-500/40',
  sakin: 'from-teal-400/40 to-cyan-500/40',
  nötr: 'from-primary/40 to-accent/40',
};

export const VoicePulseAnimation = ({ isActive, mood }: VoicePulseAnimationProps) => {
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const gradientClass = moodColors[mood || 'nötr'] || moodColors.nötr;

  useEffect(() => {
    if (!isActive) {
      setPulseIntensity(0);
      return;
    }

    const interval = setInterval(() => {
      setPulseIntensity(Math.random() * 0.5 + 0.5);
    }, 200);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative flex items-center justify-center">
        {/* Outer pulse rings */}
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className={`absolute rounded-full bg-gradient-to-r ${gradientClass} animate-ping`}
            style={{
              width: `${80 + ring * 40}px`,
              height: `${80 + ring * 40}px`,
              animationDuration: `${1.5 + ring * 0.5}s`,
              animationDelay: `${ring * 0.2}s`,
              opacity: 0.3 - ring * 0.08,
            }}
          />
        ))}

        {/* Inner wave circle */}
        <div
          className={`absolute w-24 h-24 rounded-full bg-gradient-to-r ${gradientClass} transition-transform duration-200`}
          style={{
            transform: `scale(${1 + pulseIntensity * 0.3})`,
            opacity: 0.4,
          }}
        />

        {/* Logo */}
        <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 shadow-glow z-10">
          <img src={aiLogo} alt="Tre" className="w-full h-full object-cover" />
        </div>

        {/* Status text */}
        <div className="absolute -bottom-12 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            Dinleniyor...
          </p>
        </div>
      </div>
    </div>
  );
};
