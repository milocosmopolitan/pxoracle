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
  const glow = new THREE.WebGLRenderTarget(1, 1, {
    ...options, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const blurOptions = { ...options, type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const glowHorizontal = new THREE.WebGLRenderTarget(1, 1, blurOptions);
  const glowBlurred = new THREE.WebGLRenderTarget(1, 1, blurOptions);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: glow.texture }, step: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D source; uniform vec2 step; varying vec2 vUv;
      void main(){vec4 sum=vec4(0.); float total=0.;
        for(int i=-3;i<=3;i++) {float weight=exp(-float(i*i)/4.5);
          sum+=texture2D(source,vUv+float(i)*step)*weight;total+=weight;}
        gl_FragColor=sum/total;}`,
    depthTest: false, depthWrite: false,
  });
  const blurScreen = new THREE.Scene();
  blurScreen.add(new THREE.Mesh(geometry, blurMaterial));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      full: { value: full.texture },
      low: { value: low.texture },
      mask: { value: mask.texture },
      glow: { value: glowBlurred.texture },
      glowStep: { value: new THREE.Vector2(1, 1) },
      glowStrength: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D full,low,mask,glow; uniform vec2 glowStep; uniform float glowStrength; varying vec2 vUv;
      void main(){gl_FragColor=mix(texture2D(full,vUv),texture2D(low,vUv),step(.5,texture2D(mask,vUv).r));
        if(glowStrength > 0.) {
          #ifdef SEPARABLE_GLOW
            gl_FragColor.rgb += texture2D(glow,vUv).rgb*glowStrength;
          #else
            vec3 bloom=vec3(0.); float total=0.;
            for(int x=-3;x<=3;x++) for(int y=-3;y<=3;y++) {
              float weight=exp(-float(x*x+y*y)/4.5);
              bloom+=texture2D(glow,vUv+vec2(float(x),float(y))*glowStep*2.).rgb*weight;
              total+=weight;
            }
            gl_FragColor.rgb += bloom/total*glowStrength;
          #endif
        }
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
  let separableGlow: boolean | undefined;
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
      glow.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      glowHorizontal.setSize(glow.width, glow.height);
      glowBlurred.setSize(glow.width, glow.height);
      material.uniforms.glowStep.value.set(1 / glow.width, 1 / glow.height);
    },
    render(
      renderer: THREE.WebGLRenderer,
      world: THREE.Scene,
      view: THREE.Camera,
    ) {
      if (separableGlow === undefined) {
        // Keep the original filter on devices without renderable half-float targets.
        separableGlow = renderer.extensions.has("EXT_color_buffer_float");
        material.defines = separableGlow ? { SEPARABLE_GLOW: 1 } : {};
        material.uniforms.glow.value = separableGlow ? glowBlurred.texture : glow.texture;
        material.needsUpdate = true;
      }
      const shadowType = renderer.shadowMap.type;
      const background = world.background;
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
      const effects: (THREE.Points | THREE.Sprite)[] = [];
      world.traverse((object) => {
        if ((object instanceof THREE.Points || object instanceof THREE.Sprite) && object.visible) effects.push(object);
      });
      try {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
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
        effects.forEach((effect) => (effect.visible = false));
        renderer.setRenderTarget(mask);
        renderer.render(world, view);
        meshes.forEach((mesh, i) => (mesh.material = saved[i]));
        const visible = (object: THREE.Object3D) => {
          for (let node: THREE.Object3D | null = object; node; node = node.parent)
            if (!node.visible) return false;
          return true;
        };
        effects.forEach((effect) => (effect.visible = true));
        const glowing = [...meshes, ...effects].some((object) => object.userData.glow && visible(object));
        material.uniforms.glowStrength.value = glowing ? 2.8 : 0;
        if (glowing) {
          world.background = new THREE.Color(0x000000);
          meshes.forEach((mesh, i) => {
            if (!mesh.userData.glow) mesh.material = Array.isArray(saved[i])
              ? (saved[i] as THREE.Material[]).map((m) => maskMaterial(m, false))
              : maskMaterial(saved[i] as THREE.Material, false);
          });
          effects.forEach((effect) => (effect.visible = !!effect.userData.glow));
          renderer.setRenderTarget(glow);
          renderer.render(world, view);
          meshes.forEach((mesh, i) => (mesh.material = saved[i]));
          world.background = background;
          // The original 7×7 Gaussian factors into two identical 7-tap kernels.
          // Filter at glow resolution instead of taking 49 samples per display pixel.
          if (separableGlow) {
            blurMaterial.uniforms.source.value = glow.texture;
            blurMaterial.uniforms.step.value.set(2 / glow.width, 0);
            renderer.setRenderTarget(glowHorizontal);
            renderer.render(blurScreen, camera);
            blurMaterial.uniforms.source.value = glowHorizontal.texture;
            blurMaterial.uniforms.step.value.set(0, 2 / glow.height);
            renderer.setRenderTarget(glowBlurred);
            renderer.render(blurScreen, camera);
          }
        }
        renderer.setRenderTarget(previous);
        renderer.render(screen, camera);
      } finally {
        world.background = background;
        effects.forEach((effect) => (effect.visible = true));
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
      glow.dispose();
      glowHorizontal.dispose();
      glowBlurred.dispose();
      geometry.dispose();
      blurMaterial.dispose();
      material.dispose();
      masks.forEach((cache) => {
        cache.forEach((m) => m.dispose());
        cache.clear();
      });
    },
  };
}
