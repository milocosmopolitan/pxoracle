import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { surfaceMaterial } from "./tarot-materials";
import type { RigOwner } from "./tarot-rig";

/**
 * One table assembly for every room. The tarot scene and the painted study rooms build
 * the same tabletop, aprons and legs from these dimensions; only size, placement and
 * the wood surface policy differ. Local coordinates: x across, +y toward the rear,
 * +z up, with the top surface at z = 0 (the tarot table's existing convention).
 */
export interface TableDimensions {
  width: number;
  depth: number;
  /** Tabletop thickness. */
  top: number;
  apronHeight: number;
  apronThickness: number;
  /** Apron center below the top surface. */
  apronDrop: number;
  /** Side apron distance from the width edge; front/back apron inset from the depth edge. */
  sideInset: number;
  frontInset: number;
  /** Leg center distance from the depth edge; legs share the side apron x. */
  legInset: number;
  legSize: number;
  legHeight: number;
}
/** Unchanged tarot numbers: tabletop 14×8.4×0.32, aprons 0.18×0.62, legs 0.45×3.35. */
export const TAROT_TABLE: TableDimensions = {
  width: 14,
  depth: 8.4,
  top: 0.32,
  apronHeight: 0.62,
  apronThickness: 0.18,
  apronDrop: 0.55,
  sideInset: 0.85,
  frontInset: 0.25,
  legInset: 0.8,
  legSize: 0.45,
  legHeight: 3.35,
};
/** The painted study's desk: same proportions, sized to the room painting (astrology units). */
export const STUDY_TABLE: TableDimensions = {
  width: 8.4,
  depth: 3.5,
  top: 0.2,
  apronHeight: 0.42,
  apronThickness: 0.12,
  apronDrop: 0.38,
  sideInset: 0.5,
  frontInset: 0.15,
  legInset: 0.45,
  legSize: 0.3,
  legHeight: 3.0,
};
/**
 * World placement of the study desk shared by the painted rooms. The landing keeps its
 * 0.78 furniture scale; the top surface and rear edge stay where the painted desk met
 * the portrait, so props and tabletop sprites stand on one real surface.
 */
export function studyDesk(mode: "landing" | "astrology") {
  const scale = mode === "landing" ? 0.78 : 1;
  const top = -0.82,
    rear = 0.4,
    depth = STUDY_TABLE.depth * scale,
    width = STUDY_TABLE.width * scale;
  return { x: -3, top, rear, depth, width, front: rear + depth, center: rear + depth / 2, scale };
}

export interface TableSurface {
  wood: [number, number, number];
  trim: [number, number, number];
  normalScale: number;
  roughness: number;
}
/** Tarot's cool walnut under its rim/window lights. */
export const TAROT_TABLE_SURFACE: TableSurface = { wood: [0.4, 0.46, 0.55], trim: [0.42, 0.4, 0.43], normalScale: 0.22, roughness: 0.94 };
/** Warm walnut for the lamp-lit painted study. */
export const STUDY_TABLE_SURFACE: TableSurface = { wood: [0.43, 0.36, 0.29], trim: [0.4, 0.33, 0.27], normalScale: 0.3, roughness: 0.9 };

export function tableMaterials(walnut: THREE.Texture, surface: TableSurface, owner: RigOwner) {
  const wood = surfaceMaterial("wood", walnut, owner),
    trim = surfaceMaterial("wood", walnut, owner);
  trim.color.setRGB(...surface.trim);
  wood.color.setRGB(...surface.wood);
  wood.normalScale.setScalar(surface.normalScale);
  wood.roughness = surface.roughness;
  return { wood, trim };
}

/** Adds the tabletop, four aprons and four legs to `parent`. Geometries are registered with the owner. */
export function buildTableAssembly(
  parent: THREE.Object3D,
  dims: TableDimensions,
  wood: THREE.Material,
  trim: THREE.Material,
  owner: RigOwner,
) {
  const box = (name: string, geometry: THREE.BufferGeometry, position: [number, number, number], material: THREE.Material) => {
    owner.geometry(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const { width, depth, top, apronHeight, apronThickness, apronDrop, sideInset, frontInset, legInset, legSize, legHeight } = dims;
  // A dark contour hull gives every edge the hand-inked outline the painted sprites carry.
  const ink = new THREE.MeshBasicMaterial({ color: 0x1a0f08, side: THREE.BackSide });
  owner.material(ink);
  const outlined = (mesh: THREE.Mesh, [sx, sy, sz]: [number, number, number], grow = 0.035) => {
    const hull = new THREE.Mesh(mesh.geometry, ink);
    hull.name = `${mesh.name}-outline`;
    hull.scale.set(1 + grow / sx, 1 + grow / sy, 1 + grow / sz);
    hull.position.copy(mesh.position);
    parent.add(hull);
    return mesh;
  };
  const tabletop = box("tabletop", new RoundedBoxGeometry(width, depth, top, 4, top * 0.42), [0, 0, -top / 2], wood);
  outlined(tabletop, [width, depth, top]);
  const apronY = depth / 2 - frontInset,
    sideX = width / 2 - sideInset;
  outlined(box("table-front-apron", new THREE.BoxGeometry(width - 2 * frontInset - 0.1, apronThickness, apronHeight), [0, -apronY, -apronDrop], trim), [width - 2 * frontInset - 0.1, apronThickness, apronHeight], 0.025);
  box("table-back-apron", new THREE.BoxGeometry(width - 2 * frontInset - 0.1, apronThickness, apronHeight), [0, apronY, -apronDrop], trim);
  for (const x of [-sideX, sideX]) {
    box("table-side-apron", new THREE.BoxGeometry(apronThickness, depth - 2 * frontInset - 0.1, apronHeight), [x, 0, -apronDrop], trim);
    for (const y of [-(depth / 2 - legInset), depth / 2 - legInset])
      outlined(box("table-leg", new THREE.BoxGeometry(legSize, legSize, legHeight), [x, y, -(top + legHeight / 2)], wood), [legSize, legSize, legHeight], 0.03);
  }
  return { tabletop };
}

/**
 * The study desk for painted rooms: a world-space group with the top surface at
 * studyDesk(mode).top, built from the shared assembly and the leased walnut albedo.
 */
export async function createStudyTable(leases: TextureLeases, signal: AbortSignal, mode: "landing" | "astrology", surface: TableSurface = STUDY_TABLE_SURFACE) {
  const lease = await leases.acquire("/art/hand-mesh/table-reference-albedo.png");
  if (signal.aborted) {
    lease.release();
    throw new Error("SCENE_ABANDONED");
  }
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [],
    cleanups: (() => void)[] = [];
  const owner: RigOwner = {
    geometry: (g) => geometries.push(g),
    material: (m) => materials.push(m),
    cleanup: (f) => cleanups.push(f),
  };
  const { wood, trim } = tableMaterials(lease.texture, surface, owner);
  const desk = studyDesk(mode);
  const group = new THREE.Group();
  group.name = "study-table";
  group.position.set(desk.x, desk.top, desk.center);
  group.scale.setScalar(desk.scale);
  group.rotation.x = -Math.PI / 2;
  const { tabletop } = buildTableAssembly(group, STUDY_TABLE, wood, trim, owner);
  // The landing camera is orthographic, so the desk carries its own perspective: the front edge is wider than the rear.
  if (mode === "landing") taperToward(group, STUDY_TABLE.depth / 2, 0.075, owner);
  let dead = false;
  return {
    group,
    tabletop,
    dispose() {
      if (dead) return;
      dead = true;
      group.removeFromParent();
      group.clear();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      cleanups.forEach((f) => f());
      lease.release();
    },
  };
}

/**
 * Bakes a depth taper into every mesh of the assembly: x is scaled by 1 + amount * (front-ness),
 * where the front is local -y. Each mesh gets its own geometry so shared outline hulls stay consistent.
 */
function taperToward(group: THREE.Group, half: number, amount: number, owner: RigOwner) {
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.updateMatrix();
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * (1 - (amount * position.getY(i)) / half));
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    owner.geometry(geometry);
    child.geometry = geometry;
    child.position.set(0, 0, 0);
    child.scale.set(1, 1, 1);
  }
}
