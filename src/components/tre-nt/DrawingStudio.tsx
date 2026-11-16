import { useEffect, useRef, useState } from 'react';
import { Eraser, Paintbrush, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SkeletonJoint, TreNtPet } from './types';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 550;
const JOINTS: Omit<SkeletonJoint, 'x' | 'y'>[] = [
  { id: 'head', parentId: null },
  { id: 'neck', parentId: 'head' },
  { id: 'shoulder', parentId: 'neck' },
  { id: 'left-elbow', parentId: 'shoulder' },
  { id: 'left-hand', parentId: 'left-elbow' },
  { id: 'right-elbow', parentId: 'shoulder' },
  { id: 'right-hand', parentId: 'right-elbow' },
  { id: 'hip', parentId: 'shoulder' },
  { id: 'left-knee', parentId: 'hip' },
  { id: 'left-foot', parentId: 'left-knee' },
  { id: 'right-knee', parentId: 'hip' },
  { id: 'right-foot', parentId: 'right-knee' },
];

interface DrawingStudioProps {
  onSendPet: (pet: TreNtPet) => void;
}

const DrawingStudio = ({ onSendPet }: DrawingStudioProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState('#8bfbff');
  const [brushSize, setBrushSize] = useState(12);
  const [isErasing, setIsErasing] = useState(false);
  const [joints, setJoints] = useState<SkeletonJoint[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (CANVAS_WIDTH / bounds.width),
      y: (event.clientY - bounds.top) * (CANVAS_HEIGHT / bounds.height),
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    context.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
    setJoints(null);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setJoints(null);
    setMessage('');
  };

  const animatePet = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;
    const pixels = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
    let minX = CANVAS_WIDTH;
    let minY = CANVAS_HEIGHT;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < CANVAS_HEIGHT; y += 3) {
      for (let x = 0; x < CANVAS_WIDTH; x += 3) {
        if (pixels[(y * CANVAS_WIDTH + x) * 4 + 3] < 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) {
      setMessage('Önce tuvale bir Pet çiz, sonra canlandıralım.');
      setJoints(null);
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const point = (id: string, parentId: string | null, x: number, y: number): SkeletonJoint => ({
      id,
      parentId,
      x: x / CANVAS_WIDTH,
      y: y / CANVAS_HEIGHT,
    });
    const estimated = [
      point('head', null, centerX, minY + height * 0.12),
      point('neck', 'head', centerX, minY + height * 0.27),
      point('shoulder', 'neck', centerX, minY + height * 0.36),
      point('left-elbow', 'shoulder', minX + width * 0.28, minY + height * 0.44),
      point('left-hand', 'left-elbow', minX + width * 0.12, minY + height * 0.53),
      point('right-elbow', 'shoulder', minX + width * 0.72, minY + height * 0.44),
      point('right-hand', 'right-elbow', minX + width * 0.88, minY + height * 0.53),
      point('hip', 'shoulder', centerX, minY + height * 0.64),
      point('left-knee', 'hip', minX + width * 0.38, minY + height * 0.79),
      point('left-foot', 'left-knee', minX + width * 0.32, maxY),
      point('right-knee', 'hip', minX + width * 0.62, minY + height * 0.79),
      point('right-foot', 'right-knee', minX + width * 0.68, maxY),
    ];
    setJoints(estimated);
    setMessage(`Silüet ölçüsünden ${JOINTS.length} eklem tahmin edildi. Noktalar yaklaşık iskelet rehberidir.`);
  };

  const sendToAR = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const petJoints = joints ?? [];
    if (!petJoints.length) {
      setMessage('Önce “Canlandır!” ile Pet’in eklemlerini oluştur.');
      return;
    }
    try {
      const pet: TreNtPet = {
        image: canvas.toDataURL('image/png'),
        joints: petJoints,
        savedAt: Date.now(),
      };
      localStorage.setItem('tre-nt-pet', JSON.stringify(pet));
      onSendPet(pet);
      setMessage('Pet’in ve iskelet rehberi AR Atölyesi’ne gönderildi!');
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Depolama alanına erişilemedi.';
      setMessage(`Pet kaydedilemedi: ${detail}`);
    }
  };

  const jointById = new Map((joints ?? []).map((joint) => [joint.id, joint]));

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Renk
            <input aria-label="Fırça rengi" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Kalınlık
            <input aria-label="Fırça kalınlığı" type="range" min="2" max="36" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="w-24 accent-cyan-300" />
            <span className="w-6 text-xs">{brushSize}</span>
          </label>
          <Button type="button" size="sm" variant={isErasing ? 'default' : 'outline'} onClick={() => setIsErasing((value) => !value)}>
            {isErasing ? <Eraser className="mr-2 h-4 w-4" /> : <Paintbrush className="mr-2 h-4 w-4" />}
            {isErasing ? 'Silgi açık' : 'Silgi'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button type="button" size="sm" variant="outline" onClick={clearCanvas}><RotateCcw className="mr-2 h-4 w-4" />Temizle</Button>
          <Button type="button" size="sm" onClick={animatePet}><Sparkles className="mr-2 h-4 w-4" />Canlandır! ✨</Button>
          <Button type="button" size="sm" variant="secondary" onClick={sendToAR}><Send className="mr-2 h-4 w-4" />AR’a Gönder 🚀</Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-[0_0_60px_-30px_rgba(34,211,238,.5)]">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          aria-label="Pet çizim tuvali"
          className="block aspect-[18/11] w-full touch-none cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        {joints && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-label="Tahmini iskelet">
            {joints.map((joint) => {
              const parent = joint.parentId ? jointById.get(joint.parentId) : undefined;
              return parent ? <line key={`line-${joint.id}`} x1={parent.x * CANVAS_WIDTH} y1={parent.y * CANVAS_HEIGHT} x2={joint.x * CANVAS_WIDTH} y2={joint.y * CANVAS_HEIGHT} stroke="#f0abfc" strokeWidth="5" strokeLinecap="round" /> : null;
            })}
            {joints.map((joint) => <circle key={joint.id} cx={joint.x * CANVAS_WIDTH} cy={joint.y * CANVAS_HEIGHT} r="7" fill="#67e8f9" stroke="#082f49" strokeWidth="3" />)}
          </svg>
        )}
        {!joints && <p className="pointer-events-none absolute bottom-4 left-4 text-xs text-slate-500">Çizimine başla · canvas şeffaf arka planlıdır</p>}
      </div>
      {message && <p role="status" className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100">{message}</p>}
    </section>
  );
};

export default DrawingStudio;
