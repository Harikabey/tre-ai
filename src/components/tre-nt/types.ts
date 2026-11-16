export interface SkeletonJoint {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
}

export interface TreNtPet {
  image: string;
  joints: SkeletonJoint[];
  savedAt: number;
}

export const isTreNtPet = (value: unknown): value is TreNtPet => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TreNtPet>;
  return typeof candidate.image === 'string'
    && candidate.image.startsWith('data:image/png;base64,')
    && typeof candidate.savedAt === 'number'
    && Array.isArray(candidate.joints)
    && candidate.joints.every((joint) => (
      Boolean(joint)
      && typeof joint.id === 'string'
      && (joint.parentId === null || typeof joint.parentId === 'string')
      && typeof joint.x === 'number'
      && Number.isFinite(joint.x)
      && typeof joint.y === 'number'
      && Number.isFinite(joint.y)
    ));
};
