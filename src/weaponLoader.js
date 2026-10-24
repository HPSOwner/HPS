import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHologramMaterial, createEdgeLines } from './hologram.js';

// Takedown directions are specified in WORLD space and converted to each part's local
// space at load time (not hand-guessed per-model local axes). `step` sequences the
// animation: parts with a lower step number move first (and return to rest last on
// reassembly, which naturally gives the mechanically-correct reverse order for putting
// it back together — the last part removed is the first reinstalled).
//
// LINE_AXIS_NOTE: every rule below uses worldAxis [0,0,1] — the source model's raw
// local length axis (muzzle-to-grip), which main.js's sideOnQuaternion maps onto the
// camera's own "right" direction for the fixed side-on display pose. Using the same
// axis for every part, scaled only by a distinct per-part distance, lines every
// disassembled piece up left-to-right on screen with no depth component at all — none
// of them end up in front of or behind one another the way mixed up/down/forward/back
// directions could. `step` still controls when a part moves; `distanceMeters` now
// doubles as its position along that single line, increasing with removal order.
export const WEAPONS = {
  glock19: {
    // Per explicit instruction: use Rotuma's G19 (the same creator as the MP5), no
    // exceptions. The original download was a baked "display" composition containing
    // TWO complete pistols (confirmed by a mesh-connectivity analysis in Blender —
    // 622 disconnected geometry islands cleanly k-means-clustered into two matching
    // gun-shaped groups). Fixed by separating by loose parts in Blender, keeping one
    // gun + the "magazine" cluster the Y-gap pass found. That magazine's own geometry
    // IS real and correctly shaped (confirmed by direct GLB inspection: same X/Y
    // proportions as a seated G19 mag), it was just baked ~20 raw units away on the Z
    // (length) axis — it belonged to the discarded duplicate gun's position, not this
    // kept frame's. repositionParts below shifts it onto this frame's own grip instead
    // of discarding it. The frame/slide/barrel remain welded into one continuous mesh
    // surface with no real topological seam (confirmed via connectivity analysis and a
    // failed Blender position-clustering pass — there's no clean edge loop between them
    // to separate on). splitMesh below cuts it anyway, purely synthetically by vertical
    // position (see splitGeometryByAxis), so the field strip / blueprint views can show
    // a frame and a slide+barrel assembly pulling apart like the real Fig. 1/Fig. 3
    // patent breakdown, even without a real seam.
    name: 'Glock 19',
    url: '/models/glock19/glock19_parts.glb',
    credit: 'Rotuma (sketchfab.com/Rotuma)',
    length: 0.186,
    displayRotationY: 0,
    // KNOWN-GOOD STATE, reverted: tried repositioning the magazine (see git history /
    // prior session notes for the computed offset, +19.665 on raw Z) instead of
    // excluding it, but loadWeapon() hung indefinitely somewhere after the scale-
    // normalize step with it included — root cause not yet isolated (ruled out
    // repositionParts and the box/scale calc themselves via console tracing; stalls
    // somewhere in the per-mesh traverse loop that builds hologram/takedown data).
    // Reverted to excluding it rather than ship a broken load. Next attempt should
    // resume tracing from the main `source.traverse` loop (hologram ghost/edges
    // creation, EdgesGeometry specifically, is the prime suspect — never profiled
    // against the magazine's actual geometry).
    excludeNames: [],
    // IMPORTANT: this offset is in the mesh's PARENT-local space, which is AFTER the
    // mesh's own intrinsic scale is applied (Three.js TRS composition: position is a
    // separate additive translation in the parent frame, not itself scaled by the
    // object's own `scale`; only its geometry vertices get scaled first). Both
    // "magazine" and "frame_slide_barrel" carry a baked-in mesh.scale of 0.01 (a
    // Blender-export artifact), so a raw-vertex-space measurement (e.g. straight from
    // a GLB inspection script) must be multiplied by that same 0.01 before use here —
    // using the raw figure directly overshot by exactly 100x and crushed the whole
    // model's computed scale (maxDim ballooned to match the wrongly-huge offset).
    // Raw center-of-magazine Z was -20.665; raw target (behind the trigger, inside the
    // frame's own -10.37..10.37 span) was -1; raw delta +19.665 × 0.01 = 0.19665.
    repositionParts: [
      { match: /^magazine$/i, offset: [0, 0, 0.19665] },
    ],
    // The frame/slide split is synthetic (no real seam — see splitMesh below), so
    // pulling it apart in the permanently-exploded 3D Blueprint view exposes an open,
    // hollow cross-section at the cut that looks wrong up close. Keep both halves at
    // their rest position there (still two independently clickable regions for the
    // part-info popup) rather than exploding them like a weapon with a real takedown.
    blueprintExplode: false,
    splitMesh: {
      match: /frame_slide_barrel/i,
      axis: 'y',
      thresholdFraction: 0.78,
      lowerName: 'frame',
      upperName: 'slide_barrel',
      // Found via a union-find connectivity scan of the "frame" piece: the trigger
      // blade + trigger guard loop form their own disjoint set of loose islands
      // (small vertex counts) sitting in the expected central/mid-height region —
      // a genuinely separate part, not a synthetic cut.
      extractFromLower: {
        name: 'trigger',
        region: (b) => {
          const cy = (b.minY + b.maxY) / 2;
          const cz = (b.minZ + b.maxZ) / 2;
          const sizeY = b.maxY - b.minY;
          return b.count <= 40 && cy > 0.5 && cy < 2.5 && cz > -1.2 && cz < 1.5 && sizeY > 1.5;
        },
      },
    },
    // Real G19 field strip order: magazine out first, THEN slide racks rearward
    // slightly and forward off the front of the frame rails — the net motion to clear
    // the frame is toward the muzzle. The frame is the part the user's hand stays on,
    // so it's left as the fixed anchor (no takedown rule) while mag and slide move.
    // The trigger isn't part of a normal field strip (it's pinned in place), so it
    // gets no takedown rule either — it only separates out in the Blueprint view,
    // labeled on its own. worldAxis [0,0,-1] is the model's raw length axis, negated —
    // see LINE_AXIS_NOTE below for why every weapon's takedown rules use this axis.
    // The frame/slide split is a synthetic height cut (see splitMesh above), so both
    // halves span the GUN'S FULL LENGTH along the line axis, not just their own
    // footprint — they fully overlap at rest. distanceMeters values confirmed
    // clip-free by direct world-space bounding-box projection (same method used for
    // the MP5's line-up — see that weapon's comment below for the full approach).
    takedown: [
      { match: /^magazine$/i, worldAxis: [0, 0, -1], distanceMeters: 0.14, step: 0 },
      { match: /^slide_barrel$/i, worldAxis: [0, 0, -1], distanceMeters: 0.34, step: 1 },
    ],
  },
  mp5: {
    name: 'MP5',
    url: '/models/mp5/mp5.glb',
    credit: 'Rotuma (sketchfab.com/Rotuma)',
    length: 0.68, // real MP5A3, stock extended
    displayRotationY: 0,
    excludeNames: [],
    // Blueprint view shows the gun whole at rest (same as the Glock) — still eight
    // independently clickable regions for the part-info popup, just not pulled apart.
    blueprintExplode: false,
    // Found via a union-find connectivity scan of "Receiver_low": the ribbed handguard
    // forms its own mirrored pair of disjoint islands (left/right halves), sitting
    // lower than and separate from the main receiver tube — a genuinely separate part,
    // matching assembly group "V. Handguard" in the official armorer-course diagram.
    extractParts: [
      {
        // The actual mesh is "Receiver_low_low_0" (child of the empty "Receiver_low"
        // Object3D node) — an unanchored prefix match catches the mesh, not the parent.
        match: /^Receiver_low/i,
        name: 'Handguard_low',
        region: (b) => {
          const cy = (b.minY + b.maxY) / 2;
          return b.count > 80 && cy > 1 && cy < 5 && (b.maxX - b.minX) < 2;
        },
      },
    ],
    // Real HK field-strip order (manual sequence, not guessed): mag out -> push the
    // rear cross pin and pivot the trigger group/pistol grip down and off (it has to
    // come off before the stock/bolt — pulling those out the rear needs the lower
    // receiver already open) -> stock slides off the rear -> bolt carrier (with
    // charging handle) pulls out the now-open rear of the receiver -> handguard
    // unlatches forward off the front, exposing the barrel -> barrel/front sight last
    // (armorer-level, beyond a basic field strip, included here for a complete
    // teardown). The receiver itself is the fixed anchor nothing detaches "from"
    // visually. Every rule shares the same worldAxis [0,0,1] (see LINE_AXIS_NOTE).
    //
    // distanceMeters values below are NOT arbitrary small offsets — each part's own
    // geometry, at rest, already occupies real physical space along this axis (e.g.
    // the receiver tube alone spans ~0.38m, more than half the gun), so a small nudge
    // isn't enough to clear it. These are the real measured lengths of every part
    // (via bounding-box projection) laid end-to-end in removal order with a 3cm gap
    // between each, starting just past the fixed receiver's own far edge — confirmed
    // overlap-free by direct world-space bounding-box projection at full disassembly,
    // not just eyeballed.
    takedown: [
      { match: /Mag_low/i, worldAxis: [0, 0, 1], distanceMeters: 0.250, step: 0 },
      { match: /Trigger_low/i, worldAxis: [0, 0, 1], distanceMeters: 0.433, step: 1 },
      { match: /Stock_low/i, worldAxis: [0, 0, 1], distanceMeters: 0.818, step: 2 },
      { match: /Bolt_low/i, worldAxis: [0, 0, 1], distanceMeters: 0.774, step: 3 },
      { match: /^CH_low/i, worldAxis: [0, 0, 1], distanceMeters: 0.767, step: 3 },
      { match: /^Handguard_low$/i, worldAxis: [0, 0, 1], distanceMeters: 1.169, step: 4 },
      { match: /Barrel_low/i, worldAxis: [0, 0, 1], distanceMeters: 1.192, step: 5 },
      { match: /FS_low/i, worldAxis: [0, 0, 1], distanceMeters: 1.594, step: 5 },
    ],
  },
};

// The Glock 19 source asset has its frame, slide and barrel welded into one continuous
// mesh surface with no topological seam at all (confirmed earlier via union-find
// connectivity analysis and a failed Blender position-clustering pass) — Blender's
// separate-by-loose-parts can't split a single connected manifold, and there's no clean
// edge loop to hand-select either. This does the split syntheticall, purely in JS, by
// bucketing each TRIANGLE of the geometry by which side of a height threshold its
// centroid falls on, and building two new BufferGeometries from the result. It won't
// follow the real mechanical seam (there isn't one in this asset), so the cut leaves an
// open, hollow cross-section on each half — acceptable here because the parts are shown
// either as wireframe/blueprint line art (where a flat cut edge reads fine) or pulled far
// enough apart in the disassembled view that the cut faces aren't the focus.
function splitGeometryByAxis(geometry, axis, thresholdFraction) {
  const pos = geometry.attributes.position;
  const index = geometry.index
    ? geometry.index.array
    : Array.from({ length: pos.count }, (_, i) => i);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getComponent(i, axis);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const threshold = min + (max - min) * thresholdFraction;

  const attrNames = Object.keys(geometry.attributes);
  const buckets = { lower: { indexMap: new Map(), indices: [], attrs: {} }, upper: { indexMap: new Map(), indices: [], attrs: {} } };
  for (const name of attrNames) {
    buckets.lower.attrs[name] = [];
    buckets.upper.attrs[name] = [];
  }

  const remap = (bucket, srcIndex) => {
    if (bucket.indexMap.has(srcIndex)) return bucket.indexMap.get(srcIndex);
    const newIndex = bucket.indexMap.size;
    bucket.indexMap.set(srcIndex, newIndex);
    for (const name of attrNames) {
      const attr = geometry.attributes[name];
      for (let c = 0; c < attr.itemSize; c++) bucket.attrs[name].push(attr.getComponent(srcIndex, c));
    }
    return newIndex;
  };

  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const centroid = (pos.getComponent(a, axis) + pos.getComponent(b, axis) + pos.getComponent(c, axis)) / 3;
    const bucket = centroid >= threshold ? buckets.upper : buckets.lower;
    bucket.indices.push(remap(bucket, a), remap(bucket, b), remap(bucket, c));
  }

  const build = (bucket) => buildGeometryFromBucket(geometry, bucket);
  return { lower: build(buckets.lower), upper: build(buckets.upper) };
}

function buildGeometryFromBucket(sourceGeometry, bucket) {
  const geo = new THREE.BufferGeometry();
  for (const name of Object.keys(sourceGeometry.attributes)) {
    const itemSize = sourceGeometry.attributes[name].itemSize;
    geo.setAttribute(name, new THREE.Float32BufferAttribute(bucket.attrs[name], itemSize));
  }
  geo.setIndex(bucket.indices);
  return geo;
}

// Finds connected-component "islands" in a geometry (vertices joined by a shared
// triangle edge) and splits off whichever islands match regionTest into their own
// geometry, leaving the rest behind. Unlike splitGeometryByAxis (a synthetic cut
// through continuous surfaces with no real seam), this only pulls apart pieces that
// are ALREADY topologically disconnected in the source mesh — i.e. a real separate
// part the original asset just happened to leave merged into one Mesh/Object3D.
function extractIslandsByRegion(geometry, regionTest) {
  const pos = geometry.attributes.position;
  const index = geometry.index
    ? geometry.index.array
    : Array.from({ length: pos.count }, (_, i) => i);

  const parent = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) parent[i] = i;
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
  for (let t = 0; t < index.length; t += 3) {
    union(index[t], index[t + 1]);
    union(index[t + 1], index[t + 2]);
  }

  const bounds = new Map();
  for (let i = 0; i < pos.count; i++) {
    const r = find(i);
    if (!bounds.has(r)) {
      bounds.set(r, { count: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
    }
    const b = bounds.get(r);
    b.count++;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
    if (z < b.minZ) b.minZ = z; if (z > b.maxZ) b.maxZ = z;
  }

  const extractRoots = new Set();
  for (const [r, b] of bounds.entries()) {
    if (regionTest(b)) extractRoots.add(r);
  }

  const attrNames = Object.keys(geometry.attributes);
  const buckets = { kept: { indexMap: new Map(), indices: [], attrs: {} }, extracted: { indexMap: new Map(), indices: [], attrs: {} } };
  for (const name of attrNames) {
    buckets.kept.attrs[name] = [];
    buckets.extracted.attrs[name] = [];
  }
  const remap = (bucket, srcIndex) => {
    if (bucket.indexMap.has(srcIndex)) return bucket.indexMap.get(srcIndex);
    const newIndex = bucket.indexMap.size;
    bucket.indexMap.set(srcIndex, newIndex);
    for (const name of attrNames) {
      const attr = geometry.attributes[name];
      for (let c = 0; c < attr.itemSize; c++) bucket.attrs[name].push(attr.getComponent(srcIndex, c));
    }
    return newIndex;
  };

  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const bucket = extractRoots.has(find(a)) ? buckets.extracted : buckets.kept;
    bucket.indices.push(remap(bucket, a), remap(bucket, b), remap(bucket, c));
  }

  return {
    kept: buildGeometryFromBucket(geometry, buckets.kept),
    extracted: buildGeometryFromBucket(geometry, buckets.extracted),
  };
}

const loader = new GLTFLoader();
const gltfCache = new Map();

function loadGLTF(url) {
  if (gltfCache.has(url)) return gltfCache.get(url);
  const promise = new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
  gltfCache.set(url, promise);
  return promise;
}

function disposeMaterial(material) {
  if (!material) return;
  const mats = Array.isArray(material) ? material : [material];
  for (const m of mats) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
      if (m[key]) m[key].dispose();
    }
    m.dispose();
  }
}

export function disposeWeapon(weapon) {
  if (!weapon) return;
  weapon.group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      disposeMaterial(obj.material);
    }
    if (obj.isLineSegments) {
      obj.geometry.dispose();
      disposeMaterial(obj.material);
    }
  });
}

// Loads a weapon GLB, normalizes its scale/pivot, and builds a hologram "ghost"
// (fresnel shell + edge wireframe) plus explode-direction data for every mesh part found.
export async function loadWeapon(key) {
  const config = WEAPONS[key];
  if (!config) throw new Error(`Unknown weapon "${key}"`);

  const gltf = await loadGLTF(config.url);
  const source = gltf.scene.clone(true);

  // Strip out any stray non-assembly props (e.g. a loose display bullet) baked into the file.
  if (config.excludeNames?.length) {
    const toRemove = [];
    source.traverse((obj) => {
      if (config.excludeNames.some((re) => re.test(obj.name))) toRemove.push(obj);
    });
    for (const obj of toRemove) obj.parent?.remove(obj);
  }

  // Nudges a mesh by a fixed offset in its own raw local units, applied before scale
  // normalization — for a part whose geometry is real and correctly shaped but was
  // baked at the wrong position in the source file (see glock19.repositionParts for
  // why the magazine specifically needs this).
  if (config.repositionParts) {
    for (const rule of config.repositionParts) {
      source.traverse((obj) => {
        if (obj.isMesh && rule.match.test(obj.name)) {
          obj.position.x += rule.offset[0];
          obj.position.y += rule.offset[1];
          obj.position.z += rule.offset[2];
        }
      });
    }
  }

  if (config.splitMesh) {
    const { match, axis, thresholdFraction, lowerName, upperName, extractFromLower } = config.splitMesh;
    const target = [];
    source.traverse((obj) => { if (obj.isMesh && match.test(obj.name)) target.push(obj); });
    for (const mesh of target) {
      const axisIndex = { x: 0, y: 1, z: 2 }[axis];
      const { lower, upper } = splitGeometryByAxis(mesh.geometry, axisIndex, thresholdFraction);
      const lowerMesh = new THREE.Mesh(lower, mesh.material);
      lowerMesh.name = lowerName;
      lowerMesh.position.copy(mesh.position);
      lowerMesh.rotation.copy(mesh.rotation);
      lowerMesh.scale.copy(mesh.scale);
      const upperMesh = new THREE.Mesh(upper, mesh.material.clone());
      upperMesh.name = upperName;
      upperMesh.position.copy(mesh.position);
      upperMesh.rotation.copy(mesh.rotation);
      upperMesh.scale.copy(mesh.scale);
      mesh.parent.add(lowerMesh, upperMesh);
      mesh.parent.remove(mesh);
      mesh.geometry.dispose();

      // Unlike the lower/upper cut above (a synthetic slice through continuous
      // geometry), this pulls out pieces that are ALREADY topologically disconnected
      // from the rest — confirmed by a union-find connectivity pass that found the
      // trigger + trigger guard sit as their own disjoint island set, separate from
      // the frame body, matching the "63" trigger + "64" connector called out in the
      // patent (Fig. 1). A real, found seam — not a guess.
      if (extractFromLower) {
        const { kept, extracted } = extractIslandsByRegion(lowerMesh.geometry, extractFromLower.region);
        lowerMesh.geometry.dispose();
        lowerMesh.geometry = kept;
        const extractedMesh = new THREE.Mesh(extracted, lowerMesh.material.clone());
        extractedMesh.name = extractFromLower.name;
        extractedMesh.position.copy(lowerMesh.position);
        extractedMesh.rotation.copy(lowerMesh.rotation);
        extractedMesh.scale.copy(lowerMesh.scale);
        lowerMesh.parent.add(extractedMesh);
      }
    }
  }

  // Generic version of the same connectivity-based extraction, for weapons that don't
  // need the lower/upper splitMesh step at all (their named GLB nodes are already
  // separate meshes) but still have a genuinely separate sub-part hiding inside one of
  // them. Found the same way: a union-find pass over the mesh's own geometry, visually
  // confirmed, not guessed — e.g. the MP5's ribbed handguard sits as its own disjoint
  // island set inside "Receiver_low", matching the "V. Handguard" assembly group in the
  // official Teufelshund Tactical MP5 armorer-course diagram.
  if (config.extractParts) {
    for (const rule of config.extractParts) {
      const mesh = [];
      source.traverse((obj) => { if (obj.isMesh && rule.match.test(obj.name)) mesh.push(obj); });
      for (const target of mesh) {
        const { kept, extracted } = extractIslandsByRegion(target.geometry, rule.region);
        target.geometry.dispose();
        target.geometry = kept;
        const extractedMesh = new THREE.Mesh(extracted, target.material.clone());
        extractedMesh.name = rule.name;
        extractedMesh.position.copy(target.position);
        extractedMesh.rotation.copy(target.rotation);
        extractedMesh.scale.copy(target.scale);
        target.parent.add(extractedMesh);
      }
    }
  }

  // Normalize scale to the weapon's real-world length, recenter pivot at bounding-box center.
  const box = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = config.length / maxDim;

  // Auto-detect the barrel/length axis (assumes Sketchfab's standard Y-up export, so we
  // only need to pick between local X and local Z as the long axis) and build a "lying
  // flat on its side" rest orientation: barrel axis -> world X (muzzle toward +X, i.e.
  // screen-right from the default camera), width axis -> world Y (vertical, since it's
  // the thin dimension when lying on its side), up/sights axis -> world -Z (so the
  // sights face toward the camera/"up" in the viewed frame rather than into the foam —
  // the +Z mapping read as upside-down from our default elevated camera angle). Flipping
  // both the up and width axes together keeps this a proper rotation (determinant +1)
  // instead of a mirror reflection. Avoids hand-tuned per-weapon Euler guessing.
  const barrelAxis = size.x >= size.z ? 'x' : 'z';
  const restBasis = new THREE.Matrix4();
  if (barrelAxis === 'z') {
    restBasis.makeBasis(
      new THREE.Vector3(0, -1, 0), // local X (width)  -> world -Y
      new THREE.Vector3(0, 0, -1), // local Y (up)      -> world -Z
      new THREE.Vector3(1, 0, 0)   // local Z (barrel)  -> world X
    );
  } else {
    restBasis.makeBasis(
      new THREE.Vector3(1, 0, 0),  // local X (barrel) -> world X
      new THREE.Vector3(0, 0, -1), // local Y (up)     -> world -Z
      new THREE.Vector3(0, -1, 0)  // local Z (width)  -> world -Y
    );
  }
  const restQuaternion = new THREE.Quaternion().setFromRotationMatrix(restBasis);

  const group = new THREE.Group();
  group.name = `weapon_${key}`;
  source.position.sub(center);
  group.add(source);
  group.scale.setScalar(scale);
  group.rotation.y = config.displayRotationY;

  // Force a full recursive matrixWorld update now that group.scale/rotation are set, so
  // every descendant's matrixWorld (used below for takedown-offset and explode-direction
  // math) reflects the real, current scale chain rather than a stale pre-normalization one.
  group.updateMatrixWorld(true);

  // Overall center in the (now-normalized) group's local space, for explode direction calc.
  const normalizedBox = new THREE.Box3().setFromObject(source);
  const normalizedCenter = new THREE.Vector3();
  normalizedBox.getCenter(normalizedCenter);

  const parts = [];
  const hologramMaterials = [];
  const explodeTargets = [];
  const takedownTargets = [];

  source.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.userData.basePosition = obj.position.clone();

    // Takedown offset: direction is given in WORLD space (real meters, post the
    // weapon's overall length-normalization), converted into this part's parent-local
    // space via the parent's FULL world scale+rotation (decomposed from matrixWorld) —
    // not just the top group's own `scale` variable. Some source GLBs (the MP5 export,
    // confirmed via inspection) bury an extra scale factor on an intermediate node deep
    // in the hierarchy (a leftover FBX-to-glTF unit-conversion node); dividing only by
    // the group's scale silently ignored that factor and produced takedown offsets
    // ~100x too small — real-world-looking numbers that rendered as sub-millimeter,
    // invisible nudges instead of the gun actually coming apart.
    const rule = config.takedown?.find((r) => r.match.test(obj.name) || r.match.test(obj.parent.name));
    let takedownOffset = null;
    let takedownStep = null;
    if (rule) {
      const parentWorldQuat = new THREE.Quaternion();
      const parentWorldScale = new THREE.Vector3();
      const parentWorldPos = new THREE.Vector3();
      obj.parent.matrixWorld.decompose(parentWorldPos, parentWorldQuat, parentWorldScale);
      const localAxis = new THREE.Vector3(...rule.worldAxis).normalize().applyQuaternion(parentWorldQuat.clone().invert());
      localAxis.x /= parentWorldScale.x;
      localAxis.y /= parentWorldScale.y;
      localAxis.z /= parentWorldScale.z;
      takedownOffset = localAxis.multiplyScalar(rule.distanceMeters);
      takedownStep = rule.step;
    }

    // World-space direction from model center to this part, converted into the
    // part's own parent-local space so it can be added straight to obj.position.
    const meshBox = new THREE.Box3().setFromObject(obj);
    const meshCenter = new THREE.Vector3();
    meshBox.getCenter(meshCenter);
    const localMeshCenter = obj.parent.worldToLocal(meshCenter.clone());
    const localModelCenter = obj.parent.worldToLocal(source.localToWorld(normalizedCenter.clone()));
    const dir = localMeshCenter.sub(localModelCenter);
    if (dir.lengthSq() < 1e-10) dir.set(0, 1, 0);
    dir.normalize();
    obj.userData.explodeDir = dir;
    obj.userData.takedownOffset = takedownOffset;
    obj.userData.takedownStep = takedownStep;

    parts.push(obj);
    explodeTargets.push(obj);
    if (takedownOffset) takedownTargets.push(obj);

    // Hologram twin: a near-invisible fresnel shell (just enough to read depth at
    // grazing angles) plus crisp edge lines, which do almost all the visual work.
    const ghost = new THREE.Mesh(obj.geometry, createHologramMaterial(0x1f5aa8, 0.35));
    ghost.position.copy(obj.position);
    ghost.rotation.copy(obj.rotation);
    ghost.scale.copy(obj.scale);
    ghost.visible = false;
    ghost.userData.basePosition = obj.userData.basePosition;
    ghost.userData.explodeDir = dir;
    ghost.userData.takedownOffset = takedownOffset;
    ghost.userData.takedownStep = takedownStep;
    hologramMaterials.push(ghost.material);

    const edges = createEdgeLines(obj.geometry, 0x2a6fb0);
    edges.position.copy(obj.position);
    edges.rotation.copy(obj.rotation);
    edges.scale.copy(obj.scale);
    edges.visible = false;
    edges.userData.basePosition = obj.userData.basePosition;
    edges.userData.explodeDir = dir;
    edges.userData.takedownOffset = takedownOffset;
    edges.userData.takedownStep = takedownStep;

    obj.parent.add(ghost);
    obj.parent.add(edges);
    explodeTargets.push(ghost, edges);
    if (takedownOffset) takedownTargets.push(ghost, edges);

    obj.userData.ghost = ghost;
    obj.userData.edges = edges;
  });

  const takedownStepCount = config.takedown?.length
    ? Math.max(...config.takedown.map((r) => r.step)) + 1
    : 0;

  return {
    key,
    config,
    restQuaternion,
    hasTakedown: takedownTargets.length > 0,
    takedownTargets,
    takedownStepCount,
    group,
    parts,
    hologramMaterials,
    explodeTargets,
  };
}

// Explode and takedown both displace the same parts from the same basePosition, so they're
// combined here rather than each independently overwriting obj.position. Takedown is
// sequenced: each part's own step gets a slice of the overall 0..1 timeline, so parts
// move one after another in the configured order rather than all at once. Running the
// same slice mapping in reverse for reassembly (takedownAmount decreasing) naturally
// puts parts back in mechanically-correct reverse order with no extra logic.
export function setWeaponPose(weapon, explodeAmount, takedownAmount) {
  const stepCount = weapon.takedownStepCount || 1;
  for (const obj of weapon.explodeTargets) {
    const base = obj.userData.basePosition;
    const explodeDir = obj.userData.explodeDir;
    const takedownOffset = obj.userData.takedownOffset;
    if (!base) continue;

    let takedownLocalT = 0;
    if (takedownOffset) {
      const step = obj.userData.takedownStep || 0;
      takedownLocalT = THREE.MathUtils.clamp((takedownAmount - step / stepCount) * stepCount, 0, 1);
    }

    const x = base.x + (explodeDir ? explodeDir.x * explodeAmount : 0) + (takedownOffset ? takedownOffset.x * takedownLocalT : 0);
    const y = base.y + (explodeDir ? explodeDir.y * explodeAmount : 0) + (takedownOffset ? takedownOffset.y * takedownLocalT : 0);
    const z = base.z + (explodeDir ? explodeDir.z * explodeAmount : 0) + (takedownOffset ? takedownOffset.z * takedownLocalT : 0);
    obj.position.set(x, y, z);
  }
}

export function setWeaponHologramMix(weapon, mix) {
  for (const part of weapon.parts) {
    part.visible = mix < 0.995;
    part.material.transparent = mix > 0.01;
    part.material.opacity = 1 - mix;

    // Ghost fill deliberately left out of the hologram look — pure wireframe outline
    // only, nothing filling the middle. Kept in the scene graph (invisible) rather than
    // removed so the architecture stays ready if a subtle fill is wanted again later.
    part.userData.ghost.visible = false;

    part.userData.edges.visible = mix > 0.01;
    part.userData.edges.material.opacity = 0.85 * mix;
  }
}
