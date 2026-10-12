import * as THREE from "three";
import { createStudyGlobe } from "./study-globe";
import { createStudyProps } from "./study-props";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import type { TarotView } from "@pxoracle/contracts";
import { composition } from "./composition";
import { studyLayers } from "./study";
import { frameTarot, frameReview, TarotCameraDirector } from "./tarot-camera";
import { createArm, pixelMaterial, type HandPose } from "./tarot-rig";
import { surfaceMaterial } from "./tarot-materials";
import { buildTableAssembly, tableMaterials, TAROT_TABLE, TAROT_TABLE_SURFACE } from "./study-table";
import { createShawl } from "./tarot-shawl";
import { createCardInscription, finishCardFace } from "./tarot-card-finish";
import { createPixelPresentation } from "./tarot-pixels";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_THICKNESS,
  CARD_GRIP_Y,
  MAT_WIDTH,
  MAT_DEPTH,
  MAT_CENTER_Y,
  MAT_TOP,
  slotPosition,
  spreadPosition,
  readingPlacement,
} from "./tarot-layout";
export { slotPosition, spreadPosition } from "./tarot-layout";
const ease = (x: number) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
const durations: Record<string, number> = {
  approach: 2.4,
  shuffle: 3.6,
  fan: 0.8,
  dealing: 2.4,
  revealing: 2.6,
};
export const createScene: SceneFactory = async (leases, signal) => {
  const base = await composition(
    leases,
    signal,
    studyLayers("tarot").filter(([url, , , , , crop]) =>
      [
        "/art/room.webp",
        "/art/moon-frame.webp",
        "/art/plant.webp",
        "/art/cat-chair.webp",
      ].includes(url),
    ),
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
    approachStart = 0,
    lastTime = 0,
    loadGeneration = 0;
  const faceReleases = new Map<string, () => void>();
  const loaded = new Map<string, THREE.Texture>(),
    pending = new Set<string>();
  const roomMeshes = base.scene.children.filter(
    (x) => x instanceof THREE.Mesh,
  ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  // Only the room and upper portrait remain billboards. The desk exists once, in world space.
  for (const mesh of roomMeshes) {
    if (mesh.renderOrder === 4) {
      const uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setY(
          i,
          1 - 0.5 + uv.getY(i) * (0.5 / 0.595) - (1 - 0.595) * (0.5 / 0.595),
        );
      mesh.geometry.scale(1, 0.5 / 0.595, 1);
    }
    if (mesh.renderOrder === 0) {
      const uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 0.24 + uv.getY(i) * 0.76);
      mesh.geometry.scale(1, 0.76, 1);
      mesh.position.set(-3, 2.34, -10);
      mesh.scale.set(1.8, 1.8, 1);
    } else if (mesh.renderOrder === 1) mesh.position.set(-8, 4, -9.8);
    else if (mesh.renderOrder === 2) mesh.position.set(-10, -3.15, -8.5);
    else if (mesh.renderOrder === 3) mesh.position.set(3, -0.8, -5.5);
    else if (mesh.renderOrder === 4) {
      mesh.position.set(-3, 1.5, -4.3);
      mesh.scale.setScalar(1.3);
    }
  }
  const table = new THREE.Group();
  table.name = "tarot-table";
  table.position.set(-3, -1, 1);
  table.rotation.x = -Math.PI / 2;
  base.scene.add(table);
  const cardRoot = new THREE.Group();
  table.add(cardRoot);
  let handAnchor: THREE.Group, otherHand: THREE.Group;
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const director = new TarotCameraDirector();
  const emit = (type: "done" | "ready" | "asset-error", view = current) => {
    if (!view || view.reviewShot || dead || signal.aborted) return;
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
    const torso = plane(
      6.4,
      8,
      await acquire("/art/hand-mesh/oracle-front-v4.png"),
    );
    const obliqueTorso = await acquire("/art/hand-mesh/oracle-oblique-v4.png");
    const torsoView = { value: 0 };
    torso.material.onBeforeCompile = (shader) => {
      shader.uniforms.obliqueTorso = { value: obliqueTorso };
      shader.uniforms.torsoView = torsoView;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D obliqueTorso; uniform float torsoView;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "diffuseColor *= mix(texture2D(map, vMapUv), texture2D(obliqueTorso, vMapUv), torsoView);",
      );
    };
    torso.material.customProgramCacheKey = () =>
      "oracle-authored-view-plates-v4";
    const torsoGeometry = new THREE.PlaneGeometry(6.4, 8, 1, 12);
    geometries.push(torsoGeometry);
    torso.geometry = torsoGeometry;
    torso.name = "oracle-torso";
    torso.position.set(-3, 1.05, -4.24);
    torso.material.alphaTest = 0.5;
    torso.material.depthWrite = true;
    base.scene.add(torso);
    const surface = await acquire("/art/hand-mesh/reading-mat.png");
    const back = await acquire("/art/tarot-table/back.png");
    const owner = {
      geometry: (g: THREE.BufferGeometry) => {
        geometries.push(g);
      },
      material: (m: THREE.Material) => {
        materials.push(m);
      },
      cleanup: (f: () => void) => {
        releases.push(f);
      },
    };
    const pixelPass = createPixelPresentation();
    releases.push(() => pixelPass.dispose());
    const walnut = await acquire("/art/hand-mesh/table-reference-albedo.png");
    const { wood, trim } = tableMaterials(walnut, TAROT_TABLE_SURFACE, owner);

    function box(
      name: string,
      size: number[],
      position: number[],
      material: THREE.Material,
      parent: THREE.Object3D = table,
    ) {
      const geometry = new THREE.BoxGeometry(...(size as [number, number, number]));
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.position.set(...(position as [number, number, number]));
      parent.add(mesh);
      return mesh;
    }
    // The same assembly the painted study rooms place on their desks.
    buildTableAssembly(table, TAROT_TABLE, wood, trim, owner);
    // A thin rounded cloth volume provides an actual edge and contact shadow.
    const matEdgeMaterial = surfaceMaterial("cloth", surface, owner);
    matEdgeMaterial.color.set(0x343a36);
    const matBodyGeometry = new RoundedBoxGeometry(
      MAT_WIDTH - 0.40, MAT_DEPTH - 0.32, MAT_TOP - 0.003, 3, 0.018,
    );
    geometries.push(matBodyGeometry);
    const matBody = new THREE.Mesh(matBodyGeometry, matEdgeMaterial);
    matBody.name = "reading-mat-body";
    matBody.position.set(0, MAT_CENTER_Y, (MAT_TOP - 0.003) / 2);
    matBody.castShadow = matBody.receiveShadow = true;
    table.add(matBody);
    const mat = plane(MAT_WIDTH, MAT_DEPTH, surface);
    const matMaterial = surfaceMaterial("cloth", surface, owner);
    matMaterial.color.set(0xffffff);
    matMaterial.transparent = true;
    matMaterial.alphaTest = 0.5;
    const matMesh = mat as unknown as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.Material
    >;
    matMesh.material = matMaterial;
    mat.name = "reading-mat";
    mat.position.set(0, MAT_CENTER_Y, MAT_TOP);
    mat.material.depthWrite = true;
    mat.renderOrder = 0;
    mat.receiveShadow = true;
    mat.castShadow = true;
    table.add(mat);
    const floorMaterial = surfaceMaterial(
      "wood",
      await acquire("/art/hand-mesh/floor-reference-albedo.png"),
      owner,
    );
    floorMaterial.normalScale.setScalar(0.18);
    floorMaterial.roughness = 0.92;
    floorMaterial.color.setRGB(0.52, 0.58, 0.70);
    for (const texture of [
      floorMaterial.map,
      floorMaterial.normalMap,
      floorMaterial.roughnessMap,
    ])
      texture?.repeat.set(6, 6);

    box(
      "continuous-room-floor",
      [80, 0.18, 80],
      [-3, -4.5, 1],
      floorMaterial,
      base.scene,
    );
    box(
      "rear-wall",
      [80, 35, 0.2],
      [-3, 10, -12],
      pixelMaterial(0x171919, owner),
      base.scene,
    );
    const props = await createStudyProps(leases, signal, "tarot");
    releases.push(props.dispose);
    base.scene.add(props.group);
    const globe = await createStudyGlobe(leases, signal, true, "room");
    releases.push(globe.dispose);
    base.scene.add(globe.group);
    const rim = new THREE.DirectionalLight(0x777acb, 0.35);
    rim.position.set(8, 5, -4);
    const windowGlow = new THREE.PointLight(0x7585bf, 18, 25, 2);
    windowGlow.position.set(5, 4, -5);
    base.scene.add(rim, windowGlow);
    const textures = {
      skin: await acquire("/art/hand-mesh/skin-albedo.png"),
      cloth: await acquire("/art/hand-mesh/cloth-albedo.png"),
    };
    const rightArm = await createArm("right", owner, signal, textures);
    const leftArm = await createArm("left", owner, signal, textures);
    table.add(rightArm.root, leftArm.root);
    const shawl = createShawl(textures.cloth, owner);
    table.add(shawl.group);
    handAnchor = rightArm.handAnchor;
    otherHand = leftArm.handAnchor;
    type CardMesh = {
      group: THREE.Group;
      flip: THREE.Group;
      front: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      back: THREE.Mesh;
      slot: number;
      inscription: ReturnType<typeof createCardInscription>;
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
      const backMesh = plane(CARD_WIDTH, CARD_HEIGHT, back);
      finishCardFace(backMesh.material, false);
      backMesh.position.z = CARD_THICKNESS / 2 + 0.004;
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS),
        new THREE.MeshBasicMaterial({ color: 0xcbb893 }),
      );
      // Only the four thin edges are paper; opaque caps would fill the clipped artwork corners.
      paper.geometry.setDrawRange(0, 24);
      paper.geometry.scale(.96, .965, 1);
      geometries.push(paper.geometry);
      materials.push(paper.material);
      paper.renderOrder = 0;
      orientation.add(paper);
      const front = plane(CARD_WIDTH, CARD_HEIGHT, undefined, 0xd2bd91);
      front.rotation.y = Math.PI;
      front.position.z = -CARD_THICKNESS / 2 - 0.004;
      finishCardFace(front.material, true);
      const inscription = createCardInscription();
      front.add(inscription.group);
      releases.push(inscription.dispose);
      orientation.add(backMesh, front);
      cards.push({ group, flip, front, back: backMesh, slot: -1, inscription });
    }
    // Keep transform handles for choreography, but batch the anonymous deck's surfaces.
    const anonymous = cards.slice(0, 12);
    const instanceSlots: number[] = [];
    const template = anonymous[0].flip.children[0];
    const batches = template.children.map((surface, i) => {
      const source = surface as THREE.Mesh;
      const batch = new THREE.InstancedMesh(source.geometry, source.material, 12);
      batch.name = ["deck-paper-instances", "deck-back-instances", "deck-front-instances"][i];
      batch.count = 0;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.frustumCulled = false;
      cardRoot.add(batch);
      releases.push(() => batch.dispose());
      return batch;
    });
    for (const card of anonymous)
      card.flip.children[0].children.forEach((surface) => (surface.visible = false));
    const inverseRoot = new THREE.Matrix4(), instanceMatrix = new THREE.Matrix4();
    const syncDeckInstances = () => {
      table.updateMatrixWorld(true);
      inverseRoot.copy(cardRoot.matrixWorld).invert();
      instanceSlots.length = 0;
      for (const card of anonymous) {
        if (!card.group.visible) continue;
        const index = instanceSlots.length;
        instanceSlots.push(card.slot);
        card.flip.children[0].children.forEach((surface, i) => {
          instanceMatrix.multiplyMatrices(inverseRoot, surface.matrixWorld);
          batches[i].setMatrixAt(index, instanceMatrix);
        });
      }
      for (const batch of batches) {
        batch.count = instanceSlots.length;
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
      }
    };
    const halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> = plane(
      CARD_WIDTH + 0.032,
      CARD_HEIGHT + 0.032,
      undefined,
      0xb38a3b,
    );
    const outline = new THREE.Shape();
    const hw = (CARD_WIDTH + .032) / 2, hh = (CARD_HEIGHT + .032) / 2;
    outline.moveTo(-hw, -hh); outline.lineTo(hw, -hh);
    outline.lineTo(hw, hh); outline.lineTo(-hw, hh); outline.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-hw + .007, -hh + .007); hole.lineTo(-hw + .007, hh - .007);
    hole.lineTo(hw - .007, hh - .007); hole.lineTo(hw - .007, -hh + .007); hole.closePath();
    outline.holes.push(hole);
    const outlineGeometry = new THREE.ShapeGeometry(outline);
    geometries.push(outlineGeometry);
    halo.geometry = outlineGeometry;
    halo.name = "card-focus-outline";
    halo.userData.glow = true;
    halo.material.transparent = false;
    halo.material.depthWrite = true;
    halo.renderOrder = 0;
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
      setShadows(enabled) { props.lamp.setShadows(enabled); },
      camera,
      render(renderer) {
        pixelPass.render(renderer, base.scene, camera);
      },
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
        pixelPass.resize(w, h);
        mobile = w < 760;
        base.resize?.(w, h);
      },
      pointer(event) {
        if (current?.phase === "reading") {
          if (event.type !== "select") return;
          ray.setFromCamera(new THREE.Vector2(event.x, event.y), camera);
          const hit = ray.intersectObjects(
            cards
              .slice(12)
              .filter((c) => c.group.visible && !!c.front.material.map)
              .map((c) => c.front),
            false,
          )[0];
          const picked = cards.find((c) => c.front === hit?.object);
          if (picked)
            current.onIntent?.({ type: "inspect", slot: picked.slot });
          return;
        }
        if (current?.phase !== "selecting") return;
        ray.setFromCamera(new THREE.Vector2(event.x, event.y), camera);
        const hit = ray.intersectObject(batches[1], false)[0];
        const slot = hit?.instanceId === undefined ? undefined : instanceSlots[hit.instanceId];
        if (slot !== undefined && slot >= 0)
          current.onIntent?.({
            type: event.type === "select" ? "select" : "focus",
            slot,
          });
      },
      update(time, data, reduced) {
        props.update(time, reduced);
        const assetsChanged = loadDirty;
        loadDirty = false;
        const view = data.tarot;
        base.update(time, data, reduced);
        if (!view) {
          table.visible = true;
          frameTarot(camera, width, height, 0, 0);
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
          approachStart = cameraMix;
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
          : view.phase === "approach"
            ? THREE.MathUtils.lerp(
                approachStart,
                1,
                ease((time - started) / durations.approach),
              )
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
        table.visible = true;
        director.update(camera, time, width, height, view, reduced);
        if (view.cameraProfile)
          frameTarot(
            camera,
            width,
            height,
            mix,
            tableauMix,
            view.cameraProfile,
          );
        if (view.reviewShot)
          frameReview(camera, width, height, view.reviewShot, view.spread);
        const duration = durations[view.phase] ?? 0,
          progress =
            view.reviewProgress ??
            (reduced ? 1 : Math.min(1, (time - started) / (duration || 1)));
        const atTable = !["conversation", "approach", "shuffle"].includes(
          view.phase,
        );
        handAnchor.position.set(-1.75, 3.35, 0.3);
        otherHand.position.set(1.75, 3.35, 0.3);
        let rightPose: HandPose = "rest",
          leftPose: HandPose = "rest",
          rightHeld = false,
          leftHeld = false,
          rightTurn = 0,
          leftTurn = 0,
          rightActive = false,
          leftActive = false;
        handAnchor.visible = otherHand.visible = table.visible;
        halo.visible = false;
        halo.rotation.z = 0;
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
          const target = spreadPosition(i, view.spread, mobile);
          const placement = readingPlacement(selected.slot, i);
          target.y = THREE.MathUtils.lerp(
            target.y,
            -0.35 + placement.y,
            tableauMix,
          );
          card.group.rotation.z = placement.angle * tableauMix;
          card.group.position.copy(target);
          const texture = selected.face && loaded.get(selected.face);
          if (texture && card.front.material.map !== texture) {
            card.front.material.map = texture;
            card.front.material.color.set(0xffffff);
            card.front.material.needsUpdate = true;
          }
          card.inscription.update(
            selected.name ?? "",
            view.phase === "reading" && (view.readingFocus === i || view.reviewShot === "detail"),
            time, reduced,
          );
          if (view.phase === "reading" && (view.readingFocus === i || view.reviewShot === "detail")) {
            halo.visible = true;
            halo.position.copy(card.group.position);
            halo.position.z -= .012;
            halo.rotation.z = card.group.rotation.z;
          }
          card.flip.children[0].rotation.z = selected.reversed ? Math.PI : 0;
          card.flip.rotation.y = selected.revealed && texture ? Math.PI : 0;
          const useLeft =
            (view.phase === "dealing" && (!mobile || Math.abs(target.x) < 0.1)
              ? slotPosition(selected.slot, view.page, mobile).x
              : target.x) > 0;
          if (
            ["dealing", "revealing"].includes(view.phase) &&
            view.index === i
          ) {
            if (useLeft) leftActive = true;
            else rightActive = true;
          }
          const activeHand = useLeft ? otherHand : handAnchor;
          const restHand = new THREE.Vector3(useLeft ? 1.75 : -1.75, 3.35, 0.3);
          if (view.phase === "revealing" && view.index === i) {
            // Roll to the card's balance point, then open the fingers while it settles.
            // A person does not keep twisting the same grip through a full 180 degrees.
            const release = ease((progress - 0.53) / 0.27);
            const pose =
              progress < 0.16 ? "rest" : progress > 0.53 ? "release" : "pinch";
            if (useLeft) {
              leftPose = pose;
              leftHeld = progress >= 0.16 && progress <= 0.53;
            } else {
              rightPose = pose;
              rightHeld = progress >= 0.16 && progress <= 0.53;
            }
            const turn = ease((progress - 0.2) / 0.6);
            const flipAngle = turn * Math.PI * (useLeft ? -1 : 1);
            card.flip.rotation.y = flipAngle;
            const wristTurn =
              THREE.MathUtils.clamp(
                flipAngle,
                -Math.PI * 0.55,
                Math.PI * 0.55,
              ) *
              (1 - release);
            if (useLeft) leftTurn = wristTurn;
            else rightTurn = wristTurn;
            const halfWidth = CARD_WIDTH / 2;
            card.group.position.z +=
              Math.sin(turn * Math.PI) * (halfWidth + 0.08);
            const gripTurn = Math.min(turn, 0.55);
            const edge = target
              .clone()
              .add(
                new THREE.Vector3(
                  (useLeft ? 1 : -1) * halfWidth * Math.cos(gripTurn * Math.PI),
                  0.25,
                  Math.sin(gripTurn * Math.PI) * (halfWidth * 2 + 0.08) + 0.04,
                ),
              );
            if (progress < 0.2)
              activeHand.position.lerpVectors(
                restHand,
                edge,
                ease(progress / 0.2),
              );
            else activeHand.position.lerpVectors(edge, restHand, release);
          }
          if (view.phase === "dealing" && view.index === i) {
            if (useLeft)
              leftPose =
                progress < 0.15 ? "rest" : progress > 0.8 ? "release" : "pinch";
            else
              rightPose =
                progress < 0.15 ? "rest" : progress > 0.8 ? "release" : "pinch";
            if (useLeft) leftHeld = progress >= 0.22 && progress < 0.8;
            else rightHeld = progress >= 0.22 && progress < 0.8;
            const source = slotPosition(selected.slot, view.page, mobile);
            const grip = source
              .clone()
              .add(new THREE.Vector3(0, CARD_GRIP_Y, 0.13));
            if (progress < 0.22) {
              activeHand.position.lerpVectors(
                restHand,
                grip,
                ease(progress / 0.22),
              );
              card.group.position.copy(source);
            } else if (progress < 0.8) {
              const t = ease((progress - 0.22) / 0.58);
              activeHand.position.lerpVectors(
                grip,
                target.clone().add(new THREE.Vector3(0, CARD_GRIP_Y, 0.13)),
                t,
              );
              activeHand.position.z += Math.sin(t * Math.PI) * 0.65;
              table.updateMatrixWorld(true);
              activeHand.attach(card.group);
              card.group.position.set(0, -CARD_GRIP_Y, -0.13);
            } else {
              // attach() preserves the world transform when ownership returns to the table.
              cardRoot.attach(card.group);
              card.group.position.copy(target);
              activeHand.position.lerpVectors(
                target.clone().add(new THREE.Vector3(0, CARD_GRIP_Y, 0.13)),
                restHand,
                ease((progress - 0.8) / 0.2),
              );
            }
          }
        });
        if (["conversation", "approach", "shuffle"].includes(view.phase)) {
          rightActive = leftActive = true;
          const settling =
            view.phase === "shuffle" ? ease((progress - 0.84) / 0.16) : 0;
          const liftDeck =
            view.phase === "shuffle"
              ? 1 - settling
              : view.phase === "approach"
                ? ease((progress - 0.6) / 0.4)
                : 0;
          const deck = new THREE.Vector3(
            (0.25 +
              (view.phase === "shuffle"
                ? Math.sin(progress * Math.PI * 8) * 0.1
                : 0)) *
              (1 - settling),
            1.4 + 0.1 * settling,
            0.08 + 0.92 * liftDeck,
          );
          const shuffling = view.phase === "shuffle";
          const cycle =
            view.reviewProgress !== undefined
              ? (progress * 4) % 1
              : reduced
                ? 1
                : (progress * 4) % 1;
          const travel =
            (cycle < 0.55
              ? ease(cycle / 0.55)
              : 1 - ease((cycle - 0.55) / 0.45)) *
            (1 - settling);
          deck.x += travel * 0.38;
          deck.y += travel * 0.1;
          deck.z += travel * 0.08;
          otherHand.position
            .copy(deck)
            .add(new THREE.Vector3(0, CARD_GRIP_Y, 0.15));
          handAnchor.position
            .copy(otherHand.position)
            .add(
              new THREE.Vector3(
                shuffling
                  ? -travel * 1.05
                  : -0.85 * (1 - ease((progress - 0.8) / 0.2)),
                shuffling
                  ? -travel * 0.3
                  : 0.15 * (1 - ease((progress - 0.8) / 0.2)),
                shuffling
                  ? (0.28 + Math.sin(cycle * Math.PI) * 0.55) * (1 - settling)
                  : 0.22 + 0.06 * ease((progress - 0.8) / 0.2),
              ),
            );
          leftPose =
            shuffling && progress > 0.9
              ? "release"
              : liftDeck > 0
                ? "support"
                : "rest";
          rightPose = shuffling
            ? progress > 0.84 || cycle > 0.86
              ? "release"
              : "packet"
            : liftDeck > 0
              ? "packet"
              : "rest";
          leftHeld = shuffling;
          rightHeld = shuffling && cycle <= 0.86;
          for (let i = 0; i < 8; i++) {
            const card = cards[i];
            card.group.visible = true;
            card.group.rotation.set(0, 0, 0);
            card.group.position
              .copy(deck)
              .add(new THREE.Vector3(0, 0, i * CARD_THICKNESS));
            if (shuffling && i >= 4) {
              table.updateMatrixWorld(true);
              handAnchor.attach(card.group);
              card.group.position.set(
                0,
                -CARD_GRIP_Y,
                -0.13 + (i - 4) * CARD_THICKNESS,
              );
            }
          }
          if (view.phase === "approach") {
            handAnchor.position.lerpVectors(
              new THREE.Vector3(-1.65, 2.25, 0.3),
              handAnchor.position.clone(),
              ease(progress / 0.6),
            );
            otherHand.position.lerpVectors(
              new THREE.Vector3(1.65, 2.25, 0.3),
              otherHand.position.clone(),
              ease(progress / 0.6),
            );
          }
          if (view.phase === "conversation") {
            handAnchor.position.set(-1.65, 2.25, 0.3);
            otherHand.position.set(1.65, 2.25, 0.3);
          }
        }
        // Both shoulders and the torso lean together when reaching toward the visitor.
        if (view.phase === "fan") {
          rightActive = leftActive = true;
          const start = new THREE.Vector3(0, 1.5 + CARD_GRIP_Y, 0.23);
          handAnchor.position.lerpVectors(
            start,
            new THREE.Vector3(-1.75, 3.35, 0.3),
            ease(progress),
          );
          otherHand.position.lerpVectors(
            start,
            new THREE.Vector3(1.75, 3.35, 0.3),
            ease(progress),
          );
          rightPose = leftPose = "release";
        }
        const lean = Math.min(
          2.0,
          Math.max(
            0,
            2.4 - Math.min(handAnchor.position.y, otherHand.position.y),
          ),
        );
        const lateral = THREE.MathUtils.clamp(
          (rightActive && !leftActive
            ? handAnchor.position.x
            : leftActive && !rightActive
              ? otherHand.position.x
              : 0) * 0.45,
          -1.2,
          1.2,
        );
        if (!rightActive) handAnchor.position.x += lateral;
        if (!leftActive) otherHand.position.x += lateral;
        if (!rightActive) handAnchor.position.y -= lean * 0.8;
        if (!leftActive) otherHand.position.y -= lean * 0.8;
        const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
        const elevated = ease((Math.asin(-cameraDirection.y) - 0.25) / 0.4);
        torsoView.value = elevated;
        torso.rotation.x = 0;
        const shoulderAnchor = new THREE.Vector3(
          -3 + lateral,
          1.3,
          -4.25 + lean,
        );
        torso.position
          .copy(shoulderAnchor)
          .sub(new THREE.Vector3(0, 0.96, 0).applyQuaternion(torso.quaternion));
        torso.position.z += 0.32;
        // The hips stay behind the table while the upper body reaches forward.
        const bodyVertices = torso.geometry.attributes.position;
        for (let i = 0; i < bodyVertices.count; i++)
          bodyVertices.setZ(
            i,
            -lean * (1 - ease((bodyVertices.getY(i) + 2) / 3)),
          );
        bodyVertices.needsUpdate = true;
        torso.updateMatrixWorld(true);
        table.updateMatrixWorld(true);
        const attachment = (side: number) => {
          // UV landmarks track the authored shoulder opening in both portrait plates.
          const y =
            8 * (0.5 - THREE.MathUtils.lerp(530 / 1402, 560 / 1402, elevated));
          const point = new THREE.Vector3(
            side * THREE.MathUtils.lerp(1.25, 1.42, elevated),
            y,
            -0.32 - lean * (1 - ease((y + 2) / 3)),
          );
          return table.worldToLocal(torso.localToWorld(point));
        };
        torso.userData.shoulders = [
          attachment(-1).toArray(),
          attachment(1).toArray(),
        ];
        rightArm.update(
          handAnchor.position.clone(),
          view.handPose ?? rightPose,
          rightHeld,
          lean,
          rightTurn,
          reduced || view.reviewProgress !== undefined
            ? 1
            : Math.min(1, dt * 18),
          lateral,
          attachment(-1),
        );
        leftArm.update(
          otherHand.position.clone(),
          view.handPose ?? leftPose,
          leftHeld,
          lean,
          leftTurn,
          reduced || view.reviewProgress !== undefined
            ? 1
            : Math.min(1, dt * 18),
          lateral,
          attachment(1),
        );
        shawl.update([rightArm, leftArm].map((arm) => ({
          shoulder: new THREE.Vector3().fromArray(arm.root.userData.shoulder),
          elbow: new THREE.Vector3().fromArray(arm.root.userData.elbow),
          wrist: new THREE.Vector3().fromArray(arm.root.userData.wrist),
        })), dt, reduced || view.reviewProgress !== undefined);
        syncDeckInstances();
        if (!view.reviewShot && duration && progress >= 1 && !sent) {
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
