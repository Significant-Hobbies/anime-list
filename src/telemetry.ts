// Lightweight timing wrapper for Worker operations.

export interface TraceOptions {
  silent?: boolean;
  project?: string;
  projectId?: string;
  context?: Record<string, unknown>;
}

/** Time an async operation (formerly ops' trace — console timing, rethrows on error). */
export async function trace<T>(
  name: string,
  fn: () => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    if (!options.silent)
      console.info(`[trace] ${name} completed in ${(performance.now() - start).toFixed(2)}ms`);
    return result;
  } catch (err) {
    if (!options.silent)
      console.error(`[trace] ${name} failed after ${(performance.now() - start).toFixed(2)}ms`);
    throw err;
  }
}
