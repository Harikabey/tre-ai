import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import deformVertexShader from '@/shaders/vertex_deform.glsl?raw';
import type { TrackedHand } from '@/hooks/useHandTracking';

type SculptUniforms = {
  uHandA: { value: THREE.Vector3 };
  uHandB: { value: THREE.Vector3 };
  uHandCount: { value: number };
  uSculptStrength: { value: number };
};

export const useSculpting = () => {
  const uniforms = useRef(new Map<THREE.Mesh, SculptUniforms>());

  const attachSculpting = useCallback((mesh: THREE.Mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    const meshUniforms: SculptUniforms = {
      uHandA: { value: new THREE.Vector3(100, 100, 100) },
      uHandB: { value: new THREE.Vector3(100, 100, 100) },
      uHandCount: { value: 0 },
      uSculptStrength: { value: 0 },
    };
    uniforms.current.set(mesh, meshUniforms);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uHandA = meshUniforms.uHandA;
      shader.uniforms.uHandB = meshUniforms.uHandB;
      shader.uniforms.uHandCount = meshUniforms.uHandCount;
      shader.uniforms.uSculptStrength = meshUniforms.uSculptStrength;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${deformVertexShader}`)
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = treDeform(position, normal);',
        );
    };
    material.customProgramCacheKey = () => 'tre-nt-sculpting-v1';
  }, []);

  const detachSculpting = useCallback((mesh: THREE.Mesh) => {
    uniforms.current.delete(mesh);
  }, []);

  const setSculptingHands = useCallback((hands: TrackedHand[], active: boolean) => {
    const [first, second] = hands;
    const handPositions = hands.map((hand) => new THREE.Vector3(
      (0.5 - hand.x) * 4,
      (0.5 - hand.y) * 3,
      2.5 - hand.depth * 0.35,
    ));
    uniforms.current.forEach((meshUniforms, mesh) => {
      mesh.updateWorldMatrix(true, false);
      const localA = handPositions[0] ? mesh.worldToLocal(handPositions[0].clone()) : null;
      const localB = handPositions[1] ? mesh.worldToLocal(handPositions[1].clone()) : null;
      meshUniforms.uHandA.value.copy(localA ?? new THREE.Vector3(100, 100, 100));
      meshUniforms.uHandB.value.copy(localB ?? new THREE.Vector3(100, 100, 100));
      meshUniforms.uHandCount.value = hands.length;
      meshUniforms.uSculptStrength.value = active && hands.length > 0 ? 1 : 0;
    });
  }, []);

  return { attachSculpting, detachSculpting, setSculptingHands };
};
