import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";

export const CANDLE_TEXTURE = "/art/candle.webp";
export const CANDLE_WICK = { x: 0.004, y: 0.736, z: 0.012 } as const;

// Seeded value noise is sampled from absolute seconds, so resume never integrates a large delta.
function hash(n: number, seed: number): number {
    let x = Math.imul(n ^ seed, 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
}
function noise(t: number, seed: number): number {
  const i = Math.floor(t), f = t - i;
  return THREE.MathUtils.lerp(hash(i, seed), hash(i + 1, seed), f * f * (3 - 2 * f));
}

/** Pure deterministic sample for component tests and fixed Storybook capture times. */
export function candleSignal(seconds: number, reducedMotion = false): number {
  if (reducedMotion || !Number.isFinite(seconds)) return 0;
  return 0.72 * noise(seconds * 1.7, 1973) + 0.28 * noise(seconds * 3.1, 7187);
}

const mask = `
  // UV coordinates refer to the original 875 x 900 plate, with origin at bottom left.
  float candleFlameMask(vec2 p, vec3 rgb) {
    float lower = step(0.674, p.y) * step(0.483, p.x) * step(p.x, 0.540);
    float upper = step(0.695, p.y);
    // The near-black wick remains on the body even where it overlaps the flame tip.
    float bright = step(0.12, max(rgb.r, max(rgb.g, rgb.b)));
    return max(upper, lower * bright);
  }
`;

function splitMaterial(texture: THREE.Texture, flame: boolean) {
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: 0.02,
    depthWrite: !flame, side: THREE.DoubleSide, toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", mask + "\nvoid main() {");
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>\nfloat splitAlpha = candleFlameMask(vMapUv, diffuseColor.rgb);\ndiffuseColor.a *= ${flame ? "splitAlpha" : "(1.0 - splitAlpha)"};`,
    );
  };
  material.customProgramCacheKey = () => flame ? "candle-flame-v1" : "candle-body-v1";
  return material;
}

/** Y-up prop with base y=0. Owns local objects; shared artwork is acquired once and released. */
export async function createCandle(leases: Pick<TextureLeases, "acquire">, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Candle preparation canceled", "AbortError");
  const lease = await leases.acquire(CANDLE_TEXTURE);
  if (signal.aborted) {
    lease.release();
    throw new DOMException("Candle preparation canceled", "AbortError");
  }
  const group = new THREE.Group();
  group.name = "candle-prop";
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    lease.release();
  };
  try {
    // Use original UVs on both pieces. Moving a flame-only crop cannot expose a second flame.
    const height = 1.21, width = height * 875 / 900;
    const bodyGeometry = new THREE.PlaneGeometry(width, height);
    geometries.push(bodyGeometry);
    bodyGeometry.translate(0, height * (0.5 - 0.083), 0);
    const bodyMaterial = splitMaterial(lease.texture, false);
    materials.push(bodyMaterial);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.name = "candle-original-body";
    group.add(body);
    const wick = new THREE.Group();
    wick.name = "candle-wick";
    wick.position.set(CANDLE_WICK.x, CANDLE_WICK.y, CANDLE_WICK.z);
    group.add(wick);
    // Crop the flame draw to its alpha island; the pivot is the retained wick tip.
    const u0 = 0.445, u1 = 0.565, v0 = 0.674, v1 = 0.91;
    const flameGeometry = new THREE.PlaneGeometry(width * (u1 - u0), height * (v1 - v0));
    geometries.push(flameGeometry);
    const uv = flameGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    flameGeometry.translate(width * ((u0 + u1) / 2 - 0.5) - CANDLE_WICK.x,
      height * ((v0 + v1) / 2 - 0.083) - CANDLE_WICK.y, 0);
    const flameMaterial = splitMaterial(lease.texture, true);
    materials.push(flameMaterial);
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.name = "candle-single-flame";
    // Room illustration plates render in layers; flame blends after them but still tests solid depth.
    flame.renderOrder = 15;
    wick.add(flame);
    const light = new THREE.PointLight(0xffb55c, 1.2, 2.5, 2);
    light.name = "candle-wick-light";
    light.castShadow = false;
    wick.add(light);
    const update = (time: number, reducedMotion = false, active = true) => {
      if (disposed || !active) return;
      const n = candleSignal(time, reducedMotion);
      flame.rotation.z = n * 0.065;
      flame.scale.set(1 - n * 0.055, 1 + n * 0.06, 1);
      flameMaterial.opacity = 0.95 + n * 0.04;
      light.intensity = 1.2 * (1 + n * 0.085);
    };
    update(0, true);
    return { group, wick, light, update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
