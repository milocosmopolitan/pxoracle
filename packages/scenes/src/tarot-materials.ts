import * as THREE from "three";
import type { RigOwner } from "./tarot-rig";

/** Technical UV relief maps, not baked lighting: PBR lights supply the shading. */
export function surfaceMaterial(
  kind: "skin" | "cloth" | "wood",
  albedo: THREE.Texture,
  owner: RigOwner,
) {
  const size = 128,
    heights = new Float32Array(size * size);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      heights[y * size + x] =
        kind === "cloth"
          ? 0.5 +
            0.17 * Math.sin(tau * u * 32) * Math.sin(tau * v * 32) +
            0.07 * Math.sin(tau * v * 4)
          : kind === "wood"
            ? 0.5 +
              0.18 * Math.sin(tau * (v * 18 + 0.17 * Math.sin(tau * u * 2))) +
              0.06 * Math.sin(tau * v * 43)
            : 0.5 +
              0.05 * Math.sin(tau * (u * 11 + 0.4 * Math.sin(tau * v * 3))) +
              0.035 * Math.sin(tau * v * 29) * Math.sin(tau * u * 31);
    }
  const normal = new Uint8Array(size * size * 4),
    rough = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = new THREE.Vector3(
        (at(x - 1, y) - at(x + 1, y)) * 2,
        (at(x, y - 1) - at(x, y + 1)) * 2,
        1,
      ).normalize();
      const i = (y * size + x) * 4;
      normal.set(
        [
          Math.round((n.x * 0.5 + 0.5) * 255),
          Math.round((n.y * 0.5 + 0.5) * 255),
          Math.round((n.z * 0.5 + 0.5) * 255),
          255,
        ],
        i,
      );
      const r = Math.round(
        (kind === "wood" ? 0.65 : kind === "skin" ? 0.83 : 0.94) * 255 +
          heights[y * size + x] * 12,
      );
      rough.set([r, r, r, 255], i);
    }
  const map = albedo.clone(),
    normalMap = new THREE.DataTexture(normal, size, size),
    roughnessMap = new THREE.DataTexture(rough, size, size);
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    owner.cleanup?.(() => texture.dispose());
  }
  normalMap.colorSpace = roughnessMap.colorSpace = THREE.NoColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap,
    roughness: 1,
    metalness: 0,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });
  if (kind === "cloth") material.color.setRGB(0.62, 0.65, 0.88);
  if (kind === "skin") material.color.setRGB(0.84, 0.8, 0.8);
  owner.material(material);
  return material;
}
