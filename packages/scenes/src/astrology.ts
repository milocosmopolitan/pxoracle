import * as THREE from "three";
import type { SceneFactory } from "@pxoracle/scene-runtime";
import type {
  AstrologySelection,
  AstrologyView,
} from "@pxoracle/contracts/astrology-view";
import { composition } from "./composition";
import { studyLayers } from "./study";
import { layoutMarkers } from "./astrology-layout";
const ANCHOR = new THREE.Vector3(-3.4, 0.13, 0.4);
const ids = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];
const symbols = ["Su", "Mo", "Me", "Ve", "Ma", "Ju", "Sa", "Ur", "Ne", "Pl"];
const point = (angle: number, radius: number) =>
  new THREE.Vector3(
    Math.cos((angle * Math.PI) / 180) * radius,
    Math.sin((angle * Math.PI) / 180) * radius,
    0,
  );
export const createScene: SceneFactory = async (leases, signal) => {
  // Keep the same painted room, desk and crystal in world space throughout the approach.
  const base = await composition(
    leases,
    signal,
    studyLayers("astrology"),
    "tarot",
  );
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const root = new THREE.Group();
  root.name = "natal-crystal-map";
  root.position.copy(ANCHOR);
  base.scene.add(root);
  let dead = false,
    current: AstrologyView | undefined,
    width = 1,
    height = 1,
    key = "",
    dataKey = "",
    start = 0,
    moving = false,
    dirty = true;
  const position = new THREE.Vector3(-3, 0.8, 20),
    target = new THREE.Vector3(-3, 0.8, 0),
    fromPosition = position.clone(),
    fromTarget = target.clone(),
    toPosition = position.clone(),
    toTarget = target.clone();
  const staticResources: (() => void)[] = [],
    mapResources: (() => void)[] = [];
  let markers: THREE.Mesh[] = [],
    lines: THREE.Line[] = [];
  const dynamic = new THREE.Group();
  root.add(dynamic);
  const ray = new THREE.Raycaster();
  ray.params.Line = { threshold: 0.035 };
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.MeshBasicMaterial,
    parent: THREE.Group,
    order: number,
    resources: (() => void)[],
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.renderOrder = order;
    parent.add(object);
    resources.push(() => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    });
    return object;
  }
  function mat(color: number, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  function label(
    text: string,
    size: number,
    parent: THREE.Group,
    resources: (() => void)[],
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("LABEL_CONTEXT_UNAVAILABLE");
    ctx.fillStyle = "#eedaba";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "52px Georgia,serif";
    ctx.fillText(text + "\uFE0E", 64, 33);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    const m = mat(0xffffff);
    m.map = texture;
    return mesh(
      new THREE.PlaneGeometry(size, size / 2),
      m,
      parent,
      36,
      resources,
    );
  }
  function lineBetween(
    a: THREE.Vector3,
    b: THREE.Vector3,
    color: number,
    opacity: number,
    parent: THREE.Group,
    resources: (() => void)[],
  ) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]),
      m = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      });
    const line = new THREE.Line(g, m);
    line.renderOrder = 30;
    parent.add(line);
    resources.push(() => {
      g.dispose();
      m.dispose();
    });
    return line;
  }
  function clearMap() {
    mapResources.splice(0).forEach((dispose) => dispose());
    dynamic.clear();
    markers = [];
    lines = [];
  }
  function rebuild(view: AstrologyView) {
    clearMap();
    for (const body of layoutMarkers(view.bodies, width < 800 ? 26 : 21)) {
      const real = point(body.longitude, 0.65),
        display = point(body.displayLongitude, 0.99);
      lineBetween(real, display, 0xe0c89e, 0.6, dynamic, mapResources);
      const marker = mesh(
        new THREE.CircleGeometry(0.083, 16),
        mat(0xb89f6c),
        dynamic,
        34,
        mapResources,
      );
      marker.position.copy(display);
      marker.userData.selection = { type: "body", id: body.id };
      markers.push(marker);
      const hit = mesh(
        new THREE.CircleGeometry(0.12, 20),
        mat(0xffffff, 0),
        dynamic,
        34,
        mapResources,
      );
      hit.position.copy(display);
      hit.userData.selection = marker.userData.selection;
      hit.userData.hit = true;
      markers.push(hit);
      const text = label(
        symbols[ids.indexOf(body.id)] ?? body.id.slice(0, 1),
        0.25,
        dynamic,
        mapResources,
      );
      text.position.copy(display);
      text.position.z = 0.01;
    }
    for (const aspect of view.aspects) {
      const a = view.bodies.find((b) => b.id === aspect.a),
        b = view.bodies.find((b) => b.id === aspect.b);
      if (!a || !b) continue;
      const l = lineBetween(
        point(a.longitude, 0.65),
        point(b.longitude, 0.65),
        0xbca2cc,
        0.16,
        dynamic,
        mapResources,
      );
      l.userData.selection = { type: "aspect", ...aspect };
      lines.push(l);
    }
    for (const [index, longitude] of (view.houses ?? []).entries()) {
      lineBetween(
        point(longitude, 0.5),
        point(longitude, 0.6),
        0x82a8ae,
        0.48,
        dynamic,
        mapResources,
      );
      label(String(index + 1), 0.105, dynamic, mapResources).position.copy(
        point(longitude + 15, 0.54),
      );
    }
    dirty = true;
  }
  function chooseShot(view: AstrologyView) {
    const available = Math.max(
      0.08,
      Math.min(view.viewport.height, view.viewport.width * camera.aspect),
    );
    let radius = 1.25;
    toTarget.copy(ANCHOR);
    if (view.phase === "entry") {
      toTarget.set(-3, 0.7, 0.15);
      radius = 4.2;
    } else if (view.selection?.type === "body") {
      const id = view.selection.id;
      const m = markers.find(
        (m) => !m.userData.hit && m.userData.selection.id === id,
      );
      if (m) toTarget.addScaledVector(m.position, 0.52);
      radius = 0.84;
    } else if (view.selection?.type === "aspect") {
      const s = view.selection,
        a = view.bodies.find((b) => b.id === s.a),
        b = view.bodies.find((b) => b.id === s.b);
      if (a && b)
        toTarget.add(
          point(a.longitude, 0.65)
            .add(point(b.longitude, 0.65))
            .multiplyScalar(0.25),
        );
      radius = 1.02;
    }
    const distance =
      radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / available;
    toPosition
      .copy(toTarget)
      .add(
        new THREE.Vector3(
          view.phase === "entry" ? 0 : 0.12,
          view.phase === "entry" ? 0 : 0.08,
          distance,
        ),
      );
  }
  try {
    mesh(
      new THREE.CircleGeometry(0.91, 96),
      mat(0x101528, 0.77),
      root,
      25,
      staticResources,
    );
    mesh(
      new THREE.RingGeometry(0.875, 0.884, 120),
      mat(0xd0b784, 0.8),
      root,
      28,
      staticResources,
    );
    mesh(
      new THREE.RingGeometry(0.65, 0.654, 120),
      mat(0xc2b6d0, 0.35),
      root,
      28,
      staticResources,
    );
    for (let sign = 0; sign < 12; sign++) {
      lineBetween(
        point(sign * 30, 0.655),
        point(sign * 30, 0.875),
        0xbaa77f,
        0.45,
        root,
        staticResources,
      );
      label(
        [
          "♈",
          "♉",
          "♊",
          "♋",
          "♌",
          "♍",
          "♎",
          "♏",
          "♐",
          "♑",
          "♒",
          "♓",
        ][sign],
        0.23,
        root,
        staticResources,
      ).position.copy(point(sign * 30 + 15, 0.79));
    }
    return {
      scene: base.scene,
      camera,
      enter() {
        base.enter();
      },
      exit() {
        current = undefined;
        moving = false;
        base.exit();
      },
      resize(w, h) {
        width = w;
        height = h;
        camera.aspect = w / Math.max(1, h);
        key = "";
        dataKey = "";
        dirty = true;
      },
      needsRender() {
        return moving || dirty;
      },
      pointer(event) {
        if (dead || signal.aborted || moving || current?.phase !== "chart")
          return;
        const x = (event.x + 1) / 2,
          y = (1 - event.y) / 2,
          v = current.viewport;
        if (
          x < v.left ||
          x > v.left + v.width ||
          y < v.top ||
          y > v.top + v.height
        )
          return;
        ray.setFromCamera(new THREE.Vector2(event.x, event.y), camera);
        const hits = ray
          .intersectObjects(markers)
          .filter((h) => h.object.userData.hit);
        hits.sort(
          (a, b) =>
            a.point.distanceTo(a.object.getWorldPosition(new THREE.Vector3())) -
            b.point.distanceTo(b.object.getWorldPosition(new THREE.Vector3())),
        );
        const found = hits[0] ?? ray.intersectObjects(lines)[0];
        if (event.type === "select")
          current.onSelect?.(
            (found?.object.userData.selection as AstrologySelection) ?? null,
          );
        if (event.type === "focus") {
          for (const m of markers)
            if (!m.userData.hit)
              m.scale.setScalar(
                found?.object.userData.selection?.id === m.userData.selection.id
                  ? 1.25
                  : 1,
              );
          dirty = true;
        }
      },
      update(time, data, reduced) {
        if (dead || signal.aborted) return;
        base.update(time, {}, reduced);
        const view: AstrologyView = data.astrology ?? {
          phase: "entry",
          revision: 0,
          bodies: [],
          houses: null,
          aspects: [],
          selection: null,
          viewport: { left: 0, top: 0.1, width: 0.55, height: 0.85 },
        };
        const first = !current;
        current = view;
        const nextData = JSON.stringify([
          view.bodies,
          view.houses,
          view.aspects,
        ]);
        if (dataKey !== nextData) {
          rebuild(view);
          dataKey = nextData;
        }
        root.visible = view.phase === "chart";
        const nextKey = JSON.stringify([
          view.phase,
          view.selection,
          view.viewport,
          view.revision,
          width,
          height,
        ]);
        if (key !== nextKey) {
          fromPosition.copy(position);
          fromTarget.copy(target);
          chooseShot(view);
          start = time;
          key = nextKey;
          moving = true;
          if (first) {
            fromPosition.copy(toPosition);
            fromTarget.copy(toTarget);
          }
        }
        const duration = view.phase === "entry" || !view.selection ? 1.6 : 0.7,
          t =
            view.reviewProgress ??
            (reduced ? 1 : Math.min(1, (time - start) / duration)),
          ease = t * t * (3 - 2 * t);
        position.lerpVectors(fromPosition, toPosition, ease);
        target.lerpVectors(fromTarget, toTarget, ease);
        camera.position.copy(position);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        // Off-axis projection focuses within the actual region left clear by the DOM panel.
        camera.projectionMatrix.elements[8] +=
          1 - 2 * (view.viewport.left + view.viewport.width / 2);
        camera.projectionMatrix.elements[9] +=
          2 * (view.viewport.top + view.viewport.height / 2) - 1;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.updateMatrixWorld();
        root.updateMatrixWorld(true);
        for (const hit of markers)
          if (hit.userData.hit) {
            const center = hit.getWorldPosition(new THREE.Vector3());
            const edge = center.clone().add(new THREE.Vector3(0.12, 0, 0));
            const a = center.project(camera),
              b = edge.project(camera);
            const radiusPixels = Math.max(1, (Math.abs(b.x - a.x) * width) / 2);
            hit.scale.setScalar(Math.max(1, 22 / radiusPixels));
          }
        for (const m of markers)
          if (!m.userData.hit)
            (m.material as THREE.MeshBasicMaterial).color.setHex(
              view.selection?.type === "body" &&
                view.selection.id === m.userData.selection.id
                ? 0xffdf90
                : 0xb89f6c,
            );
        for (const l of lines) {
          const s = l.userData.selection,
            selected =
              view.selection?.type === "aspect" &&
              s.a === view.selection.a &&
              s.b === view.selection.b &&
              s.kind === view.selection.kind;
          (l.material as THREE.LineBasicMaterial).opacity = selected
            ? 0.95
            : 0.16;
          (l.material as THREE.LineBasicMaterial).color.setHex(
            selected ? 0xffd794 : 0xbca2cc,
          );
        }
        if (moving && t >= 1) {
          moving = false;
          const revision = view.revision;
          queueMicrotask(() => {
            if (!dead && !signal.aborted && current?.revision === revision)
              current.onSettled?.(revision);
          });
        }
        dirty = false;
      },
      dispose() {
        if (dead) return;
        dead = true;
        current = undefined;
        clearMap();
        staticResources.splice(0).forEach((dispose) => dispose());
        base.dispose();
      },
    };
  } catch (error) {
    dead = true;
    clearMap();
    staticResources.splice(0).forEach((dispose) => dispose());
    base.dispose();
    throw error;
  }
};
