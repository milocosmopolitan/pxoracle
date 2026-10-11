import * as THREE from "three";
import type { RigOwner } from "./tarot-rig";
import { surfaceMaterial } from "./tarot-materials";

/** Separate heavy-knit drapes with pinned shoulders, damped hems and a closed fabric edge. */
export function createShawl(texture: THREE.Texture, owner: RigOwner) {
  const material = surfaceMaterial("cloth", texture, owner);
  material.color.setRGB(.82, .78, .98);
  material.side = THREE.DoubleSide;
  material.normalScale.setScalar(.65);
  const columns = 14, rows = 16;
  const panels = [-1, 1].map((side) => {
    const geometry = new THREE.PlaneGeometry(1, 1, columns, rows);
    owner.geometry(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = side < 0 ? "right-shawl" : "left-shawl";
    mesh.userData.pixelate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    // A second surface and a rounded rolled edge give the knit actual thickness.
    const lining = new THREE.Mesh(geometry.clone(), material);
    lining.name = `${mesh.name}-lining`;
    owner.geometry(lining.geometry);
    const perimeter: number[] = [];
    for (let col = 0; col <= columns; col++) perimeter.push(col);
    for (let row = 1; row <= rows; row++) perimeter.push(row * (columns + 1) + columns);
    for (let col = columns - 1; col >= 0; col--) perimeter.push(rows * (columns + 1) + col);
    for (let row = rows - 1; row > 0; row--) perimeter.push(row * (columns + 1));
    const edgeGeometry = new THREE.BufferGeometry();
    const edgeSegments = 8;
    edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(perimeter.length * edgeSegments * 3), 3));
    const edgeUV: number[] = [], edgeIndices: number[] = [];
    perimeter.forEach((_, i) => {
      for (let k = 0; k < edgeSegments; k++) {
        edgeUV.push(i / perimeter.length * 3, k / edgeSegments);
        const a = i * edgeSegments + k, b = ((i + 1) % perimeter.length) * edgeSegments + k;
        const c = i * edgeSegments + (k + 1) % edgeSegments;
        const d = ((i + 1) % perimeter.length) * edgeSegments + (k + 1) % edgeSegments;
        edgeIndices.push(a, b, c, b, d, c);
      }
    });
    edgeGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(edgeUV, 2));
    edgeGeometry.setIndex(edgeIndices);
    owner.geometry(edgeGeometry);
    const edge = new THREE.Mesh(edgeGeometry, material);
    edge.name = `${mesh.name}-knit-hem`;
    for (const child of [lining, edge]) {
      child.castShadow = child.receiveShadow = true;
      child.frustumCulled = false;
      child.userData.pixelate = true;
      mesh.add(child);
    }
    const count = geometry.attributes.position.count;
    const current = Array.from({ length: count }, () => new THREE.Vector3());
    const previous = current.map(() => new THREE.Vector3());
    const target = current.map(() => new THREE.Vector3());
    const links: [number, number][] = [];
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      const i = row * (columns + 1) + col;
      if (col < columns) links.push([i, i + 1]);
      if (row < rows) links.push([i, i + columns + 1]);
      if (row < rows && col < columns) links.push([i, i + columns + 2]);
      // Bending links resist the tight folding of a thin sheet.
      if (row + 2 <= rows) links.push([i, i + 2 * (columns + 1)]);
      if (col + 2 <= columns) links.push([i, i + 2]);
    }
    let ready = false;
    return { mesh, lining, edge, perimeter, edgeSegments, current, previous, target, links, ready };
  });
  const group = new THREE.Group();
  group.name = "oracle-shawl";
  group.add(...panels.map((p) => p.mesh));
  const delta = new THREE.Vector3(), nearest = new THREE.Vector3();
  function capsule(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    delta.subVectors(b, a);
    const t = THREE.MathUtils.clamp(nearest.subVectors(point, a).dot(delta) / Math.max(delta.lengthSq(), .001), 0, 1);
    nearest.copy(a).addScaledVector(delta, t);
    delta.subVectors(point, nearest);
    if (delta.lengthSq() < radius * radius) {
      if (delta.lengthSq() < 1e-8) delta.set(0, -1, 0);
      point.copy(nearest).addScaledVector(delta.normalize(), radius);
    }
  }
  return {
    group,
    update(arms: { shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3 }[], dt: number, settled: boolean) {
      panels.forEach((panel, index) => {
        const { shoulder, elbow, wrist } = arms[index];
        const side = index === 0 ? -1 : 1;
        // Open front drapes hang from a narrow shoulder seam. They never wrap the arm.
        const topInner = shoulder.clone().add(new THREE.Vector3(-side * .58, -.33, .08));
        const topOuter = shoulder.clone().add(new THREE.Vector3(side * .16, -.23, .03));
        const bottomInner = shoulder.clone().add(new THREE.Vector3(-side * .48, -.43, -2.30));
        const bottomOuter = elbow.clone().add(new THREE.Vector3(side * .14, -.32, -.32));
        for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
          const v = row / rows, u = col / columns;
          const inner = topInner.clone().lerp(bottomInner, v);
          const outer = topOuter.clone().lerp(bottomOuter, v);
          const p = panel.target[row * (columns + 1) + col];
          p.lerpVectors(inner, outer, u);
          // Broad folds remain rounded instead of fluttering into sharp paper creases.
          const fold = Math.sin(u * Math.PI * 2.5 + v * .65);
          p.y -= fold * .15 * Math.sin(v * Math.PI * .8);
          p.z -= Math.sin(u * Math.PI) * .22 * v;
          p.z += .13 * Math.pow(Math.abs(u - .5) * 2, 3) * v * v;
        }
        if (!panel.ready || settled || dt > .1) {
          panel.current.forEach((p, i) => p.copy(panel.target[i]));
          panel.previous.forEach((p, i) => p.copy(panel.target[i]));
          panel.ready = true;
        } else {
          const steps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 60))));
          const h = Math.min(dt / steps, 1 / 60);
          for (let step = 0; step < steps; step++) {
            panel.current.forEach((p, i) => {
              if (i <= columns) return;
              const old = p.clone();
              p.addScaledVector(delta.subVectors(p, panel.previous[i]), .68);
              p.z -= 3 * h * h;
              p.lerp(panel.target[i], .075);
              panel.previous[i].copy(old);
            });
            for (let iteration = 0; iteration < 4; iteration++) {
              panel.current.slice(0, columns + 1).forEach((p, i) => p.copy(panel.target[i]));
              for (const [a, b] of panel.links) {
                const rest = panel.target[a].distanceTo(panel.target[b]);
                delta.subVectors(panel.current[b], panel.current[a]);
                const length = delta.length();
                if (length < 1e-7) continue;
                delta.multiplyScalar((length - rest) / length * .45);
                if (a > columns) panel.current[a].add(delta);
                if (b > columns) panel.current[b].sub(delta);
              }
              panel.current.forEach((p, i) => {
                if (i <= columns) return;
                capsule(p, shoulder, elbow, .395);
                capsule(p, elbow, wrist, .29);
                if (p.y < 4.2) p.z = Math.max(.065, p.z);
                // Prevent stale-frame inertia from stretching cloth across the character.
                delta.subVectors(p, panel.target[i]);
                if (delta.length() > .24) p.copy(panel.target[i]).addScaledVector(delta.normalize(), .24);
              });
            }
          }
        }
        const positions = panel.mesh.geometry.attributes.position;
        panel.current.forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z));
        positions.needsUpdate = true;
        panel.mesh.geometry.computeVertexNormals();
        const normals = panel.mesh.geometry.attributes.normal;
        const liningPositions = panel.lining.geometry.attributes.position;
        const normal = new THREE.Vector3(), tangent = new THREE.Vector3(), across = new THREE.Vector3();
        const halfThickness = .028;
        panel.current.forEach((p, i) => {
          normal.fromBufferAttribute(normals, i);
          liningPositions.setXYZ(i, p.x - normal.x * halfThickness * 2, p.y - normal.y * halfThickness * 2, p.z - normal.z * halfThickness * 2);
        });
        liningPositions.needsUpdate = true;
        panel.lining.geometry.computeVertexNormals();
        const edgePositions = panel.edge.geometry.attributes.position;
        panel.perimeter.forEach((vertex, i) => {
          const p = panel.current[vertex];
          normal.fromBufferAttribute(normals, vertex);
          tangent.subVectors(panel.current[panel.perimeter[(i + 1) % panel.perimeter.length]], panel.current[panel.perimeter[(i + panel.perimeter.length - 1) % panel.perimeter.length]]).normalize();
          across.crossVectors(tangent, normal).normalize();
          for (let k = 0; k < panel.edgeSegments; k++) {
            const angle = k / panel.edgeSegments * Math.PI * 2;
            delta.copy(p).addScaledVector(normal, (Math.cos(angle) - 1) * halfThickness).addScaledVector(across, Math.sin(angle) * halfThickness);
            edgePositions.setXYZ(i * panel.edgeSegments + k, delta.x, delta.y, delta.z);
          }
        });
        edgePositions.needsUpdate = true;
        panel.edge.geometry.computeVertexNormals();
      });
    },
  };
}
