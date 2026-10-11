import * as THREE from "three";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import type { TarotView } from "@pxoracle/contracts";
import { composition } from "./composition";
import { studyLayers } from "./study";
const ease = (x: number) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
const durations: Record<string, number> = {
  approach: 1.4,
  shuffle: 2.2,
  fan: 0.8,
  dealing: 1.8,
  revealing: 1.35,
};
export function slotPosition(slot: number, page: number, mobile: boolean) {
  const n = slot - page * 12,
    columns = mobile ? 4 : 6;
  return new THREE.Vector3(
    ((n % columns) - (columns - 1) / 2) * (mobile ? 1.35 : 1.45),
    2.25 - Math.floor(n / columns) * 1.65,
    0.045,
  );
}
export function spreadPosition(index: number, count: number, mobile: boolean) {
  return new THREE.Vector3(
    (index - (count - 1) / 2) * 1.95,
    mobile ? -3 : -2.1,
    0.06,
  );
}
export const createScene: SceneFactory = async (leases, signal) => {
  const base = await composition(
    leases,
    signal,
    studyLayers("tarot").filter(([url]) => url !== "/art/three-cards.webp"),
    "tarot",
  );
  const releases: (() => void)[] = [],
    geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  let dead = false,
    current: TarotView | undefined,
    revision = -1,
    started = 0,
    sent = false,
    mobile = false,
    width = 1,
    height = 1;
  let faceKey = "";
  let loadDirty = false;
  let tableauMix = 0;
  let cameraMix = 0,
    targetMix = 0,
    lastTime = 0,
    loadGeneration = 0;
  const faceReleases = new Map<string, () => void>();
  const loaded = new Map<string, THREE.Texture>(),
    pending = new Set<string>();
  const roomMeshes = base.scene.children.filter(
    (x) => x instanceof THREE.Mesh,
  ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  const table = new THREE.Group();
  table.name = "tarot-table";
  table.position.set(-3, -1, 1);
  table.rotation.x = -Math.PI / 2;
  base.scene.add(table);
  const cardRoot = new THREE.Group();
  table.add(cardRoot);
  const handAnchor = new THREE.Group();
  handAnchor.name = "handAnchor";
  table.add(handAnchor);
  const otherHand = new THREE.Group();
  table.add(otherHand);
  const camera = base.camera as THREE.OrthographicCamera;
  const emit = (type: "done" | "ready" | "asset-error", view = current) => {
    if (!view || dead || signal.aborted) return;
    queueMicrotask(() => {
      if (!dead && !signal.aborted && current?.revision === view.revision)
        view.onEvent?.({ type, revision: view.revision });
    });
  };
  const plane = (
    w: number,
    h: number,
    texture?: THREE.Texture,
    color = 0xffffff,
  ) => {
    const g = new THREE.PlaneGeometry(w, h);
    geometries.push(g);
    const m = new THREE.MeshBasicMaterial({
      map: texture ?? null,
      color,
      transparent: true,
      depthWrite: false,
    });
    materials.push(m);
    return new THREE.Mesh(g, m);
  };
  const dispose = () => {
    if (dead) return;
    dead = true;
    ++loadGeneration;
    faceReleases.forEach((r) => r());
    faceReleases.clear();
    releases.forEach((r) => r());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    base.dispose();
  };
  try {
    const acquire = async (url: string) => {
      const lease = await leases.acquire(url);
      if (dead || signal.aborted) {
        lease.release();
        throw new Error("aborted");
      }
      releases.push(lease.release);
      return lease.texture;
    };
    const surface = await acquire("/art/tarot-table/surface.png");
    const back = await acquire("/art/tarot-table/back.png");
    const handTexture = await acquire("/art/tarot-table/hand.png");
    const surfaceMesh = plane(14, 10, surface);
    surfaceMesh.renderOrder = 40;
    table.add(surfaceMesh);
    const sleeves: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    for (const [anchor, mirror] of [
      [handAnchor, false],
      [otherHand, true],
    ] as const) {
      const hand = plane(3.4, 4.25, handTexture);
      hand.geometry.dispose();
      hand.geometry = new THREE.PlaneGeometry(3.4, 4.25, 1, 2);
      geometries.push(hand.geometry);
      const sleeveUV = hand.geometry.attributes.uv;
      const sleevePosition = hand.geometry.attributes.position;
      for (let i = 2; i < 4; i++) { sleeveUV.setY(i, .66); sleevePosition.setY(i, .68); }
      sleeves.push(hand);
      hand.position.set(mirror ? 0.306 : -0.306, 1.19, 0.03);
      hand.renderOrder = 90;
      if (mirror) {
        const uv = hand.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      }
      anchor.add(hand);
    }
    type CardMesh = {
      group: THREE.Group;
      flip: THREE.Group;
      front: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      back: THREE.Mesh;
      slot: number;
    };
    const cards: CardMesh[] = [];
    // Only twelve anonymous slots are visible at once. Every one of the 78 slots remains reachable.
    for (let i = 0; i < 15; i++) {
      const group = new THREE.Group(),
        flip = new THREE.Group(),
        orientation = new THREE.Group();
      group.name = `tarot-card-${i}`;
      group.add(flip);
      flip.add(orientation);
      cardRoot.add(group);
      const backMesh = plane(0.94, 1.42, back);
      backMesh.renderOrder = 60;
      const front = plane(0.94, 1.42, undefined, 0xd2bd91);
      front.rotation.y = Math.PI;
      front.position.z = -0.006;
      front.renderOrder = 60;
      orientation.add(backMesh, front);
      cards.push({ group, flip, front, back: backMesh, slot: -1 });
    }
    const halo = plane(1.06, 1.54, undefined, 0xe6c382);
    halo.material.opacity = 0.65;
    halo.renderOrder = 55;
    cardRoot.add(halo);
    const requestFaces = (view: TarotView) => {
      const wanted = view.cards.filter(
        (c, i) =>
          c.revealed || (view.phase === "preparing" && i === view.index),
      );
      const token = loadGeneration;
      for (const card of wanted) {
        if (!card.face || loaded.has(card.face) || pending.has(card.face))
          continue;
        const url = card.face;
        pending.add(url);
        void leases
          .acquire(url)
          .then((lease) => {
            if (
              dead ||
              signal.aborted ||
              token !== loadGeneration ||
              !current?.cards.some((c) => c.face === url)
            ) {
              lease.release();
              return;
            }
            faceReleases.set(url, lease.release);
            loaded.set(url, lease.texture);
            loadDirty = true;
            if (
              current?.revision === view.revision &&
              view.phase === "preparing"
            )
              emit("ready", view);
          })
          .catch(() => {
            if (token === loadGeneration) emit("asset-error", view);
          })
          .finally(() => pending.delete(url));
      }
      if (
        view.phase === "preparing" &&
        view.cards[view.index]?.face &&
        loaded.has(view.cards[view.index].face!)
      )
        emit("ready", view);
    };
    const ray = new THREE.Raycaster();
    return {
      ...base,
      camera,
      needsRender: () => loadDirty,
      dispose,
      exit() {
        current = undefined;
        ++loadGeneration;
        base.exit();
      },
      resize(w, h) {
        width = w;
        height = h;
        mobile = w < 600;
        base.resize?.(w, h);
      },
      pointer(event) {
        if (current?.phase !== "selecting") return;
        ray.setFromCamera(new THREE.Vector2(event.x, event.y), camera);
        const hit = ray.intersectObjects(
          cards
            .slice(0, 12)
            .filter((c) => c.group.visible)
            .map((c) => c.back),
          false,
        )[0];
        const picked = cards.find((c) => c.back === hit?.object);
        if (picked && picked.slot >= 0)
          current.onIntent?.({
            type: event.type === "select" ? "select" : "focus",
            slot: picked.slot,
          });
      },
      update(time, data, reduced) {
        const assetsChanged = loadDirty;
        loadDirty = false;
        const view = data.tarot;
        base.update(time, data, reduced);
        if (!view) {
          table.visible = false;
          roomMeshes.forEach((m) => (m.material.opacity = 1));
          return;
        }
        current = view;
        for (const [url, release] of faceReleases)
          if (!view.cards.some((c) => c.face === url)) {
            release();
            faceReleases.delete(url);
            loaded.delete(url);
          }
        const changed = revision !== view.revision;
        if (changed) {
          revision = view.revision;
          started = time;
          sent = false;
          // A recreated scene restores the settled table immediately unless entering from the conversation.
          if (
            !lastTime &&
            view.phase !== "approach" &&
            view.phase !== "conversation"
          )
            cameraMix = 1;
        }
        const nextFaceKey = view.cards
          .map((c) => `${c.face}:${c.revealed}`)
          .join("|");
        if (changed || assetsChanged || faceKey !== nextFaceKey) {
          faceKey = nextFaceKey;
          requestFaces(view);
        }
        targetMix = view.phase === "conversation" ? 0 : 1;
        const dt = Math.min(0.1, Math.max(0, time - lastTime));
        lastTime = time;
        cameraMix = reduced
          ? targetMix
          : THREE.MathUtils.damp(cameraMix, targetMix, 3.7, dt);
        const gathered = ["preparing", "revealing", "reading"].includes(
          view.phase,
        );
        tableauMix =
          reduced || (changed && view.phase === "reading")
            ? gathered
              ? 1
              : 0
            : THREE.MathUtils.damp(tableauMix, gathered ? 1 : 0, 4, dt);
        const mix = ease(cameraMix);
        roomMeshes.forEach((m) => (m.material.opacity = 1 - ease(mix * 1.5)));
        table.visible = mix > 0.015;
        surfaceMesh.material.opacity = ease(mix * 1.7);
        const aspect = width / Math.max(1, height);
        const roomHalf = Math.max(5.2, 5 * aspect),
          closeHalf = mobile ? 3.8 : 6.1;
        const half = THREE.MathUtils.lerp(roomHalf, closeHalf, mix);
        const roomCenter = aspect < 1.45 ? -3 : 0;
        camera.left = -half;
        camera.right = half;
        camera.top = half / aspect;
        camera.bottom = -half / aspect;
        camera.position.set(
          THREE.MathUtils.lerp(roomCenter, -3, mix),
          THREE.MathUtils.lerp(0, 9, mix),
          THREE.MathUtils.lerp(20, 10, mix),
        );
        camera.lookAt(
          THREE.MathUtils.lerp(roomCenter, -3, mix),
          THREE.MathUtils.lerp(0, -1, mix),
          mix,
        );
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        const duration = durations[view.phase] ?? 0,
          progress = reduced
            ? 1
            : Math.min(1, (time - started) / (duration || 1));
        handAnchor.position.set(-2.7, 3.65, 0.16);
        otherHand.position.set(2.7, 3.65, 0.16);
        handAnchor.visible = otherHand.visible = table.visible;
        halo.visible = false;
        for (const card of cards) {
          if (card.group.parent !== cardRoot) cardRoot.attach(card.group);
          card.group.visible = false;
          card.group.scale.setScalar(1);
          card.flip.rotation.y = 0;
        }
        const selectionPhases = ["fan", "selecting", "dealing"];
        for (let n = 0; n < 12; n++) {
          const slot = view.page * 12 + n,
            card = cards[n];
          card.slot = slot;
          if (
            slot >= 78 ||
            view.cards.some((c) => c.slot === slot) ||
            !selectionPhases.includes(view.phase)
          )
            continue;
          card.group.visible = true;
          card.group.rotation.set(0, 0, 0);
          const pos = slotPosition(slot, view.page, mobile);
          if (view.phase === "fan")
            pos.lerpVectors(
              new THREE.Vector3(0, 1.5, 0.08),
              pos,
              ease(progress),
            );
          card.group.position.copy(pos);
          if (view.focus === slot) {
            card.group.position.z += 0.12;
            halo.visible = true;
            halo.position.copy(card.group.position);
            halo.position.z -= 0.015;
          }
        }
        view.cards.forEach((selected, i) => {
          const card = cards[12 + i];
          if (!card) return;
          card.group.visible = true;
          card.group.rotation.set(0, 0, 0);
          card.slot = selected.slot;
          card.group.scale.setScalar(
            view.phase === "dealing" && view.index === i
              ? 1 + 0.25 * ease((progress - 0.8) / 0.2)
              : 1.25 + 0.5 * tableauMix,
          );
          const target = spreadPosition(i, view.spread, mobile);
          target.y = THREE.MathUtils.lerp(target.y, -0.35, tableauMix);
          card.group.position.copy(target);
          const texture = selected.face && loaded.get(selected.face);
          if (texture && card.front.material.map !== texture) {
            card.front.material.map = texture;
            card.front.material.color.set(0xffffff);
            card.front.material.needsUpdate = true;
          }
          card.flip.children[0].rotation.z = selected.reversed ? Math.PI : 0;
          card.flip.rotation.y = selected.revealed && texture ? Math.PI : 0;
          if (view.phase === "revealing" && view.index === i) {
            const turn = ease((progress - 0.2) / 0.6);
            card.flip.rotation.y = turn * Math.PI;
            card.group.position.z += Math.sin(turn * Math.PI) * 0.3;
            const edge = target
              .clone()
              .add(
                new THREE.Vector3(
                  0.47 * card.group.scale.x * Math.cos(turn * Math.PI),
                  0.25,
                  0.28 + Math.sin(turn * Math.PI) * 0.35,
                ),
              );
            if (progress < 0.2)
              handAnchor.position.lerpVectors(
                new THREE.Vector3(-2.7, 3.65, 0.16),
                edge,
                ease(progress / 0.2),
              );
            else if (progress > 0.8)
              handAnchor.position.lerpVectors(
                edge,
                new THREE.Vector3(-2.7, 3.65, 0.16),
                ease((progress - 0.8) / 0.2),
              );
            else handAnchor.position.copy(edge);
          }
          if (view.phase === "dealing" && view.index === i) {
            const source = slotPosition(selected.slot, view.page, mobile);
            const grip = source.clone().add(new THREE.Vector3(0, 0.6, 0.13));
            if (progress < 0.22) {
              handAnchor.position.lerpVectors(
                new THREE.Vector3(-2.7, 3.65, 0.16),
                grip,
                ease(progress / 0.22),
              );
              card.group.position.copy(source);
            } else if (progress < 0.8) {
              const t = ease((progress - 0.22) / 0.58);
              handAnchor.position.lerpVectors(
                grip,
                target.clone().add(new THREE.Vector3(0, 0.6, 0.13)),
                t,
              );
              handAnchor.position.z += Math.sin(t * Math.PI) * 0.65;
              table.updateMatrixWorld(true);
              handAnchor.attach(card.group);
              card.group.position.set(0, -0.6, -0.13);
            } else {
              // attach() preserves the world transform when ownership returns to the table.
              cardRoot.attach(card.group);
              card.group.position.copy(target);
              handAnchor.position.lerpVectors(
                target.clone().add(new THREE.Vector3(0, 0.6, 0.13)),
                new THREE.Vector3(-2.7, 3.65, 0.16),
                ease((progress - 0.8) / 0.2),
              );
            }
          }
        });
        if (view.phase === "approach" || view.phase === "shuffle") {
          for (let i = 0; i < 8; i++) {
            const card = cards[i];
            card.group.visible = true;
            const side = i % 2 ? 1 : -1;
            const wave =
              view.phase === "shuffle" && !reduced
                ? Math.sin(progress * Math.PI * 6)
                : 0;
            card.group.position.set(
              side * (0.5 + Math.abs(wave) * 0.5),
              1.3 + i * 0.014,
              0.08 + i * 0.016,
            );
            card.group.rotation.z = side * wave * 0.15;
          }
          handAnchor.position.set(
            -0.55 - Math.abs(Math.sin(progress * Math.PI * 6)) * 0.5,
            1.95,
            0.35,
          );
          otherHand.position.set(
            0.55 + Math.abs(Math.sin(progress * Math.PI * 6)) * 0.5,
            1.95,
            0.35,
          );
        }
        for (const sleeve of sleeves) {
          const positions = sleeve.geometry.attributes.position;
          const rear = Math.max(2.125, 7 - sleeve.parent!.position.y - sleeve.position.y);
          positions.setY(0, rear); positions.setY(1, rear); positions.needsUpdate = true;
          sleeve.geometry.computeBoundingSphere();
        }
        if (duration && progress >= 1 && !sent) {
          sent = true;
          emit("done", view);
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
};
