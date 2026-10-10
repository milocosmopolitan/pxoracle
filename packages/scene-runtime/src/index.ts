import * as THREE from "three";
import type { RouteScene, ViewData } from "@pxoracle/contracts";
export interface SceneInstance {
  scene: THREE.Scene;
  camera: THREE.Camera;
  enter(): void;
  resize?(width:number,height:number):void;
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
export class SceneRuntime {
  readonly leases = new TextureLeases();
  private renderer: THREE.WebGLRenderer;
  private active: SceneInstance | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  private frame = 0;
  private start = performance.now();
  private entered = 0;
  private width=1;
  private height=1;
  private observer: ResizeObserver;
  private stopped = false;
  private reduced: MediaQueryList;
  data: ViewData = {};
  frozen = false;
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      this.width=r.width;this.height=r.height;
      this.renderer.setSize(r.width, r.height, false);
      this.active?.resize?.(r.width,r.height);
    });
    this.observer.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.lost);
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
    if (this.active) {
      this.active.update(
        this.frozen ? 0 : (now - this.start) / 1000,
        this.data,
        this.frozen || this.reduced.matches,
      );
      this.renderer.render(this.active.scene, this.active.camera);
      this.canvas.style.opacity = this.reduced.matches
        ? "1"
        : String(Math.min(1, (now - this.entered) / 550));
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  cancelPreparation() {
    ++this.generation;
    this.abort?.abort();
  }
  async navigate(factory: SceneFactory) {
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
      this.active?.exit();
      this.active?.dispose();
      this.active = next;
      next.resize?.(this.width,this.height);
      next.enter();
      this.entered = performance.now();
      this.status("");
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
    };
  }
}
export type { RouteScene, ViewData };
