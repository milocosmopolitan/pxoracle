import * as THREE from "three";
import { CARD_WIDTH, CARD_HEIGHT } from "./tarot-layout";

/** Clip the baked fringe outside the gold frame without changing the source artwork. */
export function finishCardFace(material: THREE.MeshBasicMaterial, crop: boolean) {
  material.transparent = false;
  material.depthWrite = true;
  material.alphaTest = 0.5;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
       vec2 cardUv = vMapUv;
       vec2 corner = abs(cardUv - .5) - vec2(.47, .48);
       if (length(max(corner, 0.0)) > .02) discard;
       ${crop ? "cardUv = cardUv * vec2(.89, .962) + vec2(.055, .014);" : ""}
       diffuseColor *= texture2D(map, cardUv);
       #endif`,
    );
  };
  material.customProgramCacheKey = () => `tarot-frame-${crop}`;
}

export function createCardInscription() {
  const group = new THREE.Group();
  group.name = "card-inscription";
  const geometry = new THREE.PlaneGeometry(CARD_WIDTH * .78, CARD_HEIGHT * .064);
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const label = new THREE.Mesh(geometry, material);
  label.position.set(0, -CARD_HEIGHT * .435, .006);
  group.add(label);
  const points = new Float32Array(42 * 3);
  const colors = new Float32Array(42 * 3);
  const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const drift = (seed: number, time: number) => {
    const step = Math.floor(time), f = time - step, smooth = f * f * (3 - 2 * f);
    return THREE.MathUtils.lerp(hash(seed + step * 17), hash(seed + (step + 1) * 17), smooth);
  };
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  dustGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const dustMaterial = new THREE.PointsMaterial({
    vertexColors: true, color: 0xffce78, size: .04, transparent: true, opacity: .38,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  dustMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <premultiplied_alpha_fragment>",
      "gl_FragColor.a *= pow(max(0.0, 1.0 - length(gl_PointCoord - .5) * 2.0), 2.0);",
    );
  };
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = "detail-stardust";
  dust.userData.glow = true;
  group.add(dust);
  let lastName = "", texture: THREE.Texture | undefined;
  return {
    group,
    /** `name` draws the legacy label; composed faces pass "" because their banners carry text. */
    update(name: string, focused: boolean, time: number, reduced: boolean, dustColor = 0xffce78) {
      dustMaterial.color.set(dustColor);
      group.userData.cardName = name;
      if (name !== lastName) {
        lastName = name;
        texture?.dispose();
        if (typeof document !== "undefined") {
          const canvas = document.createElement("canvas");
          canvas.width = 1024; canvas.height = 128;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#382919";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            let size = 78;
            do { ctx.font = `${size--}px Georgia, 'Times New Roman', serif`; }
            while (ctx.measureText(name).width > 960 && size > 24);
            ctx.fillText(name, 512, 67);
            texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
          }
        }
      }
      label.visible = !!name && !!texture;
      dust.visible = focused;
      if (!focused) return;
      const t = reduced ? 0 : time;
      for (let i = 0; i < 42; i++) {
        const angle = hash(i + 1) * Math.PI * 2;
        const speed = .13 + hash(i + 84) * .23;
        const dx = drift(i * 13 + 1, t * speed) * 2 - 1;
        const dy = drift(i * 19 + 2, t * speed * .83) * 2 - 1;
        const text = i < 12;
        const edge = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
        points[i * 3] = text ? dx * CARD_WIDTH * .38 : Math.cos(angle) / edge * CARD_WIDTH * (.57 + hash(i + 41) * .10) + dx * .045;
        points[i * 3 + 1] = text ? -CARD_HEIGHT * .435 + dy * .024 : Math.sin(angle) / edge * CARD_HEIGHT * (.56 + hash(i + 62) * .07) + dy * .055;
        points[i * 3 + 2] = text ? .003 : -.025;
        const brightness = .25 + drift(i * 23, t * (.22 + hash(i + 4) * .3)) * .75;
        colors.fill(brightness, i * 3, i * 3 + 3);
      }
      dustGeometry.attributes.position.needsUpdate = true;
      dustGeometry.attributes.color.needsUpdate = true;
      dustMaterial.opacity = .65;
    },
    dispose() {
      texture?.dispose(); geometry.dispose(); material.dispose();
      dustGeometry.dispose(); dustMaterial.dispose();
    },
  };
}
