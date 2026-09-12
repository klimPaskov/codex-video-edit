import { normalize, resolve } from "node:path";

const queues = new Map<string, Promise<unknown>>();

/** Windows paths are case-insensitive; use one key/comparison form without changing stored paths. */
export function canonicalProjectStorePath(path: string): string {
  const canonical = normalize(resolve(path));
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

export function sameProjectStorePath(left: string, right: string): boolean {
  return canonicalProjectStorePath(left) === canonicalProjectStorePath(right);
}

/** One root-wide queue keeps navigation and draft commits from racing on disk. */
export function serializeProjectStore<T>(
  root: string,
  work: () => Promise<T>,
): Promise<T> {
  const key = canonicalProjectStorePath(root);
  const result = (queues.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  queues.set(key, result);
  void result
    .finally(() => {
      if (queues.get(key) === result) queues.delete(key);
    })
    .catch(() => undefined);
  return result;
}
