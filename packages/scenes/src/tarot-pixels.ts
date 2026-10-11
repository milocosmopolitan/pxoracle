import * as THREE from "three";

/** Pixelate marked mesh limbs; retain full-resolution artwork and depth-correct occlusion. */
export function createPixelPresentation() {
  const options = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  };
  const full = new THREE.WebGLRenderTarget(1, 1, options);
  const low = new THREE.WebGLRenderTarget(1, 1, options);
  const mask = new THREE.WebGLRenderTarget(1, 1, options);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      full: { value: full.texture },
      low: { value: low.texture },
      mask: { value: mask.texture },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D full,low,mask; varying vec2 vUv;
      void main(){gl_FragColor=mix(texture2D(full,vUv),texture2D(low,vUv),step(.5,texture2D(mask,vUv).r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  const masks = [
    new Map<THREE.Material, THREE.MeshBasicMaterial>(),
    new Map<THREE.Material, THREE.MeshBasicMaterial>(),
  ];
  let width = 1,
    height = 1;
  function maskMaterial(source: THREE.Material, selected: boolean) {
    const cache = masks[selected ? 1 : 0];
    let result = cache.get(source);
    if (!result) {
      const original = source as THREE.MeshBasicMaterial;
      result = new THREE.MeshBasicMaterial({
        color: selected ? 0xffffff : 0x000000,
        map: original.map,
        transparent: source.transparent,
        alphaTest: source.alphaTest,
        depthWrite: source.depthWrite,
        side: source.side,
      });
      result.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
          diffuseColor.a *= texture2D(map,vMapUv).a;
        #endif`,
        );
      };
      result.customProgramCacheKey = () => "oracle-selection-mask";
      cache.set(source, result);
    }
    return result;
  }
  return {
    resize(w: number, h: number) {
      width = w;
      height = h;
      const pixel = w < 760 ? 1.5 : 2;
      low.setSize(
        Math.max(1, Math.round(w / pixel)),
        Math.max(1, Math.round(h / pixel)),
      );
      mask.setSize(low.width, low.height);
    },
    render(
      renderer: THREE.WebGLRenderer,
      world: THREE.Scene,
      view: THREE.Camera,
    ) {
      const shadowType = renderer.shadowMap.type;
      const previous = renderer.getRenderTarget(),
        shadows = renderer.shadowMap.enabled,
        update = renderer.shadowMap.autoUpdate;
      const pixelRatio = renderer.getPixelRatio();
      if (
        full.width !== Math.round(width * pixelRatio) ||
        full.height !== Math.round(height * pixelRatio)
      )
        full.setSize(
          Math.max(1, Math.round(width * pixelRatio)),
          Math.max(1, Math.round(height * pixelRatio)),
        );
      const meshes: THREE.Mesh[] = [],
        selected: THREE.Mesh[] = [];
      world.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          meshes.push(object);
          if (object.userData.pixelate && object.visible) selected.push(object);
        }
      });
      const saved = meshes.map((mesh) => mesh.material);
      try {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setRenderTarget(low);
        renderer.render(world, view);
        renderer.shadowMap.autoUpdate = false;
        selected.forEach((mesh) => (mesh.visible = false));
        renderer.setRenderTarget(full);
        renderer.render(world, view);
        selected.forEach((mesh) => (mesh.visible = true));
        meshes.forEach(
          (mesh) =>
            (mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map((m) =>
                  maskMaterial(m, !!mesh.userData.pixelate),
                )
              : maskMaterial(mesh.material, !!mesh.userData.pixelate)),
        );
        renderer.shadowMap.enabled = false;
        renderer.setRenderTarget(mask);
        renderer.render(world, view);
        meshes.forEach((mesh, i) => (mesh.material = saved[i]));
        renderer.setRenderTarget(previous);
        renderer.render(screen, camera);
      } finally {
        selected.forEach((mesh) => (mesh.visible = true));
        meshes.forEach((mesh, i) => (mesh.material = saved[i]));
        renderer.shadowMap.enabled = shadows;
        renderer.shadowMap.autoUpdate = update;
        renderer.shadowMap.type = shadowType;
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      full.dispose();
      low.dispose();
      mask.dispose();
      geometry.dispose();
      material.dispose();
      masks.forEach((cache) => {
        cache.forEach((m) => m.dispose());
        cache.clear();
      });
    },
  };
}
