import { useCallback, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';

export interface TrackedHand {
  x: number;
  y: number;
  depth: number;
  size: number;
  fist: boolean;
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const estimateHand = (
  landmarks: { x: number; y: number; z: number }[],
): TrackedHand => {
  const wrist = landmarks[0];
  const palmSize = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  const curledFingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].filter(([tip, joint]) => {
    const tipDistance = Math.hypot(landmarks[tip].x - wrist.x, landmarks[tip].y - wrist.y);
    const jointDistance = Math.hypot(landmarks[joint].x - wrist.x, landmarks[joint].y - wrist.y);
    return tipDistance < jointDistance * 1.12;
  }).length;

  return {
    x: landmarks[9].x,
    y: landmarks[9].y,
    depth: Math.max(0.25, Math.min(1, 0.3 / Math.max(palmSize, 0.04))),
    size: palmSize,
    fist: curledFingers >= 3,
  };
};

export const useHandTracking = () => {
  const [hands, setHands] = useState<TrackedHand[]>([]);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const runningRef = useRef(false);

  const stopTracking = useCallback(() => {
    runningRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setHands([]);
    setTracking(false);
  }, []);

  const startTracking = useCallback(async (video: HTMLVideoElement) => {
    stopTracking();
    setError(null);
    try {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      landmarkerRef.current = landmarker;
      runningRef.current = true;
      setTracking(true);

      const detect = () => {
        if (!runningRef.current || !landmarkerRef.current) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          const result = landmarkerRef.current.detectForVideo(video, performance.now());
          setHands(result.landmarks.slice(0, 2).map(estimateHand));
        }
        animationFrameRef.current = requestAnimationFrame(detect);
      };
      animationFrameRef.current = requestAnimationFrame(detect);
    } catch (reason) {
      stopTracking();
      const message = reason instanceof Error ? reason.message : 'El takibi modeli başlatılamadı.';
      setError(`El takibi başlatılamadı: ${message}`);
      throw new Error(message);
    }
  }, [stopTracking]);

  return { hands, tracking, error, startTracking, stopTracking };
};
