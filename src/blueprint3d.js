import * as THREE from 'three';
import { loadWeapon, disposeWeapon } from './weaponLoader.js';
import { getPartInfo } from './partCatalog.js';

// A dedicated, non-interactive 3D viewer: fixed camera (no orbit), every part
// permanently separated, white-on-blue "cyanotype" blueprint rendering, parts
// individually clickable via raycasting.

const BLUEPRINT_BLUE = 0x0a2a52;
const LINE_COLOR = 0xdfeeff;

// Unlike the main scene, this viewer resets the weapon group's rotation to identity
// (see loadBlueprintWeapon) rather than applying the computed rest orientation, so it
// renders in the raw source model's own natural pose — confirmed via bounding-box
// inspection to be barrel-length along Z, true vertical (grip-to-sights) along Y, and
// thickness (left-right) along the thin X axis. A true dead-on side profile — length
// horizontal, height vertical, like a catalog photo — means looking straight down that
// thin X axis, with ordinary world-Y as "up" (it already is vertical here).
const VIEW_DIR = new THREE.Vector3(1, 0, 0);
const VIEW_UP = new THREE.Vector3(0, 1, 0);

let renderer, scene, camera, raycaster, mouse;
let currentWeapon = null;
let canvasEl = null;
let rafId = null;
let onPartClick = null;

export function initBlueprint3D(canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(BLUEPRINT_BLUE);

  // Orthographic, not perspective — a true flat technical-drawing look with zero
  // perspective skew, viewed dead-on from the side (camera sits on the world -Z axis,
  // the direction the sights face per the rest-orientation convention below) rather
  // than at any elevated/oblique angle. Frustum bounds are set per-weapon in
  // fitCameraToBox(); near/far are placeholders until the first fit.
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  camera.up.copy(VIEW_UP);
  camera.position.copy(VIEW_DIR);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambient);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  canvas.addEventListener('click', handleClick);
  resize();
}

function buildBlueprintMaterial() {
  return new THREE.MeshBasicMaterial({ color: BLUEPRINT_BLUE, transparent: false });
}

function buildEdgeMaterial() {
  return new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: 0.95 });
}

export async function loadBlueprintWeapon(key) {
  if (currentWeapon) {
    scene.remove(currentWeapon.group);
    disposeWeapon(currentWeapon);
    currentWeapon = null;
  }

  const weapon = await loadWeapon(key);
  weapon.group.quaternion.identity();
  weapon.group.rotation.set(0, 0, 0);
  weapon.group.position.set(0, 0, 0);

  // Recolor every solid part as a flat blueprint-blue fill (reads as "paper" behind the
  // white linework rather than full dark-warehouse PBR materials) and keep only the edge
  // lines bright — true cyanotype look. Ghost fresnel shells aren't used here at all.
  const clickable = [];
  for (const part of weapon.parts) {
    part.material = buildBlueprintMaterial();
    part.userData.edges.material = buildEdgeMaterial();
    part.userData.edges.visible = true;
    part.userData.ghost.visible = false;
    clickable.push(part);
  }

  // Permanently exploded: every part pushed out so the whole assembly reads as "every
  // single part separated" at a glance — not animated, this view never un-explodes.
  // Parts with a real takedown offset use its ACTUAL vector (direction AND relative
  // distance), just scaled up for dramatic blueprint spacing — important now that every
  // weapon's takedown rules share one line-axis direction (see LINE_AXIS_NOTE in
  // weaponLoader.js) and differ only in distance: normalizing away that distance would
  // collapse every part back onto the same spot. Parts with no takedown rule (receiver,
  // the fixed anchor) fall back to their generic radial-from-center direction. Weapons
  // whose "parts" are a synthetic cut rather than a real seam (config.blueprintExplode
  // === false) stay at rest instead — still separately clickable, just not pulled apart.
  if (weapon.config.blueprintExplode !== false) {
    const lineScale = 3;
    const radialAmount = weapon.config.length * 2.2;
    for (const part of weapon.parts) {
      const base = part.userData.basePosition;
      const takedownOffset = part.userData.takedownOffset;
      const offset = takedownOffset
        ? takedownOffset.clone().multiplyScalar(lineScale)
        : part.userData.explodeDir.clone().multiplyScalar(radialAmount);
      part.position.copy(base).add(offset);
      part.userData.ghost.position.copy(part.position);
      part.userData.edges.position.copy(part.position);
    }
  }

  scene.add(weapon.group);
  currentWeapon = weapon;

  const box = new THREE.Box3().setFromObject(weapon.group);
  fitCameraToBox(box, VIEW_DIR);

  return weapon;
}

// Fits the orthographic camera's frustum to a bounding box for a given (axis-aligned)
// viewing direction, by projecting every box corner onto the camera's right/up/forward
// axes and sizing the frustum to those extents — not a single-number "maxDim * constant"
// guess, which badly over/under-fits for lopsided layouts (e.g. a small gun cluster far
// from a small separated magazine). marginFactor is kept small so the exploded weapon
// fills the canvas right up to (but never quite touching) its edges.
function fitCameraToBox(box, dirVector, marginFactor = 1.04) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const dir = dirVector.clone().normalize();

  // Use the camera's actual up-hint as the reference (not a hardcoded world axis) so
  // this matches whatever screen orientation camera.lookAt() + camera.up actually
  // produce — important now that the view direction itself can be the Y axis.
  let right = new THREE.Vector3().crossVectors(VIEW_UP, dir).normalize();
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();

  let maxRight = 0.001, maxUp = 0.001, maxForward = 0.001;
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z
    ).sub(center);
    maxRight = Math.max(maxRight, Math.abs(corner.dot(right)));
    maxUp = Math.max(maxUp, Math.abs(corner.dot(up)));
    maxForward = Math.max(maxForward, Math.abs(corner.dot(dir)));
  }

  // Whichever axis (vertical or horizontal) is more constrained by the canvas aspect
  // decides the frustum size, so the shape touches that axis's edges and is inset on
  // the other — "fills the box without touching the sides" on both axes at once.
  const aspect = (canvasEl.clientWidth || 1) / (canvasEl.clientHeight || 1);
  let halfHeight = maxUp * marginFactor;
  let halfWidth = maxRight * marginFactor;
  if (halfWidth / halfHeight > aspect) {
    halfHeight = halfWidth / aspect;
  } else {
    halfWidth = halfHeight * aspect;
  }

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;

  const dist = maxForward + size.length() + 1;
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);
  camera.near = 0.01;
  camera.far = dist + maxForward + size.length() + 1;
  camera.updateProjectionMatrix();
}

export function setPartClickHandler(fn) {
  onPartClick = fn;
}

function handleClick(event) {
  if (!currentWeapon) return;
  const rect = canvasEl.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(currentWeapon.parts, false);
  if (intersects.length === 0) return;

  const hit = intersects[0].object;
  const info = getPartInfo(currentWeapon.key, hit.name, hit.parent?.name || '');
  if (info && onPartClick) onPartClick(info, event);
}

export function resize() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth || 1;
  const h = canvasEl.clientHeight || 1;
  renderer.setSize(w, h, false);
  // Orthographic frustum bounds are tied to the canvas aspect, not a single `.aspect`
  // scalar — re-fit to the current weapon (if any) so a window resize while the panel
  // is open doesn't stretch/skew the view.
  if (currentWeapon) {
    const box = new THREE.Box3().setFromObject(currentWeapon.group);
    fitCameraToBox(box, VIEW_DIR);
  } else {
    camera.updateProjectionMatrix();
  }
}

export function startBlueprintLoop() {
  if (rafId) return;
  const tick = () => {
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

export function stopBlueprintLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
