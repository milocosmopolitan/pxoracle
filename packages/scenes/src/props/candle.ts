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
    // Exclude the painted dark wick; the authored 3D wick reaches the flame tip.
    float bright = step(0.12, max(rgb.r, max(rgb.g, rgb.b)));
    return max(upper, lower * bright);
  }
`;

/** Only the flame island is sampled; the body and holder are authored geometry. */
function flameMaterial(texture: THREE.Texture) {
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, alphaTest: 0.02, depthWrite: false, toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>",
      "#include <uv_vertex>\n vMapUv = vec2(0.445, 0.674) + vMapUv * vec2(0.120, 0.236);");
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", mask + "\nvoid main() {");
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>",
      "#include <map_fragment>\n diffuseColor.a *= candleFlameMask(vMapUv, diffuseColor.rgb);");
  };
  material.customProgramCacheKey = () => "candle-original-flame-sprite-v2";
  return material;
}

// Closed sculpted wax surface, including the raised rivulets and uneven lip.
const DRIPS = [[.18,.22,.14], [1.03,.12,.11], [1.72,.28,.12], [2.43,.17,.15],
  [3.2,.24,.09], [3.93,.09,.14], [4.61,.30,.12], [5.36,.16,.13], [5.98,.07,.12]];
function rim(theta: number) {
  return .700 + .006 * Math.sin(theta * 5 + .3) + .0035 * Math.sin(theta * 11 - .7);
}
function waxGeometry() {
  const sides = 96, rows = 36, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const addRing = (radius: (theta: number) => number, height: (theta: number) => number, v: number) => {
    const ringIndex = positions.length / 3;
    for (let x = 0; x <= sides; x++) {
      const theta = x / sides * Math.PI * 2, r = radius(theta);
      positions.push(Math.sin(theta) * r, height(theta), Math.cos(theta) * r);
      uvs.push(x / sides, v);
      if (ringIndex && x < sides) {
        const a = ringIndex + x, b = a - sides - 1;
        indices.push(b, b + 1, a, a, b + 1, a + 1);
      }
    }
  };
  addRing(() => 0, () => .13, 0);
  for (let y = 0; y <= rows; y++) {
    const t = y / rows;
    addRing(theta => {
      const height = .13 + t * (rim(theta) - .13);
      let radius = .251 + .004 * t + .0018 * Math.sin(theta * 13 + t * 3);
      for (const [angle, length, width] of DRIPS) {
        const distance = Math.atan2(Math.sin(theta - angle), Math.cos(theta - angle));
        const progress = (rim(theta) - height) / length;
        if (progress >= 0 && progress < 1) {
          const tip = THREE.MathUtils.smoothstep(1 - progress, 0, .12);
          radius += .014 * Math.exp(-2 * (distance / width) ** 2) * tip;
        }
      }
      return radius;
    }, theta => .13 + t * (rim(theta) - .13), t);
  }
  // Roll the lip inward into a recessed liquid wax well; no open cylinder or paper cap.
  for (const [radius, y, ripple] of [[.249,.700,1], [.235,.688,.5], [.214,.674,.15],
    [.175,.667,0], [.105,.665,0], [.04,.666,0], [0,.667,0]]) {
    addRing(() => radius, theta => y + (rim(theta) - .700) * ripple, 1 + (.255 - radius));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Deterministic painted stipple/strokes generated locally, never sampled from licensed imagery. */
function paintedSurface(brass: boolean) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = hash(x + y * size, brass ? 317 : 971) * .045;
    const stroke = brass ? Math.sin(x * .24) * Math.sin(y * .19) * .06
      : Math.sin(Math.floor(x / 3) * 1.31) * .045 + Math.sin(y * .13 + x * .2) * .025;
    const c = brass ? [.72, .53, .27] : [.88, .70, .43];
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(Math.min(1, c[channel] + grain + stroke) * 255);
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
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
  const textures: THREE.Texture[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    lease.release();
  };
  try {
    const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
      geometries.push(geometry);
      const object = new THREE.Mesh(geometry, material); object.name = name;
      object.castShadow = object.receiveShadow = true;
      group.add(object); return object;
    };
    const waxMap = paintedSurface(false); textures.push(waxMap);
    const brassMap = paintedSurface(true); textures.push(brassMap);
    const wax = new THREE.MeshStandardMaterial({ map: waxMap, roughness: .79, metalness: 0 });
    // Finite flame/wax diffusion bounds the point emitter singularity on nearby wax.
    // This material alone caps near-field point irradiance; lamp spot lighting is unchanged.
    wax.onBeforeCompile = (shader) => {
      const lights = THREE.ShaderChunk.lights_pars_begin.replace(
        "getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay )",
        "getDistanceAttenuation( max( lightDistance, 0.6 ), pointLight.distance, pointLight.decay )",
      );
      shader.fragmentShader = shader.fragmentShader.replace("#include <lights_pars_begin>", lights);
    };
    wax.customProgramCacheKey = () => "candle-wax-finite-emitter-v1";
    const brass = new THREE.MeshStandardMaterial({ map: brassMap, roughness: .43, metalness: .73 });
    const polish = new THREE.MeshStandardMaterial({ color: 0xc49b4c, roughness: .32, metalness: .8 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x241b12, roughness: 1 });
    materials.push(wax, brass, polish, charcoal);
    mesh("candle-sculpted-wax", waxGeometry(), wax);
    const profile = [[0,0],[.31,0],[.325,.012],[.412,.012],[.448,.028],[.458,.048],
      [.456,.074],[.446,.085],[.434,.084],[.428,.069],[.419,.05],[.294,.044],
      [.284,.053],[.28,.144],[.274,.159],[.263,.159],[.259,.146],[.26,.086],[0,.086]];
    mesh("candle-turned-brass-holder", new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 96), brass);
    for (const [name, radius, tube, y] of [["saucer-rolled-rim", .444,.006,.083], ["socket-bead",.273,.006,.157]] as const) {
      const bead = mesh(name, new THREE.TorusGeometry(radius, tube, 8, 96), polish);
      bead.rotation.x = Math.PI / 2; bead.position.y = y;
    }
    const wick = new THREE.Group();
    wick.name = "candle-wick";
    wick.position.set(CANDLE_WICK.x, CANDLE_WICK.y, CANDLE_WICK.z);
    group.add(wick);
    const wickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(CANDLE_WICK.x, .665, CANDLE_WICK.z),
      new THREE.Vector3(CANDLE_WICK.x - .007, .707, CANDLE_WICK.z),
      new THREE.Vector3(CANDLE_WICK.x, CANDLE_WICK.y, CANDLE_WICK.z),
    ]);
    mesh("candle-charred-wick", new THREE.TubeGeometry(wickCurve, 10, .006, 7, false), charcoal);
    const flamePaint = flameMaterial(lease.texture); materials.push(flamePaint);
    const flame = new THREE.Sprite(flamePaint);
    // Sprite defaults to global geometry; own a clone so teardown releases its GPU buffers.
    flame.geometry = flame.geometry.clone(); geometries.push(flame.geometry);
    flame.name = "candle-single-flame";
    const flameWidth = 1.21 * 875 / 900 * .120, flameHeight = 1.21 * .236;
    // The pivot is the original wick tip inside the crop, not the center of the billboard.
    flame.center.set(.5, (.690 - .674) / .236);
    flame.scale.set(flameWidth, flameHeight, 1);
    // Room plates draw in layers; the flame blends later while retaining real mesh occlusion.
    flame.renderOrder = 15;
    wick.add(flame);
    const light = new THREE.PointLight(0xffb55c, 1.2, 2.5, 2);
    light.name = "candle-wick-light";
    light.castShadow = false;
    wick.add(light);
    const update = (time: number, reducedMotion = false, active = true) => {
      if (disposed || !active) return;
      const n = candleSignal(time, reducedMotion);
      flamePaint.rotation = n * 0.065;
      flame.scale.set(flameWidth * (1 - n * 0.055), flameHeight * (1 + n * 0.06), 1);
      flamePaint.opacity = 0.95 + n * 0.04;
      light.intensity = 1.2 * (1 + n * 0.085);
    };
    update(0, true);
    return { group, wick, light, update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
