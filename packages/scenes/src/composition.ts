import * as THREE from "three";
import { createStudyProps } from "./study-props";
import { studyDesk } from "./study-table";
import type { SceneInstance, TextureLeases } from "@pxoracle/scene-runtime";
import type { ViewData } from "@pxoracle/contracts";
type Crop = [left: number, top: number, right: number, bottom: number];
export type Layer = [url: string, x: number, y: number, width: number, height: number, crop?: number | Crop, appearance?: { flipX?: boolean; tint?: number; /** World z instead of the layer-order depth. */ z?: number; /** Lie flat on the tabletop (height becomes depth). */ flat?: boolean }];

export async function composition(
  leases: TextureLeases,
  signal: AbortSignal,
  layers: Layer[],
  mode: "landing" | "tarot" | "astrology",
  options: { pitch?: number; /** Which painted room's desk the runner drapes over when the caller owns props. */ desk?: "landing" | "astrology" } = {},
): Promise<SceneInstance> {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  // A small downward pitch shows the real tabletop; billboards keep their painted size.
  const pitch = THREE.MathUtils.degToRad(options.pitch ?? 0);
  camera.position.set(0, 20 * Math.sin(pitch), 20 * Math.cos(pitch));
  camera.lookAt(0, 0, 0);
  const desk = options.desk ? studyDesk(options.desk) : mode === "tarot" ? null : studyDesk(mode);
  const releases: (() => void)[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const markers = new THREE.Group();
  scene.add(markers);
  let disposed = false;
  let props: Awaited<ReturnType<typeof createStudyProps>> | undefined;
  let oracle: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null =
    null;
  let neutral: THREE.Texture | null = null;
  let smile: THREE.Texture | null = null;
  let enteredAt: number | null = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    props?.dispose();
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
      const geometry = new THREE.PlaneGeometry(width, height, 1, url === "/art/runner.webp" ? 2 : 1);
      const meshZ = appearance?.z ?? z * 0.02;
      if (url === "/art/runner.webp" && desk) {
        // Drape the cloth over the real desk: the top row lies on the tabletop, the
        // middle row sits on the front edge and the bottom hangs down the apron.
        const uv = geometry.attributes.uv;
        const positions = geometry.attributes.position;
        const lie = Math.min(desk.depth * 0.33, height * 0.3475);
        for (let i = 0; i < uv.count; i++) {
          const row = Math.floor(i / 2);
          uv.setY(i, [0.895, 0.69, 0.105][row]);
          if (row === 0) { positions.setY(i, desk.top + 0.002 - y); positions.setZ(i, desk.front - lie - meshZ); }
          if (row === 1) { positions.setY(i, desk.top + 0.006 - y); positions.setZ(i, desk.front + 0.015 - meshZ); }
          if (row === 2) { positions.setY(i, desk.top - height * 0.55 - y); positions.setZ(i, desk.front + 0.02 - meshZ); }
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
        depthWrite: true,
        alphaTest: 0.025,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, meshZ);
      if (appearance?.flat) mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = z;
      scene.add(mesh);
      geometries.push(geometry);
      materials.push(material);
      if (url === "/art/oracle.webp") {
        oracle = mesh;
        neutral = lease.texture;
      }
    }
    if (mode !== "tarot") {
      props = await createStudyProps(leases, signal, mode);
      scene.add(props.group);
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
      setShadows(enabled) { props?.lamp.setShadows(enabled); },
      scene,
      camera,
      resize(width:number,height:number){const aspect=width/Math.max(height,1);const center=aspect<1.45?-3:0;const halfWidth=Math.max(5.2,5*aspect);camera.left=center-halfWidth;camera.right=center+halfWidth;camera.top=halfWidth/aspect*Math.cos(pitch);camera.bottom=-halfWidth/aspect*Math.cos(pitch);camera.updateProjectionMatrix();},
      enter() {
        enteredAt = null;
      },
      exit() {},
      dispose,
      update(time: number, data: ViewData, reduced: boolean) {
        props?.update(time, reduced);
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
