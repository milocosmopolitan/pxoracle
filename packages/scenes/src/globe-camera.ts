import * as THREE from "three";
import type { GlobeView } from "@pxoracle/contracts/globe-view";
import type { GeographicFocus } from "@pxoracle/contracts/globe-geography";

export const MIN_COUNTRY_RADIUS = .39;
/** Camera input has no city or coordinate-entry dependency. */
export function globeShot(view: GlobeView, focus: GeographicFocus | null, center: THREE.Vector3, camera: THREE.PerspectiveCamera) {
  const room = view.phase === "room";
  const target = room ? new THREE.Vector3(-3, .7, .15) : center.clone();
  const angular = (focus?.angularRadius ?? 90) * Math.PI / 180;
  const radius = room ? 4.2 : view.phase === "overview" ? 1.15 : Math.max(MIN_COUNTRY_RADIUS, .78 * .91 * Math.sin(Math.min(Math.PI / 2, angular)) * 1.25);
  // The painted room is 10 units tall: a narrow stage must not pull the camera back far enough to expose its edges.
  const available = Math.max(room ? radius / 5 : .08, Math.min(view.viewport.height, view.viewport.width * camera.aspect));
  // Bound distance outside relief and mounting ring even for a one-pixel country.
  const distance = Math.max(2.2, radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / available);
  // The table framing looks down a few degrees so the real tabletop reads as a surface.
  return { target, position: target.clone().add(new THREE.Vector3(0, room ? distance * .16 : .04, distance)), radius };
}
