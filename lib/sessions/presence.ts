import type IORedis from "ioredis";
import Redis from "ioredis";

export const WEBSITE_SESSION_PRESENCE_TTL_SECONDS = 75;
export const WEBSITE_SESSION_PRESENCE_REFRESH_INTERVAL_MS = 25_000;

function createRedisClient() {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });
}

function getWebsiteSessionPresenceKey(sessionId: string) {
  return `website-session-presence:${sessionId}`;
}

export async function touchWebsiteSessionPresence(
  redis: Pick<IORedis, "set">,
  sessionId: string
) {
  await redis.set(
    getWebsiteSessionPresenceKey(sessionId),
    "1",
    "EX",
    WEBSITE_SESSION_PRESENCE_TTL_SECONDS
  );
}

export async function isWebsiteSessionActive(sessionId: string) {
  const redis = createRedisClient();

  try {
    const exists = await redis.exists(getWebsiteSessionPresenceKey(sessionId));
    return exists === 1;
  } catch (error) {
    console.error("Failed to read website session presence", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    redis.disconnect();
  }
}

export async function getWebsiteSessionPresenceMap(sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, boolean>();
  }

  const redis = createRedisClient();

  try {
    const values = await redis.mget(
      sessionIds.map((sessionId) => getWebsiteSessionPresenceKey(sessionId))
    );

    return new Map(
      sessionIds.map((sessionId, index) => [sessionId, values[index] !== null])
    );
  } catch (error) {
    console.error("Failed to read website session presence map", {
      sessionCount: sessionIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map(sessionIds.map((sessionId) => [sessionId, false]));
  } finally {
    redis.disconnect();
  }
}
