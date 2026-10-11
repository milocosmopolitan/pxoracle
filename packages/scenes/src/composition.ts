import * as THREE from "three";
import type { SceneInstance, TextureLeases } from "@pxoracle/scene-runtime";
import type { ViewData } from "@pxoracle/contracts";
type Crop = [left: number, top: number, right: number, bottom: number];
export type Layer = [url: string, x: number, y: number, width: number, height: number, crop?: number | Crop, appearance?: { flipX?: boolean; tint?: number }];

export async function composition(
  leases: TextureLeases,
  signal: AbortSignal,
  layers: Layer[],
  mode: "landing" | "tarot" | "astrology",
): Promise<SceneInstance> {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  camera.position.z = 20;
  const releases: (() => void)[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const markers = new THREE.Group();
  scene.add(markers);
  let disposed = false;
  let oracle: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null =
    null;
  let neutral: THREE.Texture | null = null;
  let smile: THREE.Texture | null = null;
  let enteredAt: number | null = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    releases.forEach((r) => r());
    scene.clear();
  };
  try {
    for (let z = 0; z < layers.length; z++) {
      const [url, x, y, width, height, crop = 1, appearance] = layers[z];
      const lease = await leases.acquire(url);
      releases.push(lease.release);
      if (signal.aborted) throw new Error("aborted");
      const geometry = new THREE.PlaneGeometry(width, height, 1, url === "/art/runner.webp" || url === "/art/table.webp" ? 2 : 1);
      if (url === "/art/table.webp") {
        const uv = geometry.attributes.uv;
        const positions = geometry.attributes.position;
        for (let i = 0; i < uv.count; i++) {
          const row = Math.floor(i / 2);
          uv.setY(i, [1, 0.64, 0][row]);
          if (row === 1) positions.setY(i, height * 0.14);
          if (mode === "landing" && row === 0)
            positions.setY(i, height * (0.14 + 0.36 * 0.55));
        }
      }
      if (url === "/art/runner.webp") {
        // Keep the cloth's bend on the same desk edge as every tabletop prop.
        const uv = geometry.attributes.uv;
        const positions = geometry.attributes.position;
        for (let i = 0; i < uv.count; i++) {
          const row = Math.floor(i / 2);
          uv.setY(i, [0.895, 0.69, 0.105][row]);
          if (row === 1) positions.setY(i, height * 0.19);
          // Extend the cloth to the rear edge, beneath the reading mat.
          if (row === 0)
            positions.setY(i, height * (0.19 + 0.3475 * (mode === "landing" ? 0.55 : 1)));
        }
      }
      // Separate the portrait from its painted desk without mutating shared textures.
      if (crop !== 1) {
        const [left, top, right, bottom] = typeof crop === "number" ? [0, 0, 1, crop] : crop;
        const uv = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, left + uv.getX(i) * (right - left), 1 - bottom + uv.getY(i) * (bottom - top));
        }
      }
      if (appearance?.flipX) {
        const uv = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      }
      const material = new THREE.MeshBasicMaterial({
        map: lease.texture,
        color: appearance?.tint ?? 0xffffff,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z * 0.02);
      mesh.renderOrder = z;
      scene.add(mesh);
      geometries.push(geometry);
      materials.push(material);
      if (url === "/art/oracle.webp") {
        oracle = mesh;
        neutral = lease.texture;
      }
    }
    if (oracle) {
      const lease = await leases.acquire("/art/oracle-smile.webp");
      releases.push(lease.release);
      smile = lease.texture;
      if (signal.aborted) throw new Error("aborted");
    }
    const ringGeometry = new THREE.RingGeometry(0.74, 0.75, 128);
    geometries.push(ringGeometry);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xc5b284,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    materials.push(ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(-3.4, 0.13, 2);
    ring.renderOrder = 20;
    ring.visible = mode === "astrology";
    scene.add(ring);
    const dotGeometry = new THREE.CircleGeometry(0.055, 16);
    geometries.push(dotGeometry);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xe8d7b5 });
      materials.push(m);
      const dot = new THREE.Mesh(dotGeometry, m);
      dot.renderOrder = 21;
      markers.add(dot);
    }
    return {
      scene,
      camera,
      resize(width:number,height:number){const aspect=width/Math.max(height,1);const center=aspect<1.45?-3:0;const halfWidth=Math.max(5.2,5*aspect);camera.left=center-halfWidth;camera.right=center+halfWidth;camera.top=halfWidth/aspect;camera.bottom=-halfWidth/aspect;camera.updateProjectionMatrix();},
      enter() {
        enteredAt = null;
      },
      exit() {},
      dispose,
      update(time: number, data: ViewData, reduced: boolean) {
        if (enteredAt === null) enteredAt = time;
        const progress = reduced ? 1 : Math.min(1, (time - enteredAt) / 1.2);
        camera.zoom = mode === "landing" ? 1 : 1 + 0.025 * (1 - Math.pow(1 - progress, 3));
        camera.updateProjectionMatrix();
        if (oracle && neutral && smile)
          oracle.material.map = !reduced && time % 14 > 11 ? smile : neutral;
        const bodies = data.bodies ?? [];
        markers.visible = mode === "astrology" && bodies.length > 0;
        markers.children.forEach((dot, i) => {
          const body = bodies[i];
          dot.visible = !!body;
          if (!body) return;
          const angle = (body.longitude * Math.PI) / 180;
          const radius = 0.74 - (i % 3) * 0.1;
          dot.position.set(
            -3.4 + Math.cos(angle) * radius,
            0.13 + Math.sin(angle) * radius,
            3,
          );
          dot.scale.setScalar(body.id === data.selectedBody ? 2.5 : 1.4);
        });
        ring.material.opacity = reduced
          ? 0.45
          : 0.45 + 0.08 * Math.sin(time * 0.7);
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
