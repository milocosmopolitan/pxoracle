import * as THREE from "three";
import type { SceneInstance, TextureLeases } from "@pxoracle/scene-runtime";
import type { ViewData } from "@pxoracle/contracts";
export async function composition(
  leases: TextureLeases,
  signal: AbortSignal,
  layers: [string, number, number, number, number][],
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
      const [url, x, y, width, height] = layers[z];
      const lease = await leases.acquire(url);
      releases.push(lease.release);
      if (signal.aborted) throw new Error("aborted");
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: lease.texture,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z * 0.02);
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
    const ringGeometry = new THREE.RingGeometry(2.2, 2.215, 128);
    geometries.push(ringGeometry);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xc5b284,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    materials.push(ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(-2, 0.3, 2);
    ring.visible = mode === "astrology";
    scene.add(ring);
    const dotGeometry = new THREE.CircleGeometry(0.055, 16);
    geometries.push(dotGeometry);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xe8d7b5 });
      materials.push(m);
      const dot = new THREE.Mesh(dotGeometry, m);
      markers.add(dot);
    }
    return {
      scene,
      camera,
      enter() {
        enteredAt = null;
      },
      exit() {},
      dispose,
      update(time: number, data: ViewData, reduced: boolean) {
        if (enteredAt === null) enteredAt = time;
        const progress = reduced ? 1 : Math.min(1, (time - enteredAt) / 1.2);
        camera.zoom = 1 + 0.025 * (1 - Math.pow(1 - progress, 3));
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
          const radius = 2.2 - (i % 3) * 0.22;
          dot.position.set(
            -2 + Math.cos(angle) * radius,
            0.3 + Math.sin(angle) * radius,
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
