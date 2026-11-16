import { useMemo } from 'react';
import type { TreFikAnalysis, TreFikEdge, TreFikNode } from './useDataAnalyzer';

const formatNextLabel = (label: string | number) => (
  typeof label === 'number' ? String(label + 1) : `${label} · +1`
);

export const useChartEngine = (analysis: TreFikAnalysis, projectionPercent: number) => useMemo(() => {
  const { rows, seriesKeys, categoryKey } = analysis;
  const projectedRows = rows.map((row) => ({ ...row }));
  const projectionKey = 'Öngörü';

  if (rows.length >= 2 && seriesKeys.length > 0) {
    const previous = rows[rows.length - 2];
    const latest = rows[rows.length - 1];
    const forecast: Record<string, string | number> = {
      [categoryKey]: formatNextLabel(latest[categoryKey]),
    };
    projectedRows[projectedRows.length - 1][projectionKey] = Number(latest[seriesKeys[0]]);
    seriesKeys.forEach((key) => {
      const slope = (latest[key] as number) - (previous[key] as number);
      forecast[key] = Number(latest[key]);
      if (key === seriesKeys[0]) {
        forecast[projectionKey] = Number((Number(latest[key]) + slope * (1 + projectionPercent / 100)).toFixed(2));
      }
    });
    projectedRows.push(forecast);
  }

  const radarRows = rows.map((row) => {
    const normalized: Record<string, string | number> = { [categoryKey]: row[categoryKey] };
    seriesKeys.forEach((key) => {
      const goal = /adım|step/i.test(key) ? 10_000 : /su|water/i.test(key) ? 2.5 : /uyku|sleep/i.test(key) ? 8 : 100;
      normalized[key] = Math.min(100, Math.max(0, (Number(row[key]) / goal) * 100));
    });
    return normalized;
  });
  if (rows.length >= 2 && seriesKeys.length > 0) {
    const previous = rows[rows.length - 2];
    const latest = rows[rows.length - 1];
    const forecast: Record<string, string | number> = { [categoryKey]: formatNextLabel(latest[categoryKey]) };
    seriesKeys.forEach((key) => {
      const goal = /adım|step/i.test(key) ? 10_000 : /su|water/i.test(key) ? 2.5 : /uyku|sleep/i.test(key) ? 8 : 100;
      const projectedValue = Number(latest[key]) + (Number(latest[key]) - Number(previous[key])) * (1 + projectionPercent / 100);
      forecast[key] = Math.min(100, Math.max(0, (projectedValue / goal) * 100));
    });
    radarRows.push(forecast);
  }

  return { projectedRows, radarRows, projectionKey };
}, [analysis, projectionPercent]);

export const mountThreeNetwork = async (
  container: HTMLElement,
  nodes: TreFikNode[],
  edges: TreFikEdge[],
  onSelectNode: (node: TreFikNode) => void,
): Promise<() => void> => {
  const THREE = await import('three');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1220');
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.replaceChildren(renderer.domElement);

  const nodeObjects = new Map<string, import('three').Mesh>();
  const nodeByLabel = new Map(nodes.map((node) => [node.label, node]));
  const positions = new Map<string, import('three').Vector3>();
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * 3, Math.sin(angle) * 2.2, Math.sin(angle * 2) * 1.1);
    positions.set(node.label, position);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#164e63' }),
    );
    mesh.position.copy(position);
    mesh.userData.nodeLabel = node.label;
    scene.add(mesh);
    nodeObjects.set(node.label, mesh);
  });

  edges.forEach((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([source, target]),
      new THREE.LineBasicMaterial({ color: '#475569', transparent: true, opacity: 0.8 }),
    );
    scene.add(line);
  });
  scene.add(new THREE.AmbientLight('#ffffff', 2));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragOrigin: { x: number; y: number } | null = null;
  let dragged = false;
  let pointerStart = { x: 0, y: 0 };
  const onPointerDown = (event: PointerEvent) => {
    dragOrigin = { x: event.clientX, y: event.clientY };
    pointerStart = { x: scene.rotation.y, y: scene.rotation.x };
    dragged = false;
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragOrigin) return;
    const deltaX = event.clientX - dragOrigin.x;
    const deltaY = event.clientY - dragOrigin.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) dragged = true;
    scene.rotation.y = pointerStart.x + deltaX * 0.008;
    scene.rotation.x = pointerStart.y + deltaY * 0.008;
  };
  const onPointerUp = () => {
    dragOrigin = null;
  };
  const onClick = (event: MouseEvent) => {
    if (dragged) {
      dragged = false;
      return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const clicked = raycaster.intersectObjects([...nodeObjects.values()])[0]?.object;
    const node = clicked ? nodeByLabel.get(String(clicked.userData.nodeLabel)) : undefined;
    if (node) onSelectNode(node);
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('click', onClick);

  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(container);

  let animationFrame = 0;
  const animate = () => {
    animationFrame = window.requestAnimationFrame(animate);
    scene.rotation.y += 0.0025;
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerUp);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    renderer.dispose();
    container.replaceChildren();
  };
};
