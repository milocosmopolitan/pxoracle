import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { TextureLeases } from "@pxoracle/scene-runtime";
import { surfaceMaterial } from "./tarot-materials";
import type { RigOwner } from "./tarot-rig";
import { STUDY_TABLE, studyDesk } from "./study-table";

const WALNUT = "/art/hand-mesh/table-reference-albedo.png";
const CARD_BACK = "/art/tarot-table/back.png";
const rad = (degrees: number) => THREE.MathUtils.degToRad(degrees);

/**
 * Where the loose desk objects stand: x in unscaled room units, zf as a fraction of the desk depth from its
 * rear edge. Every footprint stays inside the tabletop (see tests/scenes.test.mjs).
 */
export const STUDY_SPOTS = {
  landing: { mug: { x: -4.2, zf: 0.84 } },
  astrology: { mug: { x: -4.55, zf: 0.16 }, book: { x: -4.75, zf: 0.74 } },
} as const;

/**
 * Real meshes standing on the shared study desk: mug, tray, tarot deck and (astrology) a notebook and pen,
 * plus a vintage chair pulled out in front of the desk and the shadow pooled under it. Each piece carries the
 * same dark contour hull as the desk so edges read as hand-inked, and every piece has its own yaw so the
 * arrangement is never aligned to the table grid.
 */
export async function createStudyObjects(leases: TextureLeases, signal: AbortSignal, mode: "landing" | "astrology") {
  const [wood, back] = await Promise.all([leases.acquire(WALNUT), leases.acquire(CARD_BACK)]);
  if (signal.aborted) {
    wood.release();
    back.release();
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
  const desk = studyDesk(mode);
  const s = desk.scale;
  const root = new THREE.Group();
  root.name = "study-objects";
  const ink = new THREE.MeshBasicMaterial({ color: 0x180d07, side: THREE.BackSide });
  owner.material(ink);
  const solid = (color: number, roughness = 0.8, metalness = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    owner.material(material);
    return material;
  };
  const walnut = (tint: [number, number, number]) => {
    const material = surfaceMaterial("wood", wood.texture, owner);
    material.color.setRGB(...tint);
    material.normalScale.setScalar(0.25);
    material.roughness = 0.82;
    return material;
  };
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, outline = 0.02) => {
    owner.geometry(geometry);
    const piece = new THREE.Mesh(geometry, material);
    piece.castShadow = true;
    piece.receiveShadow = true;
    parent.add(piece);
    if (outline > 0) {
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      const hull = new THREE.Mesh(geometry, ink);
      hull.scale.set(1 + outline / Math.max(size.x, 0.05), 1 + outline / Math.max(size.y, 0.05), 1 + outline / Math.max(size.z, 0.05));
      piece.add(hull);
    }
    return piece;
  };
  /** A placement group: x across the world, zf as a fraction of the desk depth from its rear edge, local y up. */
  const place = (x: number, zf: number, yaw: number, lift = 0) => {
    const group = new THREE.Group();
    group.position.set(-3 + (x + 3) * s, desk.top + lift * s, desk.rear + zf * desk.depth);
    group.rotation.y = rad(yaw);
    group.scale.setScalar(s);
    root.add(group);
    return group;
  };

  // Mug: a lathed pewter-glaze body with a C handle. At the astrology table it waits behind the crystal,
  // where the book used to lie; the book and pen take the mug's place on the visitor's side.
  const mugSpot = STUDY_SPOTS[mode].mug;
  const mug = place(mugSpot.x, mugSpot.zf, 28);
  mug.scale.multiplyScalar(0.8);
  mug.name = "mug";
  {
    const profile = [
      [0, 0], [0.2, 0], [0.25, 0.04], [0.27, 0.5], [0.275, 0.6], [0.24, 0.6], [0.235, 0.1], [0, 0.1],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = mesh(mug, new THREE.LatheGeometry(profile, 20), solid(0x8d8272, 0.5, 0.3), 0.018);
    body.name = "mug-body";
    const handle = mesh(mug, new THREE.TorusGeometry(0.16, 0.034, 8, 16, Math.PI), solid(0x8d8272, 0.5, 0.3), 0.014);
    handle.position.set(0.27, 0.34, 0);
    handle.rotation.z = -Math.PI / 2;
    handle.name = "mug-handle";
  }

  // Tray with a worn brass rim, holding the deck at its own angle.
  const trayX = -1.75, trayZ = 0.66;
  const tray = place(trayX, trayZ, -9);
  {
    const outer = roundedRect(1.7, 1.05, 0.14);
    const base = mesh(tray, new THREE.ExtrudeGeometry(outer, { depth: 0.035, bevelEnabled: false }), walnut([0.5, 0.36, 0.26]), 0.016);
    base.rotation.x = -Math.PI / 2;
    const ring = roundedRect(1.7, 1.05, 0.14);
    ring.holes.push(roundedRect(1.52, 0.87, 0.1));
    const rim = mesh(tray, new THREE.ExtrudeGeometry(ring, { depth: 0.11, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), solid(0x9a6b3a, 0.5, 0.55), 0.016);
    rim.rotation.x = -Math.PI / 2;
    rim.name = "tray-rim";
    const deck = new THREE.Group();
    deck.name = "tarot-deck";
    deck.position.set(0.02, 0.035, 0.02);
    deck.rotation.y = rad(24);
    tray.add(deck);
    const edge = solid(0xd9c8a2, 0.9);
    const face = solid(0xffffff, 0.7);
    face.map = back.texture;
    const cards = mesh(deck, new THREE.BoxGeometry(0.5, 0.16, 0.8), [edge, edge, face, edge, edge, edge] as unknown as THREE.Material, 0.014);
    cards.position.y = 0.08;
    const loose = mesh(deck, new THREE.BoxGeometry(0.5, 0.018, 0.8), [edge, edge, face, edge, edge, edge] as unknown as THREE.Material, 0.01);
    loose.position.set(0.05, 0.17, -0.03);
    loose.rotation.y = rad(-9);
  }

  const { x: bookX, zf: bookZ } = STUDY_SPOTS.astrology.book;
  if (mode === "astrology") {
    const book = place(bookX, bookZ, 10);
    book.name = "closed-book";
    const cover = mesh(book, new RoundedBoxGeometry(1.0, 0.13, 1.3, 2, 0.02), solid(0x1d3a46, 0.85), 0.018);
    cover.position.y = 0.065;
    const pages = mesh(book, new THREE.BoxGeometry(0.9, 0.09, 1.22), solid(0xe6dcc0, 0.95), 0);
    pages.position.set(0.03, 0.065, 0);
    const clasp = mesh(book, new THREE.BoxGeometry(0.05, 0.135, 1.3), solid(0xb8924a, 0.45, 0.6), 0);
    clasp.position.set(-0.46, 0.066, 0);
    const pen = place(bookX - 0.08, bookZ + 0.04, -32, 0.13);
    pen.name = "book-pen";
    const barrel = mesh(pen, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 12), solid(0x131c2a, 0.35, 0.3), 0.012);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.y = 0.03;
    const band = mesh(pen, new THREE.CylinderGeometry(0.034, 0.034, 0.05, 12), solid(0xc9a45a, 0.4, 0.7), 0);
    band.rotation.z = Math.PI / 2;
    band.position.set(0.22, 0.03, 0);
    const nib = mesh(pen, new THREE.ConeGeometry(0.03, 0.12, 12), solid(0xb9b2a2, 0.35, 0.7), 0.008);
    nib.rotation.z = Math.PI / 2;
    nib.position.set(-0.48, 0.03, 0);
  }

  // The vintage chair is pulled out from the desk and angled toward the reader's side.
  const floor = desk.top - (STUDY_TABLE.top + STUDY_TABLE.legHeight) * s;
  const chair = new THREE.Group();
  chair.name = "vintage-chair";
  chair.position.set(-3 + 2.1 * s, floor, desk.front + 1.35 * s);
  chair.rotation.y = rad(-34);
  chair.scale.setScalar(s * 1.05);
  root.add(chair);
  {
    const frame = walnut([0.36, 0.26, 0.2]);
    const velvet = solid(0x5a2432, 0.95);
    const seatY = 1.75;
    const legs: [number, number][] = [[-0.62, -0.58], [0.62, -0.58], [-0.62, 0.58], [0.62, 0.58]];
    for (const [x, z] of legs) {
      const leg = mesh(chair, new THREE.CylinderGeometry(0.085, 0.06, seatY, 10), frame, 0.02);
      leg.position.set(x, seatY / 2, z);
    }
    for (const z of [-0.58, 0.58]) {
      const rail = mesh(chair, new THREE.BoxGeometry(1.24, 0.07, 0.07), frame, 0.015);
      rail.position.set(0, 0.55, z);
    }
    const seat = mesh(chair, new RoundedBoxGeometry(1.5, 0.16, 1.4, 3, 0.07), frame, 0.02);
    seat.position.y = seatY + 0.08;
    const cushion = mesh(chair, new RoundedBoxGeometry(1.34, 0.17, 1.24, 4, 0.08), velvet, 0.018);
    cushion.position.y = seatY + 0.22;
    // Back posts rise behind the seat, joined by a curved top rail and spindles.
    for (const x of [-0.66, 0.66]) {
      const post = mesh(chair, new THREE.CylinderGeometry(0.075, 0.065, 1.9, 10), frame, 0.02);
      post.position.set(x, seatY + 0.95, -0.62);
      const finial = mesh(chair, new THREE.SphereGeometry(0.085, 10, 8), frame, 0.015);
      finial.position.set(x, seatY + 1.95, -0.62);
    }
    const top = mesh(chair, new THREE.TorusGeometry(0.66, 0.06, 8, 20, Math.PI), frame, 0.02);
    top.rotation.z = Math.PI;
    top.position.set(0, seatY + 1.35, -0.62);
    top.scale.set(1, 0.34, 1);
    for (const x of [-0.36, -0.12, 0.12, 0.36]) {
      const spindle = mesh(chair, new THREE.CylinderGeometry(0.028, 0.028, 1.2, 8), frame, 0.012);
      spindle.position.set(x, seatY + 0.8, -0.62);
    }
    const panel = mesh(chair, new RoundedBoxGeometry(1.2, 0.5, 0.1, 3, 0.04), velvet, 0.016);
    panel.position.set(0, seatY + 0.75, -0.6);
  }

  // The shadow under the desk swallows the robe's lower edge instead of cutting it off at the floor.
  const shadowTexture = shadowGradient();
  owner.cleanup?.(() => shadowTexture.dispose());
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  owner.material(shadowMaterial);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.8 * s, 2.3 * s), shadowMaterial);
  owner.geometry(shadow.geometry);
  shadow.name = "under-desk-shadow";
  shadow.position.set(-3, floor + 0.45 * s, 0.22);
  shadow.renderOrder = 25;
  root.add(shadow);

  let dead = false;
  return {
    group: root,
    dispose() {
      if (dead) return;
      dead = true;
      root.removeFromParent();
      root.clear();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      cleanups.forEach((f) => f());
      wood.release();
      back.release();
    },
  };
}

function roundedRect(width: number, depth: number, radius: number) {
  const x = -width / 2, y = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** A soft elliptical shadow, built as raw pixels so it needs no canvas. */
function shadowGradient() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      const alpha = distance >= 1 ? 0 : distance < 0.55 ? 0.92 - (0.3 * distance) / 0.55 : 0.62 * (1 - (distance - 0.55) / 0.45);
      data.set([8, 5, 3, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
