// src/hooks/useShakeToClose.ts
import { useEffect, useState } from 'react';

const SHAKE_THRESHOLD = 15; // Hassasiyet eşiği (düşük = daha hassas)
const SHAKE_TIMEOUT = 1000; // Sallama algılama penceresi (ms)

export const useShakeToClose = (enabled: boolean) => {
  const [lastShake, setLastShake] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const totalAcc = Math.sqrt(
        (acc.x ?? 0) ** 2 + 
        (acc.y ?? 0) ** 2 + 
        (acc.z ?? 0) ** 2
      );

      const now = Date.now();
      if (totalAcc > SHAKE_THRESHOLD && now - lastShake > SHAKE_TIMEOUT) {
        setLastShake(now);
        // Shake algılandı! Uygulamayı kapat
        window.close(); // veya window.location.href = 'about:blank';
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled, lastShake]);
};
