import * as THREE from "three";
import type { RouteScene, ViewData } from "@pxoracle/contracts";
export interface SceneInstance {
  setShadows?(enabled: boolean): void;
  scene: THREE.Scene;
  camera: THREE.Camera;
  needsRender?(): boolean;
  render?(renderer: THREE.WebGLRenderer): void;
  gesture?(event: { dx: number; dy: number; zoom: number }): boolean;
  pointer?(event: { type: "focus" | "select"; x: number; y: number }): void;
  enter(): void;
  resize?(width: number, height: number): void;
  update(time: number, data: ViewData, reduced: boolean): void;
  exit(): void;
  dispose(): void;
}
export type SceneFactory = (
  leases: TextureLeases,
  signal: AbortSignal,
) => Promise<SceneInstance>;
export class TextureLeases {
  private entries = new Map<
    string,
    { refs: number; promise: Promise<THREE.Texture> }
  >();
  async acquire(url: string) {
    let entry = this.entries.get(url);
    if (!entry) {
      const promise = new THREE.TextureLoader()
        .loadAsync(url)
        .then((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.NearestFilter;
          return texture;
        });
      entry = { refs: 0, promise };
      this.entries.set(url, entry);
    }
    entry.refs++;
    const owned = entry;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (--owned.refs === 0) {
        if (this.entries.get(url) === owned) this.entries.delete(url);
        void owned.promise.then(
          (t) => t.dispose(),
          () => {},
        );
      }
    };
    try {
      return { texture: await entry.promise, release };
    } catch (error) {
      release();
      throw error;
    }
  }
  get count() {
    return this.entries.size;
  }
}
/** Conservative fallback for measured software rasterizers; renderer details stay local. */
export function supportsStudyShadows(rendererName: string, maxTextureSize: number) {
  return maxTextureSize >= 512 && !/swiftshader|llvmpipe|softpipe|software rasterizer/i.test(rendererName);
}
export class SceneRuntime {
  readonly leases = new TextureLeases();
  private renderer: THREE.WebGLRenderer;
  private studyShadows = true;
  private active: SceneInstance | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  private frame = 0;
  private start = performance.now();
  private entered = 0;
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  private stopped = false;
  private reduced: MediaQueryList;
  private viewData: ViewData = {};
  private dirty = true;
  private presentationPending = false;
  private lastRender = -Infinity;
  private lastReduced = false;
  private isFrozen = false;
  private acceptingInput = false;
  private firstFramePending = false;
  private down: { x: number; y: number; id: number; moved: boolean } | null =
    null;
  private pointerDown = (e: PointerEvent) => {
    this.previousPointer = {x:e.clientX,y:e.clientY};
    this.down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  };
  private previousPointer: {x:number;y:number} | null = null;
  private pointerMove = (e: PointerEvent) => {
    if (
      this.down &&
      Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8
    )
      this.down.moved = true;
    if (this.down?.moved && this.previousPointer && this.acceptingInput) {
      this.dirty = this.active?.gesture?.({dx:(e.clientX-this.previousPointer.x)/this.width,dy:(e.clientY-this.previousPointer.y)/this.height,zoom:0}) || this.dirty;
      this.previousPointer = {x:e.clientX,y:e.clientY};
    }
    if (e.pointerType !== "touch") this.sendPointer(e, "focus");
  };
  private pointerUp = (e: PointerEvent) => {
    if (
      this.down?.id === e.pointerId &&
      !this.down.moved &&
      Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) <= 8
    )
      this.sendPointer(e, "select");
    this.down = null;
  };
  private wheel = (event: WheelEvent) => {
    if(this.acceptingInput && this.active?.gesture?.({dx:0,dy:0,zoom:Math.sign(event.deltaY)*.06})) { event.preventDefault(); this.dirty=true; }
  };
  private pointerCancel = () => {
    this.down = null;
  };
  private sendPointer(e: PointerEvent, type: "focus" | "select") {
    if (!this.acceptingInput) return;
    const r = this.canvas.getBoundingClientRect();
    this.active?.pointer?.({
      type,
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: 1 - ((e.clientY - r.top) / r.height) * 2,
    });
    this.dirty = true;
  }
  get data() {
    return this.viewData;
  }
  set data(value: ViewData) {
    this.viewData = value;
    this.dirty = true;
  }
  get frozen() {
    return this.isFrozen;
  }
  set frozen(value: boolean) {
    if (value !== this.isFrozen) this.dirty = true;
    this.isFrozen = value;
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private status: (s: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    const gl = this.renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
    this.studyShadows = supportsStudyShadows(rendererName, this.renderer.capabilities.maxTextureSize);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      this.width = r.width;
      this.height = r.height;
      this.dirty = true;
      this.renderer.setSize(r.width, r.height, false);
      this.active?.resize?.(r.width, r.height);
    });
    this.observer.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.lost);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    canvas.addEventListener("wheel", this.wheel, {passive:false});
    this.tick();
  }
  private lost = (event: Event) => {
    event.preventDefault();
    this.status("Graphics unavailable. The reading controls remain available.");
    cancelAnimationFrame(this.frame);
  };
  private tick = () => {
    if (this.stopped) return;
    const now = performance.now();
    const reduced = this.frozen || this.reduced.matches;
    if (reduced !== this.lastReduced) this.dirty = true;
    this.lastReduced = reduced;
    const invalidated = this.dirty || !!this.active?.needsRender?.();
    if (
      this.active &&
      (invalidated ||
        this.presentationPending ||
        (!reduced && now - this.lastRender >= 1000 / 30))
    ) {
      // WebKit's software compositor can retain the previous canvas after a lone draw.
      // Present one identical follow-up frame after invalidation, then return to idle.
      this.presentationPending = reduced && invalidated;
      this.dirty = false;
      this.lastRender = now;
      this.active.update(
        this.frozen ? 0 : (now - this.start) / 1000,
        this.data,
        this.frozen || this.reduced.matches,
      );
      if (this.active.render) this.active.render(this.renderer);
      else this.renderer.render(this.active.scene, this.active.camera);
      if (this.firstFramePending) {
        this.firstFramePending = false;
        this.acceptingInput = true;
        this.status("");
      }
      this.canvas.style.opacity = reduced
        ? "1"
        : String(Math.min(1, (now - this.entered) / 550));
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  cancelPreparation() {
    this.acceptingInput = false;
    this.firstFramePending = false;
    this.presentationPending = false;
    this.down = null;
    ++this.generation;
    this.abort?.abort();
  }
  async navigate(factory: SceneFactory) {
    this.acceptingInput = false;
    this.firstFramePending = false;
    this.presentationPending = false;
    const generation = ++this.generation;
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.status("Preparing the room…");
    let next: SceneInstance | null = null;
    try {
      next = await factory(this.leases, signal);
      if (signal.aborted || generation !== this.generation || this.stopped) {
        next.dispose();
        return;
      }
      next.setShadows?.(this.studyShadows);
      this.active?.exit();
      this.active?.dispose();
      this.active = next;
      this.firstFramePending = true;
      this.dirty = true;
      next.resize?.(this.width, this.height);
      next.enter();
      this.entered = performance.now();
    } catch {
      next?.dispose();
      if (generation === this.generation && !signal.aborted)
        this.status(
          "The scene could not load. Retry the scene or continue using the reading controls.",
        );
    }
  }
  dispose() {
    this.stopped = true;
    ++this.generation;
    this.abort?.abort();
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.active?.dispose();
    this.active = null;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
  diagnostics() {
    return {
      textures: this.leases.count,
      geometries: this.renderer.info.memory.geometries,
      gpuTextures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      programs: this.renderer.info.programs?.length ?? 0,
    };
  }
}
export type { RouteScene, ViewData };
