import * as THREE from 'three';
import { makeFloorTexture, makeCrateTexture } from './textures.js';

function crateMaterial() {
  return new THREE.MeshStandardMaterial({
    map: makeCrateTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
}

export function buildWarehouse(scene) {
  // Floor
  const floorTex = makeFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Back + side walls (bare concrete feel via dark fog-matched material)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), wallMat);
  backWall.position.set(0, 6, -10);
  scene.add(backWall);

  const sideWallGeo = new THREE.PlaneGeometry(40, 12);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-12, 6, 0);
  scene.add(leftWall);

  // Distant racking silhouettes for depth
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 2.4), rackMat);
    rack.position.set(-9 + i * 0.1, 2.5, -7 - i * 0.3);
    rack.visible = false; // kept minimal, disabled by default to avoid clutter; easy to re-enable
  }

  // A couple of stacked closed crates nearby for set-dressing
  // (the hero weapon case itself is a real downloaded model, loaded in main.js)
  const dressCrateMat = crateMaterial();
  const stackPositions = [
    { x: -1.1, y: 0.15, z: -0.6, s: 1 },
    { x: -1.1, y: 0.47, z: -0.6, s: 0.9 },
    { x: 1.3, y: 0.2, z: -1.0, s: 1.3 },
  ];
  for (const pos of stackPositions) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4 * pos.s, 0.3 * pos.s, 0.4 * pos.s), dressCrateMat);
    crate.position.set(pos.x, pos.y, pos.z);
    crate.rotation.y = Math.random() * 0.3 - 0.15;
    crate.castShadow = true;
    crate.receiveShadow = true;
    scene.add(crate);
  }
}

export function addWarehouseLighting(scene) {
  scene.fog = new THREE.FogExp2(0x05070a, 0.055);

  const ambient = new THREE.AmbientLight(0x1c2a38, 0.6);
  scene.add(ambient);

  // Overhead industrial spot — cool white, slightly focused on the crate
  const spot = new THREE.SpotLight(0xcfe8ff, 18, 12, Math.PI / 6, 0.4, 1.2);
  spot.position.set(0.5, 4.2, 1.5);
  spot.target.position.set(0, 0.3, 0.4);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot);
  scene.add(spot.target);

  // Dim rim light, faint amber, to suggest distant warehouse sodium lamps
  const rim = new THREE.PointLight(0xffa64d, 3, 10, 2);
  rim.position.set(-4, 2, -4);
  scene.add(rim);

  // Faint blue fill to sell the "military tech" palette, brightens when hologram is active
  const fill = new THREE.PointLight(0x2f6fa8, 1.2, 8, 2);
  fill.position.set(2, 1.5, 2);
  scene.add(fill);

  return { spot, rim, fill };
}

// A simple hanging-bulb fixture (cord + glowing bulb mesh) plus a warm point light,
// positioned directly above wherever the weapon idles/spins — gives the floating gun a
// dedicated overhead key light instead of relying solely on the distant overhead spot.
export function addHangingLamp(scene, targetPosition) {
  const group = new THREE.Group();
  // Directly above the display spot, not offset to one side.
  const lampX = targetPosition.x;
  const lampZ = targetPosition.z;
  const cordTopY = targetPosition.y + 1.1;
  const bulbY = targetPosition.y + 0.55;

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, cordTopY - bulbY, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })
  );
  cord.position.set(lampX, (cordTopY + bulbY) / 2, lampZ);
  group.add(cord);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd98a, emissiveIntensity: 2.2, roughness: 0.4 })
  );
  bulb.position.set(lampX, bulbY, lampZ);
  group.add(bulb);

  const lamp = new THREE.PointLight(0xffdf9e, 2.6, 3, 2);
  lamp.position.set(lampX, bulbY - 0.02, lampZ);
  group.add(lamp);

  scene.add(group);
  return { group, bulb, lamp };
}
