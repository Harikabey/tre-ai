import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, CameraOff, Hand, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useSculpting } from '@/hooks/useSculpting';
import type { TreNtPet } from './types';

type PrimitiveKind = 'cube' | 'sphere' | 'prism' | 'cylinder';
type ItemKind = PrimitiveKind | 'pet';

interface SceneItem {
  id: string;
  kind: ItemKind;
  label: string;
  color: string;
  pet?: TreNtPet;
}

interface ARWorkshopProps {
  pet: TreNtPet | null;
  onRemovePet: () => string | null;
  isActive: boolean;
}

const SHAPES: { kind: PrimitiveKind; label: string; color: string }[] = [
  { kind: 'cube', label: 'Küp', color: '#67e8f9' },
  { kind: 'sphere', label: 'Top', color: '#c4b5fd' },
  { kind: 'prism', label: 'Üçgen prizma', color: '#f9a8d4' },
  { kind: 'cylinder', label: 'Silindir', color: '#fde68a' },
];

const disposeMesh = (mesh: THREE.Mesh) => {
  mesh.traverse((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      const lineMaterial = child.material;
      if (Array.isArray(lineMaterial)) lineMaterial.forEach((part) => part.dispose());
      else lineMaterial.dispose();
    }
  });
  mesh.geometry.dispose();
  const material = mesh.material;
  const disposeMaterial = (part: THREE.Material) => {
    if (part instanceof THREE.MeshStandardMaterial) part.map?.dispose();
    part.dispose();
  };
  if (Array.isArray(material)) material.forEach(disposeMaterial);
  else disposeMaterial(material);
};

const ARWorkshop = ({ pet, onRemovePet, isActive }: ARWorkshopProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshesRef = useRef(new Map<string, THREE.Mesh>());
  const selectedIdRef = useRef<string | null>(null);
  const twoHandStartRef = useRef<{ distance: number; scale: number; id: string } | null>(null);
  const { hands, tracking, error: trackingError, startTracking, stopTracking } = useHandTracking();
  const { attachSculpting, detachSculpting, setSculptingHands } = useSculpting();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [objects, setObjects] = useState<SceneItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandMessage, setCommandMessage] = useState('');

  const allItems = useMemo(() => [
    ...objects,
    ...(pet ? [{ id: 'tre-nt-pet', kind: 'pet' as const, label: 'AR Pet', color: '#8bfbff', pet }] : []),
  ], [objects, pet]);

  const selectObject = useCallback((id: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
  }, []);

  const addObject = useCallback((kind: PrimitiveKind) => {
    const shape = SHAPES.find((item) => item.kind === kind);
    if (!shape) return;
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setObjects((current) => [...current, { id, kind, label: shape.label, color: shape.color }]);
    selectObject(id);
  }, [selectObject]);

  useEffect(() => {
    const mount = stageRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100);
    camera.position.set(0, 0, 7);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-3, 5, 6);
    scene.add(keyLight);
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    const meshes = meshesRef.current;

    const resize = () => {
      if (!mount.isConnected) return;
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    return () => {
      resizeObserver.disconnect();
      meshes.forEach((mesh) => {
        scene.remove(mesh);
        detachSculpting(mesh);
        disposeMesh(mesh);
      });
      meshes.clear();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, [detachSculpting]);

  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!isActive || !scene || !renderer || !camera) return;
    let frame = 0;
    const render = (time: number) => {
      meshesRef.current.forEach((mesh) => {
        if (mesh.userData.isPet) mesh.rotation.y = Math.sin(time * 0.0007) * 0.12;
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [isActive]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    meshesRef.current.forEach((mesh) => {
      scene.remove(mesh);
      detachSculpting(mesh);
      disposeMesh(mesh);
    });
    meshesRef.current.clear();

    allItems.forEach((item, index) => {
      let geometry: THREE.BufferGeometry;
      if (item.kind === 'cube') geometry = new THREE.BoxGeometry(1.25, 1.25, 1.25, 28, 28, 28);
      else if (item.kind === 'sphere') geometry = new THREE.SphereGeometry(0.8, 48, 40);
      else if (item.kind === 'prism') geometry = new THREE.CylinderGeometry(0.85, 0.85, 1.35, 3, 24);
      else if (item.kind === 'cylinder') geometry = new THREE.CylinderGeometry(0.65, 0.65, 1.3, 40, 24);
      else geometry = new THREE.PlaneGeometry(2.2, 1.55, 36, 36);

      const material = new THREE.MeshStandardMaterial({
        color: item.kind === 'pet' ? '#ffffff' : item.color,
        roughness: 0.28,
        metalness: 0.12,
        emissive: item.kind === 'pet' ? '#000000' : item.color,
        emissiveIntensity: 0.12,
        transparent: item.kind === 'pet',
        side: THREE.DoubleSide,
        map: item.pet ? new THREE.TextureLoader().load(item.pet.image, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
        }) : null,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((index % 3 - 1) * 1.65, index > 2 ? -0.5 : 0.15, 0);
      mesh.userData.isPet = item.kind === 'pet';
      mesh.userData.itemId = item.id;
      mesh.userData.baseY = mesh.position.y;
      attachSculpting(mesh);
      scene.add(mesh);
      meshesRef.current.set(item.id, mesh);

      if (item.kind === 'pet' && item.pet) {
        const jointPoints = new Map(item.pet.joints.map((joint) => [joint.id, joint]));
        item.pet.joints.forEach((joint) => {
          const parent = joint.parentId ? jointPoints.get(joint.parentId) : undefined;
          if (!parent) return;
          const start = new THREE.Vector3((parent.x - 0.5) * 2.2, (0.5 - parent.y) * 1.55, 0.04);
          const end = new THREE.Vector3((joint.x - 0.5) * 2.2, (0.5 - joint.y) * 1.55, 0.04);
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
          const lineMaterial = new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.72 });
          const line = new THREE.Line(lineGeometry, lineMaterial);
          mesh.add(line);
        });
      }
    });

    if (selectedIdRef.current && !meshesRef.current.has(selectedIdRef.current)) {
      selectedIdRef.current = null;
      setSelectedId(null);
    }
  }, [allItems, attachSculpting, detachSculpting]);

  useEffect(() => {
    if (!isActive) {
      setStream(null);
      return;
    }
    const streamForEffect = stream;
    if (!streamForEffect) return;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = streamForEffect;
    void video.play().then(() => {
      if (!cancelled) return startTracking(video);
      return undefined;
    }).catch((reason: unknown) => {
      if (!cancelled) {
        const detail = reason instanceof Error ? reason.message : 'Kamera ya da el takibi başlatılamadı.';
        setCameraError(detail);
        streamForEffect.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    });
    return () => {
      cancelled = true;
      stopTracking();
      streamForEffect.getTracks().forEach((track) => track.stop());
      if (video.srcObject === streamForEffect) video.srcObject = null;
    };
  }, [isActive, stream, startTracking, stopTracking]);

  useEffect(() => () => {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stopTracking();
  }, [stopTracking, stream]);

  useEffect(() => {
    setSculptingHands(hands, hands.length > 0);
    const worldHands = hands.map((hand) => new THREE.Vector3(
      (0.5 - hand.x) * 4,
      (0.5 - hand.y) * 3,
      2.5 - hand.depth * 0.35,
    ));
    if (hands.length >= 2) {
      const mesh = selectedIdRef.current ? meshesRef.current.get(selectedIdRef.current) : undefined;
      if (mesh) {
        const distance = worldHands[0].distanceTo(worldHands[1]);
        if (!twoHandStartRef.current || twoHandStartRef.current.id !== selectedIdRef.current) {
          twoHandStartRef.current = { distance: Math.max(distance, 0.01), scale: mesh.scale.x, id: selectedIdRef.current };
        } else {
          const ratio = distance / twoHandStartRef.current.distance;
          const nextScale = THREE.MathUtils.clamp(twoHandStartRef.current.scale * ratio, 0.35, 3.5);
          mesh.scale.setScalar(nextScale);
        }
      }
    } else {
      twoHandStartRef.current = null;
      const hand = hands.find((item) => item.fist);
      const mesh = selectedIdRef.current ? meshesRef.current.get(selectedIdRef.current) : undefined;
      if (hand && mesh) {
        mesh.position.set(
          (0.5 - hand.x) * 4,
          (0.5 - hand.y) * 3,
          2.5 - hand.depth * 0.35,
        );
      }
    }
  }, [hands, setSculptingHands]);

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Bu tarayıcı kamera erişimini desteklemiyor. HTTPS bağlantısını kontrol edin.');
      return;
    }
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(cameraStream);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Kamera izni alınamadı.';
      setCameraError(`Kamera açılamadı: ${detail}`);
    }
  };

  const runTextCommand = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = command.trim().toLocaleLowerCase('tr-TR');
    setCommandMessage('');
    if (!text) {
      setCommandMessage('Önce bir metin komutu yaz.');
      return;
    }
    if (/her şeyi sil|hepsini sil|tüm objeleri sil|tüm nesneleri sil/.test(text)) {
      setObjects([]);
      setCommandMessage(onRemovePet() ?? 'Atölyedeki tüm objeler silindi.');
    } else if (/küp/.test(text) && /ekle|getir|oluştur/.test(text)) {
      addObject('cube');
      setCommandMessage('Bir küp eklendi.');
    } else if (/(top|küre)/.test(text) && /ekle|getir|oluştur/.test(text)) {
      addObject('sphere');
      setCommandMessage('Bir top eklendi.');
    } else if (/prizma/.test(text) && /ekle|getir|oluştur/.test(text)) {
      addObject('prism');
      setCommandMessage('Bir üçgen prizma eklendi.');
    } else if (/silindir/.test(text) && /ekle|getir|oluştur/.test(text)) {
      addObject('cylinder');
      setCommandMessage('Bir silindir eklendi.');
    } else if (/büyüt/.test(text)) {
      const target = /pet/i.test(text) ? (pet ? 'tre-nt-pet' : null) : selectedIdRef.current ?? (pet ? 'tre-nt-pet' : null);
      const mesh = target ? meshesRef.current.get(target) : null;
      if (!mesh) setCommandMessage('Önce büyütülecek bir obje seç veya ekle.');
      else {
        mesh.scale.multiplyScalar(1.25);
        mesh.scale.clampScalar(0.35, 3.5);
        setCommandMessage('Seçili obje büyütüldü.');
      }
    } else {
      setCommandMessage('Bu komutu anlayamadım. Örnek: “Küp ekle”, “Pet’i büyüt”, “Her şeyi sil”.');
    }
    setCommand('');
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 font-semibold"><Hand className="h-4 w-4 text-cyan-300" />El hareketleri</h2>
          <p className="mt-1 text-xs text-slate-400">Yumruk: seçili objeyi taşı · iki el: objeyi büyüt/küçült · yaklaş: yüzeyi yoğur</p>
        </div>
        <Button type="button" onClick={() => stream ? setStream(null) : void startCamera()}>
          {stream ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
          {stream ? 'Kamerayı kapat' : 'Kamerayı aç'}
        </Button>
      </div>

      <div className="relative h-[min(60vh,520px)] min-h-[320px] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-900">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        <div ref={stageRef} className="absolute inset-0" />
        {!stream && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center">
            <p className="max-w-sm text-sm text-slate-300">Kamera görüntüsü ve sanal objeler burada birleşir. Başlamak için kamera izni ver.</p>
          </div>
        )}
        {tracking && <div className="absolute left-3 top-3 rounded-full border border-emerald-300/30 bg-slate-950/70 px-3 py-1 text-xs text-emerald-200">El takibi aktif · {hands.length} el</div>}
        {(cameraError || trackingError) && <p role="alert" className="absolute bottom-3 left-3 right-3 rounded-lg bg-red-950/90 p-3 text-xs text-red-100">{cameraError || trackingError}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <h3 className="mb-3 font-semibold">Objeler Paneli</h3>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((shape) => (
              <Button key={shape.kind} type="button" variant="outline" size="sm" onClick={() => addObject(shape.kind)}>
                <Plus className="mr-1 h-4 w-4" />{shape.label}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {allItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectObject(item.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedId === item.id ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/30'}`}
              >
                {item.label}{item.kind === 'pet' ? ' ✨' : ''}
              </button>
            ))}
            {allItems.length === 0 && <p className="text-xs text-slate-500">Henüz obje yok. Bir şekil ekle veya çizimini AR’a gönder.</p>}
          </div>
          {pet && <p className="mt-3 text-xs text-cyan-100/70">AR Pet ve iskelet rehberi sahnede. Pet’in çizim animasyonu devam ediyor.</p>}
        </section>

        <section className="rounded-2xl border border-fuchsia-300/20 bg-slate-900/80 p-4">
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-fuchsia-300" />Tre</h3>
          <p className="mb-3 text-xs text-slate-400">Yalnızca metin komutları · el hareketlerine dokunmaz</p>
          <form onSubmit={runTextCommand} className="space-y-2">
            <input
              aria-label="Tre metin komutu"
              type="text"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Örn. Küp ekle"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-fuchsia-300/50"
            />
            <Button type="submit" className="w-full">Komutu çalıştır</Button>
          </form>
          {commandMessage && <p role="status" className="mt-3 text-xs text-fuchsia-100">{commandMessage}</p>}
          {allItems.length > 0 && <Button type="button" variant="ghost" size="sm" className="mt-2 w-full text-slate-400" onClick={() => { setObjects([]); setCommandMessage(onRemovePet() ?? 'Tüm objeler silindi.'); }}><Trash2 className="mr-2 h-4 w-4" />Atölyeyi temizle</Button>}
        </section>
      </div>
    </section>
  );
};

export default ARWorkshop;
