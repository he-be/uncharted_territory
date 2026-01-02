export class SystemManager {
  private metrics: Map<string, number> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type
  run(name: string, fn: Function, ...args: any[]) {
    const start = performance.now();
    fn(...args);
    const duration = performance.now() - start;
    this.metrics.set(name, duration);
  }

  getMetrics() {
    return this.metrics;
  }

  getMetric(name: string): number {
    return this.metrics.get(name) || 0;
  }
}
