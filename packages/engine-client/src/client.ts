import { isWireResponse, type Feature } from "@pxoracle/contracts";
export class EngineClient {
  private worker: Worker | null = null;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(private feature: Feature) {}
  private open() {
    if (this.worker) return this.worker;
    const worker = new Worker(`/engines/${this.feature}/worker.mjs`, {
      type: "module",
      name: `pxoracle-${this.feature}`,
    });
    worker.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (!isWireResponse(data)) {
        this.dispose("INVALID_RESPONSE");
        return;
      }
      const task = this.pending.get(data.id);
      if (!task) return;
      clearTimeout(task.timer);
      this.pending.delete(data.id);
      if (data.ok) task.resolve(data.result);
      else task.reject(new Error(data.error.code));
    };
    worker.onerror = () => this.dispose("ENGINE_LOAD_FAILED");
    worker.onmessageerror = () => this.dispose("INVALID_RESPONSE");
    this.worker = worker;
    return worker;
  }
  request<T>(payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.open(),
        id = ++this.sequence;
      const timer = setTimeout(() => this.dispose("ENGINE_TIMEOUT"), 45000);
      this.pending.set(id, {
        resolve: resolve as (x: unknown) => void,
        reject,
        timer,
      });
      try {
        worker.postMessage({ version: 1, id, payload });
      } catch {
        this.dispose("ENGINE_SEND_FAILED");
      }
    });
  }
  dispose(code = "ENGINE_EVICTED") {
    this.worker?.terminate();
    this.worker = null;
    for (const task of this.pending.values()) {
      clearTimeout(task.timer);
      task.reject(new Error(code));
    }
    this.pending.clear();
  }
}
