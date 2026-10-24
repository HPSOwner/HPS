import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWarehouse, addWarehouseLighting, addHangingLamp } from './warehouse.js';
import { loadWeapon, disposeWeapon, setWeaponPose, setWeaponHologramMix, WEAPONS } from './weaponLoader.js';
import { loadWeaponCase } from './weaponCase.js';
import { BLUEPRINTS } from './blueprints.js';
import {
  initBlueprint3D, loadBlueprintWeapon, setPartClickHandler,
  resize as resizeBlueprint3D, startBlueprintLoop, stopBlueprintLoop,
} from './blueprint3d.js';

const app = document.getElementById('app');
const loadingEl = document.getElementById('loading');
const weaponCreditFooter = document.getElementById('weapon-credit-footer');
const blueprintPanel = document.getElementById('blueprint-panel');
const blueprintTitle = document.getElementById('blueprint-title');
const btnBlueprintClose = document.getElementById('blueprint-close');
const blueprint3dWrap = document.getElementById('blueprint-3d-wrap');
const blueprintCanvas = document.getElementById('blueprint-canvas');
const blueprintReference = document.getElementById('blueprint-reference');
const blueprintReferenceImg = document.getElementById('blueprint-reference-img');
const blueprintReferenceCitation = document.getElementById('blueprint-reference-citation');
const blueprintTabs = Array.from(document.querySelectorAll('.blueprint-tab'));
const partPopup = document.getElementById('blueprint-part-popup');
const bpPartName = document.getElementById('bp-part-name');
const bpPartSerial = document.getElementById('bp-part-serial');
const bpPartDate = document.getElementById('bp-part-date');
const bpPartPatent = document.getElementById('bp-part-patent');

let blueprint3dReady = false;
function ensureBlueprint3D() {
  if (blueprint3dReady) return;
  initBlueprint3D(blueprintCanvas);
  setPartClickHandler((info, event) => {
    bpPartName.textContent = info.name;
    bpPartSerial.textContent = info.serial;
    bpPartDate.textContent = info.made;
    bpPartPatent.textContent = info.patentRef ? `${info.patent} (Fig. ref ${info.patentRef})` : info.patent;
    const wrapRect = blueprint3dWrap.getBoundingClientRect();
    partPopup.style.left = `${event.clientX - wrapRect.left + 12}px`;
    partPopup.style.top = `${event.clientY - wrapRect.top + 12}px`;
    partPopup.classList.add('visible');
  });
  blueprint3dReady = true;
}

// --- Renderer / Scene / Camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 100);
// Dead-on in front of the case (no sideways X offset) rather than an oblique 3/4
// angle, elevated just enough to see down into the open tray.
camera.position.set(0, 0.85, 1.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0.42);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.25;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

// The default overview camera pose, captured once — used as one end of the
// lift/return camera glide, and as the fixed reference direction the displayed
// weapon orients itself "completely side-on" against (see sideOnQuaternion below).
const overviewCameraPos = camera.position.clone();
const overviewCameraTarget = controls.target.clone();

// --- Scene content ---
buildWarehouse(scene);
const { fill } = addWarehouseLighting(scene);

const caseData = await loadWeaponCase();
caseData.group.position.set(0, 0.42, 0.45);
scene.add(caseData.group);

const caseRestPos = caseData.group.position.clone().add(caseData.restLocalPosition);
const displayPos = new THREE.Vector3(0, 0.6, 0.55);
addHangingLamp(scene, displayPos);

// The lifted/displayed weapon pose (group.quaternion when fully risen) uses the
// model's raw, un-rotated source orientation — same convention blueprint3d.js relies
// on, where the model's thin/thickness axis is its "side-view" face normal. To present
// "completely side-on" to THIS fixed overview camera (not just along some arbitrary
// world axis), build a basis that maps that thin axis to the camera's actual view
// direction: the camera then sees the flat side face dead-on, with zero spin and zero
// perspective-angle skew, regardless of the camera's oblique/elevated position.
const sideOnQuaternion = (() => {
  const viewDir = new THREE.Vector3().subVectors(overviewCameraTarget, overviewCameraPos).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const upOnModel = worldUp.clone().addScaledVector(viewDir, -worldUp.dot(viewDir)).normalize();
  const lengthAxis = new THREE.Vector3().crossVectors(viewDir, upOnModel);
  const basis = new THREE.Matrix4().makeBasis(viewDir, upOnModel, lengthAxis);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
})();

// --- UI state ---
const state = {
  unpacked: false,
  unpackProgress: 0,
  hologram: false,
  hologramMix: 0,
  takendown: false,
  takedownAmount: 0,
  framedCameraPos: overviewCameraPos.clone(),
  framedCameraTarget: overviewCameraTarget.clone(),
  disassembledCameraPos: overviewCameraPos.clone(),
  disassembledCameraTarget: overviewCameraTarget.clone(),
};

// Fits a perspective-camera shot (fixed viewDir, the overview camera's own direction)
// to a world-space box with generous margin — "fairly big, but good room on all sides"
// rather than blueprint3d's edge-to-edge fit. Same corner-projection approach as
// blueprint3d's fitCameraToBox, just outputting a perspective camera position/target
// instead of an orthographic frustum.
function fitPerspectiveToBox(box, viewDir, marginFactor = 1.6) {
  const center = new THREE.Vector3();
  box.getCenter(center);
  const worldUp = new THREE.Vector3(0, 1, 0);
  let right = new THREE.Vector3().crossVectors(worldUp, viewDir).normalize();
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(viewDir, right).normalize();

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

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
    maxForward = Math.max(maxForward, Math.abs(corner.dot(viewDir)));
  }

  const distForHeight = maxUp / Math.tan(vFov / 2);
  const distForWidth = maxRight / Math.tan(hFov / 2);
  const dist = Math.max(distForHeight, distForWidth) * marginFactor + maxForward;

  const position = center.clone().addScaledVector(viewDir, -dist);
  return { position, target: center.clone() };
}

// Measures the weapon's world-space bounds in its final displayed (side-on, no-spin)
// pose, without disturbing whatever pose it's actually mid-animation to right now.
function computeFramedCamera(weapon) {
  const prevPos = weapon.group.position.clone();
  const prevQuat = weapon.group.quaternion.clone();
  weapon.group.position.copy(displayPos);
  weapon.group.quaternion.copy(sideOnQuaternion);
  weapon.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(weapon.group);
  weapon.group.position.copy(prevPos);
  weapon.group.quaternion.copy(prevQuat);
  weapon.group.updateMatrixWorld(true);

  const viewDir = new THREE.Vector3().subVectors(overviewCameraTarget, overviewCameraPos).normalize();
  return fitPerspectiveToBox(box, viewDir);
}

// Same idea as computeFramedCamera, but measures the FULLY disassembled spread (every
// part at takedownAmount 1) instead of the assembled pose — the line of separated
// parts is much wider than the assembled gun, so the assembled framing alone would
// leave most of a disassembled weapon's parts outside the visible frame. Camera eases
// between the two framings as state.takedownAmount changes (see animate()).
function computeDisassembledFramedCamera(weapon) {
  const prevPos = weapon.group.position.clone();
  const prevQuat = weapon.group.quaternion.clone();
  const prevPartPositions = weapon.parts.map((p) => p.position.clone());
  weapon.group.position.copy(displayPos);
  weapon.group.quaternion.copy(sideOnQuaternion);
  setWeaponPose(weapon, 0, 1);
  weapon.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(weapon.group);
  weapon.group.position.copy(prevPos);
  weapon.group.quaternion.copy(prevQuat);
  weapon.parts.forEach((p, i) => p.position.copy(prevPartPositions[i]));
  weapon.group.updateMatrixWorld(true);

  const viewDir = new THREE.Vector3().subVectors(overviewCameraTarget, overviewCameraPos).normalize();
  return fitPerspectiveToBox(box, viewDir, 1.15);
}

let currentWeapon = null;
let loadingWeapon = false;
const btnUnpack = document.getElementById('btn-unpack');
const btnHologram = document.getElementById('btn-hologram');
const btnTakedown = document.getElementById('btn-takedown');
const btnBlueprint = document.getElementById('btn-blueprint');
const weaponButtons = Array.from(document.querySelectorAll('.weapon-btn'));

function setWeaponButtonsEnabled(enabled) {
  weaponButtons.forEach((b) => { b.disabled = !enabled; });
}

// Disassemble only makes sense once the weapon is actually out of the case and
// floating in its fixed side-on inspection pose — animating it apart while still lying
// flat in the tray doesn't read as anything coherent. Also still gated on the model
// actually having separate parts at all (a fused weapon has no live takedown).
function updateTakedownButtonState() {
  const weapon = currentWeapon;
  const hasTakedown = !!weapon?.hasTakedown;
  btnTakedown.disabled = !hasTakedown || !state.unpacked;
  if (!hasTakedown) {
    btnTakedown.title = 'This model\'s parts are fused — see the Blueprint panel for an exploded view instead.';
  } else if (!state.unpacked) {
    btnTakedown.title = 'Lift the weapon from the case first.';
  } else {
    btnTakedown.title = '';
  }
}

async function switchWeapon(key) {
  if (loadingWeapon || (currentWeapon && currentWeapon.key === key)) return;
  loadingWeapon = true;
  setWeaponButtonsEnabled(false);
  loadingEl.textContent = `Loading ${WEAPONS[key].name}…`;
  loadingEl.style.display = 'flex';

  try {
    const weapon = await loadWeapon(key);

    if (currentWeapon) {
      scene.remove(currentWeapon.group);
      disposeWeapon(currentWeapon);
    }

    weapon.group.position.copy(state.unpackProgress > 0.5 ? displayPos : caseRestPos);
    scene.add(weapon.group);
    currentWeapon = weapon;

    const framed = computeFramedCamera(weapon);
    state.framedCameraPos = framed.position;
    state.framedCameraTarget = framed.target;
    const disassembledFramed = computeDisassembledFramedCamera(weapon);
    state.disassembledCameraPos = disassembledFramed.position;
    state.disassembledCameraTarget = disassembledFramed.target;

    state.takendown = false;
    state.takedownAmount = 0;
    btnTakedown.classList.remove('active');
    btnTakedown.textContent = 'Disassemble';
    updateTakedownButtonState();

    weaponCreditFooter.textContent = `${weapon.config.name}: ${weapon.config.credit}`;
    blueprintTitle.textContent = `${WEAPONS[key].name} — Disassembly Schematic`;
    const ref = BLUEPRINTS[key].reference;
    blueprintReferenceImg.src = ref.image;
    blueprintReferenceCitation.textContent = ref.citation;
    if (blueprintPanel.classList.contains('visible')) {
      partPopup.classList.remove('visible');
      resizeBlueprint3D();
      loadBlueprintWeapon(key);
    }

    weaponButtons.forEach((b) => b.classList.toggle('active', b.dataset.weapon === key));
  } catch (err) {
    console.error('Failed to load weapon', key, err);
    loadingEl.textContent = `Failed to load ${WEAPONS[key].name}`;
    setTimeout(() => { loadingEl.style.display = 'none'; }, 1500);
    loadingWeapon = false;
    setWeaponButtonsEnabled(true);
    return;
  }

  loadingEl.style.display = 'none';
  loadingWeapon = false;
  setWeaponButtonsEnabled(true);
}

weaponButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchWeapon(btn.dataset.weapon));
});

btnUnpack.addEventListener('click', () => {
  state.unpacked = !state.unpacked;
  btnUnpack.classList.toggle('active', state.unpacked);
  btnUnpack.textContent = state.unpacked ? 'Return To Case' : 'Lift From Case';

  // Returning to the case always reassembles first — otherwise a disassembled gun
  // would settle back into the case with its parts still scattered (one hanging
  // outside the lid), which reads as broken rather than "put away".
  if (!state.unpacked && state.takendown) {
    state.takendown = false;
    btnTakedown.classList.remove('active');
    btnTakedown.textContent = 'Disassemble';
  }
  updateTakedownButtonState();
});

btnHologram.addEventListener('click', () => {
  state.hologram = !state.hologram;
  btnHologram.classList.toggle('active', state.hologram);
  btnHologram.textContent = state.hologram ? 'End Scan' : 'Hologram Scan';
});

btnTakedown.addEventListener('click', () => {
  if (btnTakedown.disabled) return;
  state.takendown = !state.takendown;
  btnTakedown.classList.toggle('active', state.takendown);
  btnTakedown.textContent = state.takendown ? 'Reassemble' : 'Disassemble';
});

btnBlueprint.addEventListener('click', () => {
  const nowVisible = !blueprintPanel.classList.contains('visible');
  blueprintPanel.classList.toggle('visible', nowVisible);
  btnBlueprint.classList.toggle('active', nowVisible);
  if (nowVisible && currentWeapon) {
    ensureBlueprint3D();
    resizeBlueprint3D();
    loadBlueprintWeapon(currentWeapon.key);
    startBlueprintLoop();
  } else {
    stopBlueprintLoop();
    partPopup.classList.remove('visible');
  }
});
btnBlueprintClose.addEventListener('click', () => {
  blueprintPanel.classList.remove('visible');
  btnBlueprint.classList.remove('active');
  stopBlueprintLoop();
  partPopup.classList.remove('visible');
});

blueprintTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    blueprintTabs.forEach((t) => t.classList.toggle('active', t === tab));
    const showReference = tab.dataset.tab === 'reference';
    blueprintReference.classList.toggle('visible', showReference);
    blueprint3dWrap.classList.toggle('hidden', showReference);
    partPopup.classList.remove('visible');
    if (!showReference) resizeBlueprint3D();
  });
});

// --- Animation loop ---
const clock = new THREE.Clock();
const camPosScratch = new THREE.Vector3();
const camTargetScratch = new THREE.Vector3();
function lerp(a, b, t) { return a + (b - a) * t; }

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (currentWeapon) {
    const weapon = currentWeapon;

    // Unpack tween: lying flat in the case -> floating side-on display pose. No idle
    // spin at all — the gun folds out once and holds completely still, side-on, like
    // the Blueprint view but rendered as the real 3D model.
    const unpackTarget = state.unpacked ? 1 : 0;
    state.unpackProgress = lerp(state.unpackProgress, unpackTarget, 1 - Math.pow(0.001, dt));

    const riseT = THREE.MathUtils.smoothstep(state.unpackProgress, 0.0, 1.0);
    weapon.group.position.lerpVectors(caseRestPos, displayPos, riseT);

    // Rotation is intentionally NOT tied 1:1 to riseT like position is: it snaps to
    // fully side-on (facing the camera) almost immediately on lift, and only rotates
    // back toward the case's lying-flat orientation right at the very end of the
    // return — so for nearly the whole glide in either direction the gun is already
    // facing the camera straight-on, rather than visibly tumbling mid-flight.
    const rotT = THREE.MathUtils.smoothstep(riseT, 0.0, 0.2);
    weapon.group.quaternion.slerpQuaternions(weapon.restQuaternion, sideOnQuaternion, rotT);

    // Sequenced multi-step disassembly animation — each step needs enough time on
    // screen to actually read before the next one starts. Computed here, before the
    // camera glide below, since the camera framing needs this frame's value too.
    const takedownTarget = state.takendown ? 1 : 0;
    state.takedownAmount = lerp(state.takedownAmount, takedownTarget, 1 - Math.pow(0.3, dt));

    // Camera glide: eases from the warehouse overview to a shot framing the risen
    // weapon, synced to the same riseT as the fold-out, and reverses on Return To
    // Case. A second blend layered on top (by state.takedownAmount) widens the frame
    // further as the weapon disassembles — the line of separated parts is much wider
    // than the assembled gun, so the assembled framing alone would leave most parts
    // outside the visible frame. This drives camera.position/controls.target directly
    // every frame the gun is risen (or rising), which would fight free orbiting, so
    // OrbitControls stays disabled for as long as the weapon is lifted — it's a fixed
    // inspection shot by design, matching the gun's own fixed side-on pose. Orbiting
    // is only available back at the case overview.
    controls.enabled = riseT < 0.001;
    const liftedCameraPos = camPosScratch.lerpVectors(state.framedCameraPos, state.disassembledCameraPos, state.takedownAmount);
    const liftedCameraTarget = camTargetScratch.lerpVectors(state.framedCameraTarget, state.disassembledCameraTarget, state.takedownAmount);
    camera.position.lerpVectors(overviewCameraPos, liftedCameraPos, riseT);
    controls.target.lerpVectors(overviewCameraTarget, liftedCameraTarget, riseT);

    // Hologram toggle is instant — no crossfade at all. What's visible the moment you
    // press the button is the final look, so there's no transition window where edge
    // density can change or line opacity can "reveal" clutter over time.
    state.hologramMix = state.hologram ? 1 : 0;
    setWeaponHologramMix(weapon, state.hologramMix);
    fill.intensity = 1.2 + state.hologramMix * 1.2;

    setWeaponPose(weapon, 0, state.takedownAmount);
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (blueprint3dReady) resizeBlueprint3D();
});

await switchWeapon('glock19');
animate();
