import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CASE_URL = '/models/case/case.glb';
// Sized to comfortably fit the longest weapon (MP5, 0.68m) with margin on both ends.
const CASE_LENGTH = 0.86;

export async function loadWeaponCase() {
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.load(CASE_URL, resolve, undefined, reject));
  const source = gltf.scene;

  const box = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = CASE_LENGTH / maxDim;

  const group = new THREE.Group();
  group.name = 'weapon_case';
  source.position.sub(center);
  source.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  group.add(source);
  group.scale.setScalar(scale);
  // Group is still detached from the live scene graph at this point, so matrixWorld
  // won't be current unless forced — required for Box3.setFromObject below to be correct.
  group.updateMatrixWorld(true);

  // Find the actual bottom foam mesh so weapons rest precisely centered on its surface.
  // (The group's own pivot is centered on the whole open case including the swung-open
  // lid, so it does NOT line up with the tray center — can't just use the local origin.)
  let foamBox = null;
  source.traverse((obj) => {
    if (obj.isMesh && /foam/i.test(obj.name) && /bottom/i.test(obj.name)) {
      const b = new THREE.Box3().setFromObject(obj);
      foamBox = foamBox ? foamBox.union(b) : b;
    }
  });
  const foamCenter = new THREE.Vector3();
  foamBox.getCenter(foamCenter);
  const foamSize = new THREE.Vector3();
  foamBox.getSize(foamSize);

  return {
    group,
    scale,
    // Rest point for an item lying in the tray, in the same (group-local/world) frame as
    // group.position (group carries no rotation here). Case-local axes: X = tray length,
    // Y = vertical/height (the foam mesh is paper-thin in Y — confirmed via foamSize.y
    // being ~0), Z = tray width. Center on X and Z, sit just above the foam's top Y face.
    restLocalPosition: new THREE.Vector3(foamCenter.x, foamBox.max.y + 0.012, foamCenter.z),
    // Usable footprint of the tray (world units) so callers can sanity-check fit.
    foamSize,
  };
}
