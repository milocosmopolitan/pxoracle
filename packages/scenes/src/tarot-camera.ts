import * as THREE from "three";
import { SPREAD_GAP } from "./tarot-layout";
export type CameraProfile = "A" | "B" | "C";
export const TABLE_ORIGIN = new THREE.Vector3(-3, -1, 1);
/** Angles are measured down from the horizontal tabletop, not from vertical. */
export const CAMERA_PROFILES = {
  A: { elevation: 52, mobileElevation: 61, azimuth: 0 },
  B: { elevation: 52, mobileElevation: 61, azimuth: 12 },
  C: { elevation: 68, mobileElevation: 68, azimuth: 0 },
} as const;
export function frameTarot(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  approach: number,
  reading: number,
  profile: CameraProfile = "A",
  panel = false,
) {
  const mobile = width < 760,
    aspect = width / Math.max(1, height);
  const spec = CAMERA_PROFILES[profile];
  const elevation = THREE.MathUtils.degToRad(
    THREE.MathUtils.lerp(
      mobile ? spec.mobileElevation : spec.elevation,
      68,
      reading * 0.65,
    ),
  );
  const azimuth = THREE.MathUtils.degToRad(spec.azimuth * (mobile ? 0.35 : 1));
  const distance = Math.max(
    mobile ? 12 : 13,
    (mobile ? 3.0 : 5.8) / (aspect * Math.tan(Math.PI / 10)),
  );
  const shift = !mobile && panel ? reading * 2.6 : 0;
  const target = TABLE_ORIGIN.clone().add(
    new THREE.Vector3(shift, 0.2, mobile ? 1.35 : 1.45),
  );
  const close = target
    .clone()
    .add(
      new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(elevation) * distance,
        Math.sin(elevation) * distance,
        Math.cos(azimuth) * Math.cos(elevation) * distance,
      ),
    );
  const conversationTarget = new THREE.Vector3(mobile ? -3 : -0.4, 0.9, -2);
  const conversation = conversationTarget
    .clone()
    .add(new THREE.Vector3(0, 4, mobile ? 22 : 18));
  camera.position.lerpVectors(conversation, close, approach);
  camera.lookAt(conversationTarget.lerp(target, approach));
  camera.fov = 36;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export type ReviewShot =
  "shuffle" | "selection" | "reveal" | "reading" | "detail";
export const REVIEW_SHOTS = {
  shuffle: {
    elevation: 43,
    mobileElevation: 47,
    target: [0, 1.4, 0.35],
    width: 3.45,
    mobileWidth: 2.25,
  },
  selection: {
    elevation: 58,
    mobileElevation: 65,
    target: [0, 0.2, 0.08],
    width: 4.6,
    mobileWidth: 2.4,
  },
  reveal: {
    elevation: 48,
    mobileElevation: 52,
    target: [0, -0.35, 0.25],
    width: 2.65,
    mobileWidth: 2.0,
  },
  reading: {
    elevation: 55,
    mobileElevation: 60,
    target: [0, -0.35, 0.08],
    width: 2.0,
    mobileWidth: 1.85,
  },
  detail: {
    elevation: 55,
    mobileElevation: 60,
    target: [0, -0.35, 0.08],
    width: 0.85,
    mobileWidth: 0.85,
  },
} as const;
/** Approved phase compositions; table coordinates remain fixed. */
export function frameReview(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  shot: ReviewShot,
  count: 1 | 3 = 3,
  panelWidth = 0,
) {
  const spec = REVIEW_SHOTS[shot],
    mobile = width < 760,
    aspect = width / Math.max(height, 1);
  const target = TABLE_ORIGIN.clone().add(
    new THREE.Vector3(spec.target[0], spec.target[2], -spec.target[1]),
  );
  if (mobile && shot !== "reading" && shot !== "detail")
    target.z += shot === "selection" ? 0.5 : 0.3;
  const elevation = THREE.MathUtils.degToRad(
    mobile ? spec.mobileElevation : spec.elevation,
  );
  const single = shot === "detail" || (shot === "reading" && count === 1);
  const halfWidth = single ? 0.85 : mobile ? spec.mobileWidth : spec.width;
  const framingAspect = (width - panelWidth) / Math.max(height, 1);
  const distance = Math.max(
    single ? 2.6 : shot === "reading" ? 4.2 : shot === "shuffle" ? 7.2 : 5.5,
    halfWidth / (Math.min(framingAspect, 1.45) * Math.tan(Math.PI / 10)),
  );
  camera.position
    .copy(target)
    .add(
      new THREE.Vector3(
        0,
        Math.sin(elevation) * distance,
        Math.cos(elevation) * distance,
      ),
    );
  camera.lookAt(target);
  camera.position.x +=
    (distance * Math.tan(Math.PI / 10) * panelWidth) / Math.max(height, 1);
  camera.fov = 36;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/** Scene-local camera timeline. Pointer focus never restarts a camera move. */
export class TarotCameraDirector {
  private key = "";
  private started = 0;
  private duration = 0;
  private fromPosition = new THREE.Vector3();
  private fromRotation = new THREE.Quaternion();
  private destination = new THREE.PerspectiveCamera();
  update(
    camera: THREE.PerspectiveCamera,
    time: number,
    width: number,
    height: number,
    view: import("@pxoracle/contracts").TarotView,
    reduced: boolean,
  ) {
    const shot: ReviewShot | "conversation" =
      view.phase === "conversation"
        ? "conversation"
        : ["approach", "shuffle"].includes(view.phase)
          ? "shuffle"
          : ["fan", "selecting", "dealing"].includes(view.phase)
            ? "selection"
            : view.phase === "reading"
              ? view.readingFocus == null
                ? "reading"
                : "detail"
              : "reveal";
    const focus =
      shot === "reveal"
        ? view.index
        : shot === "detail"
          ? view.readingFocus!
          : null;
    const key = `${shot}:${focus}:${width}:${height}:${view.readingPanel}`;
    if (shot === "conversation")
      frameTarot(this.destination, width, height, 0, 0);
    else {
      frameReview(
        this.destination,
        width,
        height,
        shot,
        view.spread,
        width >= 760 && view.readingPanel && view.phase === "reading" ? 380 : 0,
      );
      const offset = new THREE.Vector3(
        focus == null ? 0 : (focus - (view.spread - 1) / 2) * SPREAD_GAP,
        0,
        0,
      );
      this.destination.position.add(offset);
    }
    if (key !== this.key) {
      if (!this.key && view.phase === "approach")
        frameTarot(camera, width, height, 0, 0);
      this.fromPosition.copy(camera.position);
      this.fromRotation.copy(camera.quaternion);
      this.started = time;
      this.duration =
        !this.key && view.phase !== "approach"
          ? 0
          : shot === "conversation"
            ? 1.4
            : view.phase === "approach"
              ? 2.4
              : view.phase === "fan"
                ? 0.8
                : shot === "reveal"
                  ? 0.55
                  : 0.85;
      this.key = key;
    }
    const t =
        reduced || !this.duration
          ? 1
          : THREE.MathUtils.clamp((time - this.started) / this.duration, 0, 1),
      e = t * t * (3 - 2 * t);
    camera.position.lerpVectors(
      this.fromPosition,
      this.destination.position,
      e,
    );
    camera.quaternion.slerpQuaternions(
      this.fromRotation,
      this.destination.quaternion,
      e,
    );
    camera.fov = 36;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
}
