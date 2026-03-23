import { randomUUID } from "node:crypto";
import IORedis from "ioredis";
import {
  getWorkerSessionLockTtlMs,
  getWorkerSessionLockWaitMs,
} from "./config";

const LOCK_RETRY_INTERVAL_MS = 250;
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

let lockRedis: IORedis | undefined;

function getLockRedis(): IORedis {
  if (!lockRedis) {
    lockRedis = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
  }

  return lockRedis;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSessionLockKey(channelId: string, waId: string): string {
  return `worker:session-lock:${channelId}:${waId}`;
}

export interface SessionLock {
  release(): Promise<void>;
}

export async function acquireSessionLock(
  channelId: string,
  waId: string
): Promise<SessionLock> {
  const redis = getLockRedis();
  const ttlMs = getWorkerSessionLockTtlMs();
  const waitMs = getWorkerSessionLockWaitMs();
  const lockKey = getSessionLockKey(channelId, waId);
  const lockToken = randomUUID();
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    const result = await redis.set(lockKey, lockToken, "PX", ttlMs, "NX");

    if (result === "OK") {
      let released = false;

      return {
        async release() {
          if (released) {
            return;
          }

          released = true;
          await redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken);
        },
      };
    }

    await sleep(LOCK_RETRY_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting ${waitMs}ms for session lock ${channelId}/${waId}`
  );
}
