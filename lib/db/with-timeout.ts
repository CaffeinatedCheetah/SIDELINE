export class DbTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "DbTimeoutError";
  }
}

/**
 * Races a query promise against a timer so a hung DB connection degrades to
 * a rejected promise instead of leaving `loading.tsx` up indefinitely.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 8000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DbTimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
