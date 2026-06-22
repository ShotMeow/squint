/**
 * Minimal async semaphore. `run` executes at most `max` callbacks concurrently;
 * the rest wait in FIFO order. Used to cap concurrent LLM requests across the
 * whole extension so opening many files doesn't fire a request storm.
 */
export class Semaphore {
  private permits: number;
  private readonly waiters: Array<() => void> = [];

  constructor(max: number) {
    this.permits = Math.max(1, Math.floor(max));
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next(); // hand the permit directly to the next waiter
    } else {
      this.permits += 1;
    }
  }
}
