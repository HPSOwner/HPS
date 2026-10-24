import * as THREE from 'three';
import { makeMetalTexture } from './textures.js';
import { createHologramMaterial, createEdgeLines } from './hologram.js';

// Stylized placeholder Glock-17-proportioned pistol, built from primitives.
// Named parts so they can be exploded / hologram-scanned individually.
// Swap this module out once a real licensed/CC GLTF replica is sourced.

const METAL = () => new THREE.MeshStandardMaterial({
  map: makeMetalTexture('#3a3f44'),
  metalness: 0.75,
  roughness: 0.35,
});

const POLYMER = () => new THREE.MeshStandardMaterial({
  map: makeMetalTexture('#1f2124'),
  metalness: 0.1,
  roughness: 0.8,
});

function part(name, geometry, material, position, explodeDir) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.userData.basePosition = position.clone();
  mesh.userData.explodeDir = explodeDir.clone().normalize();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildGun() {
  const group = new THREE.Group();
  group.name = 'glock17_placeholder';

  const parts = [];

  // Frame (lower polymer receiver + grip)
  const frameGeo = new THREE.BoxGeometry(0.028, 0.045, 0.14);
  parts.push(part('frame', frameGeo, POLYMER(), new THREE.Vector3(0, -0.01, 0.01), new THREE.Vector3(0, -1, 0)));

  // Grip (angled down-back from frame)
  const gripGeo = new THREE.BoxGeometry(0.026, 0.085, 0.032);
  const grip = part('grip', gripGeo, POLYMER(), new THREE.Vector3(0, -0.055, -0.045), new THREE.Vector3(0, -1, -0.3));
  grip.rotation.x = 0.18;
  parts.push(grip);

  // Magazine (protrudes below grip)
  const magGeo = new THREE.BoxGeometry(0.02, 0.06, 0.022);
  const mag = part('magazine', magGeo, METAL(), new THREE.Vector3(0, -0.1, -0.05), new THREE.Vector3(0, -1, 0));
  parts.push(mag);

  // Slide (upper metal assembly)
  const slideGeo = new THREE.BoxGeometry(0.03, 0.028, 0.155);
  parts.push(part('slide', slideGeo, METAL(), new THREE.Vector3(0, 0.025, 0.02), new THREE.Vector3(0, 1, 0.4)));

  // Barrel (protrudes from front of slide)
  const barrelGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.03, 16);
  const barrel = part('barrel', barrelGeo, METAL(), new THREE.Vector3(0, 0.025, 0.11), new THREE.Vector3(0, 0, 1));
  barrel.rotation.x = Math.PI / 2;
  parts.push(barrel);

  // Front sight
  const frontSightGeo = new THREE.BoxGeometry(0.004, 0.008, 0.006);
  parts.push(part('front_sight', frontSightGeo, METAL(), new THREE.Vector3(0, 0.043, 0.088), new THREE.Vector3(0, 1, 0)));

  // Rear sight
  const rearSightGeo = new THREE.BoxGeometry(0.014, 0.008, 0.008);
  parts.push(part('rear_sight', rearSightGeo, METAL(), new THREE.Vector3(0, 0.043, -0.045), new THREE.Vector3(0, 1, 0)));

  // Trigger guard (simplified loop)
  const guardGeo = new THREE.TorusGeometry(0.018, 0.0035, 8, 16, Math.PI * 1.4);
  const guard = part('trigger_guard', guardGeo, POLYMER(), new THREE.Vector3(0, -0.028, 0.035), new THREE.Vector3(0, -1, 0.5));
  guard.rotation.z = Math.PI;
  guard.rotation.x = Math.PI / 2;
  parts.push(guard);

  // Trigger
  const triggerGeo = new THREE.BoxGeometry(0.004, 0.018, 0.006);
  parts.push(part('trigger', triggerGeo, METAL(), new THREE.Vector3(0, -0.02, 0.038), new THREE.Vector3(0, -0.3, 1)));

  // Slide release lever
  const releaseGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8);
  const release = part('slide_release', releaseGeo, METAL(), new THREE.Vector3(-0.016, 0.012, 0.01), new THREE.Vector3(-1, 0, 0));
  release.rotation.z = Math.PI / 2;
  parts.push(release);

  for (const p of parts) group.add(p);
  group.userData.parts = parts;
  group.userData.exploded = false;
  group.userData.explodeProgress = 0;

  // Build hologram twin: edge-line wireframes + fresnel ghost shell per part,
  // kept in sync with the same local transforms, toggled visible instead of the solid parts.
  const hologramGroup = new THREE.Group();
  hologramGroup.name = 'glock17_hologram';
  hologramGroup.visible = false;
  const hologramMaterials = [];

  for (const p of parts) {
    const ghost = new THREE.Mesh(p.geometry, createHologramMaterial(0x3fd4ff, 0.85));
    ghost.position.copy(p.position);
    ghost.rotation.copy(p.rotation);
    ghost.userData.basePosition = p.userData.basePosition;
    ghost.userData.explodeDir = p.userData.explodeDir;
    hologramMaterials.push(ghost.material);

    const edges = createEdgeLines(p.geometry, 0xcdf4ff);
    edges.position.copy(p.position);
    edges.rotation.copy(p.rotation);
    edges.userData.basePosition = p.userData.basePosition;
    edges.userData.explodeDir = p.userData.explodeDir;

    hologramGroup.add(ghost);
    hologramGroup.add(edges);
  }

  group.add(hologramGroup);
  group.userData.hologramGroup = hologramGroup;
  group.userData.hologramMaterials = hologramMaterials;

  return group;
}

export function setExploded(gun, exploded, amount = 0.09) {
  const parts = gun.userData.parts;
  const hologramGroup = gun.userData.hologramGroup;
  const targets = [...parts, ...hologramGroup.children];
  for (const obj of targets) {
    const base = obj.userData.basePosition;
    const dir = obj.userData.explodeDir;
    if (!base || !dir) continue;
    const offset = exploded ? amount : 0;
    obj.position.set(
      base.x + dir.x * offset,
      base.y + dir.y * offset,
      base.z + dir.z * offset
    );
  }
  gun.userData.exploded = exploded;
}
