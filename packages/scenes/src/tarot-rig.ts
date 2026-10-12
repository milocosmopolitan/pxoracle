import * as THREE from "three";
import { surfaceMaterial } from "./tarot-materials";
import { CARD_GRIP_Y } from "./tarot-layout";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
/** Reviewers read 9 as oversized beside the cards; the grip follows fingertips, not this scale. */
const HAND_SCALE = 7.8;
export type HandPose = "rest" | "support" | "packet" | "pinch" | "release";
export interface RigOwner {
  geometry(g: THREE.BufferGeometry): void;
  material(m: THREE.Material): void;
  cleanup?(dispose: () => void): void;
}

/** Quantized pigment in model space stays on the skin when joints rotate. */
export function pixelMaterial(color: number, owner: RigOwner, grainScale = 42) {
  const material = new THREE.MeshToonMaterial({ color });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vPigment;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvPigment = position;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vPigment;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 cell = floor(vPigment * ${grainScale.toFixed(1)});
      float grain = fract(sin(dot(cell, vec3(12.9898,78.233,37.719))) * 43758.5453);
      diffuseColor.rgb *= .90 + floor(grain * 3.0) * .065;
    `,
    );
  };
  material.customProgramCacheKey = () => `oracle-pixel-pigment-${grainScale}`;
  owner.material(material);
  return material;
}

/** A real joint hierarchy and weighted hand surface; no hand/arm sprite atlas. */
export async function createArm(
  side: "left" | "right",
  owner: RigOwner,
  signal: AbortSignal,
  textures?: { skin: THREE.Texture; cloth: THREE.Texture },
) {
  const root = new THREE.Group();
  root.name = `${side}-arm-rig`;

  const wrist = new THREE.Group();
  wrist.name = `${side}-wrist`;
  root.add(wrist);
  const handAnchor = new THREE.Group();
  handAnchor.name = side === "right" ? "handAnchor" : "supportAnchor";
  root.add(handAnchor);
  const skin = textures
      ? surfaceMaterial("skin", textures.skin, owner)
      : pixelMaterial(0xa9785c, owner),
    handSkin = textures
      ? surfaceMaterial("skin", textures.skin, owner)
      : pixelMaterial(0xa9785c, owner, 380),
    cloth = textures
      ? surfaceMaterial("cloth", textures.cloth, owner)
      : pixelMaterial(0x242238, owner);
  const response = await fetch(`/art/hand-mesh/${side}.glb`, { signal });
  if (!response.ok) throw new Error("Hand mesh could not load");
  const gltf = await new GLTFLoader().parseAsync(
    await response.arrayBuffer(),
    "",
  );
  const model = gltf.scene;
  let skeleton: THREE.Skeleton | undefined;
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      owner.geometry(object.geometry);
      object.castShadow = true;
      object.receiveShadow = true;
      const original = Array.isArray(object.material)
        ? object.material
        : [object.material];
      original.forEach((m) => m.dispose());
      object.material = handSkin;
      if (object instanceof THREE.SkinnedMesh) {
        skeleton = object.skeleton;
        owner.cleanup?.(() => object.skeleton.dispose());
        object.frustumCulled = false;
      }
    }
  });
  if (signal.aborted) throw new Error("aborted");
  const base = model.getObjectByName("wrist") as THREE.Bone;
  const origin = base.getWorldPosition(new THREE.Vector3());
  const fingers: THREE.Bone[][] = [];
  for (const name of ["index", "middle", "ring", "pinky"]) {
    const chain = [
      "metacarpal",
      "phalanx-proximal",
      "phalanx-intermediate",
      "phalanx-distal",
      "tip",
    ].map(
      (part) => model.getObjectByName(`${name}-finger-${part}`) as THREE.Bone,
    );
    let parent: THREE.Object3D = base;
    for (const bone of chain) {
      parent.attach(bone);
      parent = bone;
    }
    fingers.push(chain);
  }
  const thumb = ["metacarpal", "phalanx-proximal", "phalanx-distal", "tip"].map(
    (part) => model.getObjectByName(`thumb-${part}`) as THREE.Bone,
  );
  let parent: THREE.Object3D = base;
  for (const bone of thumb) {
    parent.attach(bone);
    parent = bone;
  }
  model.updateMatrixWorld(true);
  const rests = new Map<
    THREE.Bone,
    { q: THREE.Quaternion; axis: THREE.Vector3; opposition: THREE.Vector3 }
  >();
  for (const bone of [...fingers.flat(), ...thumb]) {
    const inverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    rests.set(bone, {
      q: bone.quaternion.clone(),
      axis: new THREE.Vector3(0, 0, side === "right" ? -1 : 1).applyQuaternion(
        inverse,
      ),
      opposition: new THREE.Vector3(-1, 0, 0).applyQuaternion(inverse),
    });
  }
  const normalized = new THREE.Group();
  normalized.rotation.y = side === "right" ? -Math.PI / 2 : Math.PI / 2;
  normalized.scale.setScalar(HAND_SCALE);
  model.position.sub(origin);
  normalized.add(model);
  wrist.add(normalized);
  model.name = `${side}-skinned-hand`;
  function bend(bone: THREE.Bone, angle: number) {
    const rest = rests.get(bone)!;
    bone.quaternion
      .copy(rest.q)
      .multiply(new THREE.Quaternion().setFromAxisAngle(rest.axis, angle));
  }
  function limb(
    name: string,
    length: number,
    upper: number,
    lower: number,
    material: THREE.Material,
  ) {
    const profile = [
      new THREE.Vector2(lower, -length / 2),
      new THREE.Vector2(lower * 1.04, -length * 0.4),
      new THREE.Vector2((lower + upper) * 0.52, -length * 0.12),
      new THREE.Vector2(upper * 1.06, length * 0.18),
      new THREE.Vector2(upper, length * 0.46),
      new THREE.Vector2(upper * 0.96, length / 2),
    ];
    const geometry = new THREE.LatheGeometry(profile, 16);
    owner.geometry(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${side}-${name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  const length = 2.1,
    upperLength = 2.2;
  const forearm = limb("forearm", length, 0.3, 0.18, skin);
  const sleeve = limb("sleeve", upperLength, 0.36, 0.35, cloth);
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.365, 0.38, 0.26, 16),
    cloth,
  );
  cuff.name = `${side}-rolled-cuff`;
  cuff.castShadow = cuff.receiveShadow = true;
  owner.geometry(cuff.geometry);
  root.add(cuff);
  const elbowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 12),
    cloth,
  );
  elbowMesh.name = `${side}-cloth-elbow`;
  elbowMesh.castShadow = elbowMesh.receiveShadow = true;
  owner.geometry(elbowMesh.geometry);
  root.add(elbowMesh);
  const shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3();
  const localY = new THREE.Vector3(0, 1, 0);
  const skinMeshes: THREE.SkinnedMesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) skinMeshes.push(object);
  });
  function align(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(localY, b.clone().sub(a).normalize());
  }
  function tip(bone: THREE.Bone) {
    return root.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
  }
  let cachedPose = "",
    supportMix = 0,
    gripMix = 0,
    stableFrames = 0;
  function update(
    grip: THREE.Vector3,
    pose: HandPose,
    held = false,
    lean = 0,
    turn = 0,
    blend = 1,
    lateral = 0,
    attachment?: THREE.Vector3,
  ) {
    const key = [
      pose,
      ...grip.toArray(),
      lean,
      turn,
      lateral,
      ...(attachment?.toArray() ?? []),
    ]
      .map((v) => (typeof v === "number" ? v.toFixed(4) : v))
      .join(":");
    if (key === cachedPose) {
      if (blend === 1 || ++stableFrames > 24) return;
    } else {
      cachedPose = key;
      stableFrames = 0;
    }
    supportMix = THREE.MathUtils.lerp(
      supportMix,
      pose === "support" ? 1 : 0,
      blend === 1 ? 1 : Math.min(blend, 0.25),
    );
    gripMix = THREE.MathUtils.lerp(
      gripMix,
      pose === "pinch" || pose === "packet" ? 1 : 0,
      blend === 1 ? 1 : Math.min(blend, 0.25),
    );
    const previousWrist = wrist.quaternion.clone();
    const previous = new Map(
      [...fingers.flat(), ...thumb].map((b) => [b, b.quaternion.clone()]),
    );
    handAnchor.position.copy(grip);
    shoulder.copy(
      attachment ??
        new THREE.Vector3(
          (side === "right" ? -1.25 : 1.25) + lateral,
          5.25 - lean,
          2.3,
        ),
    );
    wrist.position.set(0, 0, 0);
    const yaw = THREE.MathUtils.clamp(
      Math.atan2(grip.x - shoulder.x, Math.max(0.7, shoulder.y - grip.y)),
      -0.45,
      0.45,
    );
    wrist.rotation.set(0, Math.PI * supportMix + turn * (1 - supportMix), yaw);
    const curl =
      pose === "packet"
        ? 0.85
        : pose === "support"
          ? 0.4
          : pose === "release"
            ? 0.18
            : 0.3;
    fingers.forEach((chain, f) =>
      chain.forEach((bone, j) =>
        bend(
          bone,
          j === 0 || j === 4
            ? 0
            : pose === "pinch" || pose === "packet"
              ? f === 0
                ? (side === "right"
                    ? [0, 0.844, 1.406, 0.437, 0]
                    : [0, 0.893, 1.357, 0.306, 0])[j]
                : [0, 0.3, 0.55, 0.3, 0][j]
              : curl * [0, 0.7, 1, 0.65, 0][j],
        ),
      ),
    );
    thumb.forEach((bone, j) =>
      bend(
        bone,
        j === 3
          ? 0
          : pose === "pinch" || pose === "packet"
            ? (side === "right" ? [0.22, 0.66, 0.107] : [0.217, 0.683, 0.006])[
                j
              ]
            : curl * 0.4,
      ),
    );
    thumb[0].quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        rests.get(thumb[0])!.opposition,
        pose === "pinch" || pose === "packet" ? 1.003 : 0.05,
      ),
    );
    for (const [bone, q] of previous)
      bone.quaternion.slerpQuaternions(q, bone.quaternion.clone(), blend);
    root.updateMatrixWorld(true);
    skeleton?.update();
    const cloud: THREE.Vector3[] = [];
    const inverseWrist = wrist.matrixWorld.clone().invert();
    for (const mesh of skinMeshes) {
      const toWrist = inverseWrist.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
        cloud.push(
          mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(toWrist),
        );
    }
    const previousElbow = elbow.clone();
    function solveElbow() {
      const delta = wrist.position.clone().sub(shoulder),
        distance = delta.length(),
        axis = delta.clone().normalize();
      const reach = THREE.MathUtils.clamp(
        distance,
        Math.abs(length - upperLength) + 0.001,
        length + upperLength - 0.001,
      );
      const a =
        (upperLength * upperLength - length * length + reach * reach) /
        (2 * reach);
      const radius = Math.sqrt(Math.max(0, upperLength * upperLength - a * a));
      const center = shoulder.clone().addScaledVector(axis, a);
      const preferred = new THREE.Vector3(
        (side === "right" ? -1.6 : 1.6) + lateral,
        5.6 - lean,
        -0.1,
      ).sub(center);
      const u = preferred
        .clone()
        .addScaledVector(axis, -preferred.dot(axis))
        .normalize();
      const v = new THREE.Vector3().crossVectors(axis, u).normalize();
      let cost = Infinity;
      for (let n = 0; n <= 96; n++) {
        const angle = (n / 96 - 0.5) * Math.PI,
          candidate = center
            .clone()
            .addScaledVector(u, Math.cos(angle) * radius)
            .addScaledVector(v, Math.sin(angle) * radius);
        let penetration = 0;
        // Elbows can hang below the desk behind its rear edge. Only actual desk intersections matter.
        for (let k = 0; k <= 8; k++) {
          const point = candidate.clone().lerp(wrist.position, k / 8);
          if (point.y < 4.3 && Math.abs(point.x) < 7.2)
            penetration += Math.max(0, 0.28 - point.z) ** 2;
        }
        const score =
          candidate.distanceToSquared(center.clone().add(preferred)) +
          200 * penetration +
          (blend < 1 ? 8 * candidate.distanceToSquared(previousElbow) : 0) +
          40 *
            Math.max(
              0,
              side === "right"
                ? candidate.x - lateral + 0.2
                : 0.2 - candidate.x + lateral,
            ) **
              2;

        if (score < cost) {
          cost = score;
          elbow.copy(candidate);
        }
      }
      return distance <= length + upperLength;
    }
    let minimum = Infinity,
      lift = 0,
      reachable = true;
    function placeWrist() {
      wrist.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const contact = new THREE.Vector3(
        0,
        -0.75 * (HAND_SCALE / 9) + 0.25 * supportMix,
        -0.28 - 0.04 * supportMix,
      ).applyQuaternion(wrist.quaternion);
      contact.lerp(
        tip(thumb[3]).add(tip(fingers[0][4])).multiplyScalar(0.5),
        gripMix,
      );
      wrist.position
        .copy(grip)
        .sub(contact)
        .add(
          new THREE.Vector3(0, -CARD_GRIP_Y, -0.15).multiplyScalar(supportMix),
        );
      // Reuse one skinned surface sample across the wrist/elbow iterations.
      minimum = Infinity;
      const vertex = new THREE.Vector3();
      for (const local of cloud)
        minimum = Math.min(
          minimum,
          vertex.copy(local).applyQuaternion(wrist.quaternion).z +
            wrist.position.z,
        );
      lift = Math.max(0, 0.055 - minimum);
      wrist.position.z += lift;
    }
    for (let pass = 0; pass < 4; pass++) {
      placeWrist();
      reachable = solveElbow();
      if (pass < 3) {
        const y = elbow.clone().sub(wrist.position);
        // Keep a stable forward hand axis near vertical forearms; cross(up) otherwise flips 180 degrees.
        y.y = Math.max(0.6, y.y);
        y.x = THREE.MathUtils.clamp(y.x, -y.y * 0.85, y.y * 0.85);
        y.z = THREE.MathUtils.clamp(y.z, -y.y * 0.75, y.y * 0.75);
        y.normalize();
        const x = new THREE.Vector3()
          .crossVectors(y, new THREE.Vector3(0, 0, 1))
          .normalize();
        const z = new THREE.Vector3().crossVectors(x, y).normalize();
        wrist.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(x, y, z),
        );
        wrist.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            localY,
            Math.PI * supportMix + turn * (1 - supportMix),
          ),
        );
      }
    }
    if (blend < 1) {
      const destination = wrist.quaternion.clone();
      wrist.quaternion
        .copy(previousWrist)
        .rotateTowards(destination, Math.max(0.025, blend * 0.32));
      placeWrist();
      reachable = solveElbow();
    }
    align(forearm, wrist.position, elbow);
    align(sleeve, elbow, shoulder);
    elbowMesh.position.copy(elbow);

    // A closed cuff follows the forearm and overlaps the clothed elbow on both bend sides.
    cuff.position
      .copy(elbow)
      .addScaledVector(wrist.position.clone().sub(elbow).normalize(), 0.18);
    cuff.quaternion.copy(forearm.quaternion);
    root.userData.pose = pose;
    root.userData.wrist = wrist.position.toArray();
    root.userData.elbow = elbow.toArray();
    root.userData.shoulder = shoulder.toArray();
    root.userData.reachable = reachable;
    root.userData.minimumSurfaceHeight = minimum + lift;
    root.userData.contactLift = lift;
    root.updateMatrixWorld(true);
  }
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.userData.pixelate = true;
  });
  update(
    new THREE.Vector3(side === "right" ? -1.65 : 1.65, 2.25, 0.18),
    "rest",
  );
  return { root, handAnchor, update, length, skeleton };
}
