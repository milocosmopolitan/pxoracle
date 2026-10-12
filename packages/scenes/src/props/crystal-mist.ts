import * as THREE from "three";

/**
 * Mist that rises and blooms inside the painted crystal ball. One additive quad over the glass with a
 * procedural shader (value-noise fbm, domain warp and drifting sparkles), so it needs no textures and no
 * post-processing pass. Inspired by the crystal-ball reference set (glow overlay, pulse states, particle
 * seed); none of those images are shipped.
 *
 * `bloom` 0 is dormant (the quad is hidden and costs nothing); 1 is the full rising mist. The fill climbs
 * from the bottom of the glass as bloom grows, so a hover reads as the mist rising.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uBloom;
  uniform vec3 uDeep;
  uniform vec3 uGlow;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float t = uTime;
    // The mass drifts upward and turns slowly about the ball's vertical axis.
    float swirl = 0.55 * (1.0 - r) + 0.08 * sin(t * 0.4);
    vec2 q = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl)) * p;
    vec2 flow = vec2(0.0, -t * 0.22);
    vec2 warp = vec2(fbm(q * 1.4 + flow + 3.1), fbm(q * 1.4 + flow - 5.7));
    float density = fbm(q * 1.8 + warp * 1.3 + flow * 1.6);
    density = smoothstep(0.38, 0.86, density);
    // Fill rises from the bottom of the glass with the bloom, its edge breathing a little.
    float front = mix(-1.25, 1.15, uBloom) + 0.08 * sin(t * 0.9 + p.x * 3.0);
    float fill = smoothstep(front + 0.45, front - 0.25, p.y);
    float glass = smoothstep(1.0, 0.72, r);
    float core = exp(-dot(p - vec2(0.0, -0.08), p - vec2(0.0, -0.08)) * 3.2);
    float pulse = 0.86 + 0.14 * sin(t * 1.3);
    // Motes drift upward through the mist: one hashed point per cell, twinkling.
    vec2 cell = p * 5.5 + vec2(0.0, -t * 0.45);
    vec2 id = floor(cell);
    float seed = hash(id);
    vec2 spot = vec2(hash(id + 7.3), hash(id + 1.9)) * 0.6 + 0.2;
    float mote = smoothstep(0.09, 0.0, length(fract(cell) - spot)) * step(0.72, seed);
    mote *= 0.6 + 0.4 * sin(t * 3.0 + seed * 40.0);
    vec3 mist = mix(uDeep, uGlow, density) * (density * fill * 0.95 + core * 0.55 * uBloom) * pulse;
    vec3 color = (mist + uGlow * mote * fill * 1.4) * glass * uBloom;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface CrystalMist {
  mesh: THREE.Mesh;
  /** Current bloom after smoothing. */
  readonly bloom: number;
  /** Advances toward `target`; returns true while the bloom is still changing. */
  update(time: number, target: number, reduced: boolean): boolean;
  dispose(): void;
}

export function createCrystalMist(radius: number): CrystalMist {
  const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBloom: { value: 0 },
      uDeep: { value: new THREE.Color(0x0e4a5c) },
      uGlow: { value: new THREE.Color(0x8ff0ff) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "crystal-mist";
  mesh.renderOrder = 22;
  mesh.visible = false;
  let bloom = 0, last: number | null = null, dead = false;
  return {
    mesh,
    get bloom() { return bloom; },
    update(time, target, reduced) {
      if (dead) return false;
      const dt = last === null ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      // About 0.7 s to bloom, a little slower to settle back to dormant.
      bloom = reduced ? target : bloom + (target - bloom) * (1 - Math.exp(-dt * (target > bloom ? 4.2 : 2.6)));
      if (Math.abs(target - bloom) < 0.002) bloom = target;
      // Reduced motion shows one still, fully formed frame instead of drifting mist.
      material.uniforms.uTime.value = reduced ? 6.5 : time;
      material.uniforms.uBloom.value = bloom;
      mesh.visible = bloom > 0.002;
      return bloom !== target;
    },
    dispose() {
      if (dead) return;
      dead = true;
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
