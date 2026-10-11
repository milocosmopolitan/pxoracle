import * as THREE from "three";
import type { TextureLeases } from "@pxoracle/scene-runtime";

export const LAMP_SHADOW_SIZE = 512;
export const LAMP_DOWNLIGHT_INTENSITY = 24;

/** Local +Y is up, foot is at zero, shade bends +X (the old sprite was flipped). */
export async function createLamp(_leases: TextureLeases, signal: AbortSignal) {
  signal.throwIfAborted();
  const group = new THREE.Group();
  group.name = "bronze-desk-lamp";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let dead = false;
  // Deterministic woven and stippled paint, generated locally without image/network dependencies.
  function surface(fabric: boolean, relief = false) {
    const size = 128, bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const grain = ((x * 17 + y * 31 + (x * y % 23) * 7) % 29) / 29;
      const weave = (x % 4 === 0 ? -.025 : .012) + (y % 4 === 0 ? -.03 : .012);
      const patina = Math.sin(x * .17) * Math.sin(y * .23) * .12;
      const value = fabric ? .85 + weave + grain * .08 : .68 + patina + grain * .2;
      const rgb = relief ? [value, value, value] : fabric ? [value, value * .79, value * .48] : [value * .95, value * .76, value * .45];
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) bytes[i + c] = Math.round(Math.min(1, rgb[c]) * 255);
      bytes[i + 3] = 255;
    }
    const t = new THREE.DataTexture(bytes, size, size);
    if (!relief) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    textures.add(t);
    return t;
  }
  function material(options: THREE.MeshStandardMaterialParameters) {
    const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m;
  }
  const metalMap = surface(false), metalRelief = surface(false, true);
  const bronze = material({ color: 0xe4cda1, map: metalMap, bumpMap: metalRelief, bumpScale: .012, roughnessMap: metalRelief, metalness: .62, roughness: .62 });
  const edge = material({ color: 0xa88043, metalness: .8, roughness: .38 });
  const dark = material({ color: 0x34271d, metalness: .52, roughness: .8 });
  const weaveMap = surface(true), weaveRelief = surface(true, true);
  const cloth = material({ map: weaveMap, bumpMap: weaveRelief, bumpScale: .0025, roughness: .95, emissiveMap: weaveMap, emissive: 0xffca82, emissiveIntensity: .65 });
  cloth.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= .35 + .65 * sin(3.14159265 * clamp(vMapUv.y, 0.0, 1.0));');
  };
  cloth.customProgramCacheKey = () => 'lamp-woven-shade-glow-v1';
  const lining = material({ color: 0xc6a878, bumpMap: weaveRelief, bumpScale: .004, roughness: .95, emissive: 0xffbb65, emissiveIntensity: .3 });
  const seam = material({ color: 0x665032, roughness: .93 });
  function mesh(name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group) {
    geometries.add(geometry);
    const obj = new THREE.Mesh(geometry, mat); obj.name = name;
    obj.castShadow = obj.receiveShadow = true;
    parent.add(obj); return obj;
  }
  function lathe(name: string, profile: number[][], mat: THREE.Material, parent = group) {
    return mesh(name, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64), mat, parent);
  }
  function ring(name: string, radius: number, tube: number, y: number, parent = group) {
    const obj = mesh(name, new THREE.TorusGeometry(radius, tube, 8, 64), edge, parent);
    obj.rotation.x = Math.PI / 2; obj.position.y = y; return obj;
  }
  const bulb = new THREE.Object3D(); bulb.name = "lamp-bulb-anchor";
  const target = new THREE.Object3D(); target.name = "lamp-desk-target";
  const light = new THREE.SpotLight(0xffcb87, LAMP_DOWNLIGHT_INTENSITY, 10, .79, .65, 2);
  light.position.set(0, 0, 0);
  light.name = "lamp-primary-warm-shadow";
  // Restrained transmitted fabric glow, justified by the otherwise unlit nearby brass/globe.
  const fill = new THREE.PointLight(0xffd3a0, 3, 7, 2);
  fill.name = "lamp-fabric-transmission-fill";
  fill.castShadow = false;
  function dispose() {
    if (dead) return;
    dead = true;
    light.shadow.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    group.removeFromParent(); group.clear();
  }
  try {
    lathe("layered-turned-bronze-foot", [[0,0],[.47,0],[.53,.02],[.55,.05],[.55,.14],[.53,.17],[.49,.19],[.47,.22],[.43,.26],[.39,.29],[.36,.3],[.34,.33],[.29,.35],[.24,.39],[.21,.44],[.19,.49],[.17,.55],[.13,.61],[.12,.67],[0,.67]], bronze);
    ring("foot-lower-bead", .537,.016,.16);
    ring("foot-upper-bead", .36,.012,.31);
    ring("stem-socket-bead", .126,.018,.63);
    const stem = new THREE.CatmullRomCurve3([[0,.58,0],[-.05,.92,0],[-.045,1.27,0],[.07,1.55,0],[.28,1.72,0],[.48,1.8,0]].map(p => new THREE.Vector3(...p)));
    mesh("swept-curved-bronze-stem", new THREE.TubeGeometry(stem, 48,.067,12,false), bronze);
    const shade = new THREE.Group(); shade.name = "thick-lined-flared-shade";
    shade.position.set(.49,1.84,0); shade.rotation.z = .055; group.add(shade);
    // Separate outer/inner surfaces with closed hem profiles, never a double-sided paper cone.
    lathe("woven-shade-outer", [[.86,0],[.865,.025],[.843,.065],[.78,.19],[.69,.39],[.61,.59],[.52,.81],[.47,.93],[.465,.96]], cloth, shade);
    lathe("woven-shade-inner", [[.443,.96],[.448,.93],[.50,.80],[.59,.59],[.67,.39],[.76,.19],[.819,.065],[.84,.025],[.84,0]], lining, shade);
    lathe("closed-lower-fabric-hem", [[.84,0],[.86,0],[.872,.014],[.873,.04],[.847,.052],[.827,.044],[.84,0]], seam, shade);
    lathe("closed-upper-fabric-hem", [[.443,.96],[.465,.96],[.477,.945],[.475,.925],[.451,.922],[.438,.94],[.443,.96]], seam, shade);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const curve = new THREE.CatmullRomCurve3([[.849,.05],[.69,.39],[.61,.59],[.471,.929]].map(([r,y]) => new THREE.Vector3(Math.sin(angle)*r,y,Math.cos(angle)*r)));
      mesh(`fabric-panel-piping-${i}`,new THREE.TubeGeometry(curve,12,.008,4,false),seam,shade);
    }
    const socket = lathe("bulb-socket-and-collar",[[0,-.12],[.082,-.12],[.102,-.09],[.105,.035],[.16,.05],[.18,.075],[.18,.10],[.14,.12],[0,.12]],bronze,shade);
    // The bulb is represented by a point emitter; exclude its small socket from its own shadow.
    socket.castShadow = false;
    // A small finial socket leaves the lined interior visible through the upper aperture.
    lathe("top-cap",[[0,.93],[.065,.93],[.065,.963],[0,.963]],bronze,shade);
    lathe("shade-finial",[[0,.95],[.04,.95],[.045,1.00],[.071,1.015],[.075,1.05],[.056,1.09],[0,1.11]],edge,shade);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const c = new THREE.LineCurve3(new THREE.Vector3(0,.90,0),new THREE.Vector3(Math.cos(a)*.445,.94,Math.sin(a)*.445));
      mesh(`shade-support-${i}`,new THREE.TubeGeometry(c,1,.012,5,false),dark,shade);
    }
    mesh("finial-support-spindle",new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0,.10,0),new THREE.Vector3(0,.95,0)),1,.015,6,false),bronze,shade);
    bulb.position.set(0,.16,0); shade.add(bulb);
    const bulbMesh = mesh("hidden-bulb",new THREE.SphereGeometry(.085,12,8),material({color:0xffe4ac,emissive:0xffc77a,emissiveIntensity:.75}),bulb);
    bulbMesh.castShadow = false;
    bulb.add(light);
    fill.position.set(0,.22,0); bulb.add(fill);
    target.position.set(.65,-.08,.25); group.add(target); light.target = target;
    light.castShadow = true; light.shadow.mapSize.setScalar(LAMP_SHADOW_SIZE);
    light.shadow.camera.near = .12; light.shadow.camera.far = 10;
    light.shadow.bias = -.0003; light.shadow.normalBias = .015;
    light.shadow.focus = 1;
    signal.throwIfAborted();
    return { group, bulb, light, fill, target, dispose, setShadows(enabled: boolean) {
      light.castShadow = enabled;
      if (!enabled) { light.shadow.dispose(); light.shadow.map = null; light.shadow.mapPass = null; }
    } };
  } catch (error) { dispose(); throw error; }
}
