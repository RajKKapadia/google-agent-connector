const DEFAULT_WORKER_CONCURRENCY = 5;
const DEFAULT_WORKER_SESSION_LOCK_TTL_MS = 120_000;
const DEFAULT_WORKER_SESSION_LOCK_WAIT_MS = 30_000;

function getPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

export function getWorkerConcurrency(): number {
  return getPositiveIntEnv("WORKER_CONCURRENCY", DEFAULT_WORKER_CONCURRENCY);
}

export function getWorkerSessionLockTtlMs(): number {
  return getPositiveIntEnv(
    "WORKER_SESSION_LOCK_TTL_MS",
    DEFAULT_WORKER_SESSION_LOCK_TTL_MS
  );
}

export function getWorkerSessionLockWaitMs(): number {
  return getPositiveIntEnv(
    "WORKER_SESSION_LOCK_WAIT_MS",
    DEFAULT_WORKER_SESSION_LOCK_WAIT_MS
  );
}
