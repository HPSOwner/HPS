import * as THREE from 'three';

// Static fresnel rim only — no time-based scanline/flicker (that was reading as a
// flashing glitch after the initial crossfade). Center of each part stays almost fully
// see-through; only grazing-angle edges pick up a faint glow, so the wireframe lines
// (see createEdgeLines) do the actual "outline" work.
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), 3.5);
    float alpha = fresnel * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createHologramMaterial(color = 0x1f5aa8, opacity = 1.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}

export function createEdgeLines(geometry, color = 0x3a8fd0) {
  // Threshold angle is in DEGREES, not radians. The real "spawning in" bug was the
  // animated opacity crossfade (now instant, see setWeaponHologramMix) — the previous
  // fix of raising this to 35° also stripped out real detail edges the user wanted to
  // see. 8° filters only true micro-noise (coplanar triangulation seams) while keeping
  // every actual structural edge/bevel, now that there's no fade to reveal them over time.
  const edges = new THREE.EdgesGeometry(geometry, 8);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
  });
  return new THREE.LineSegments(edges, material);
}

// No-op now that the shader is static, kept so callers don't need to change.
export function updateHologramUniforms() {}
