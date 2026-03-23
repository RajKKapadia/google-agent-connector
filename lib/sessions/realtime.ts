import type { InferSelectModel } from "drizzle-orm";
import IORedis from "ioredis";
import { messages } from "@/lib/db/schema";

type SessionMode = "ai" | "human";
type DbMessage = InferSelectModel<typeof messages>;

export interface SerializedSessionMessage {
  id: string;
  direction: DbMessage["direction"];
  senderType: DbMessage["senderType"];
  content: string;
  timestamp: string;
  isHumanAgentMessage: boolean;
}

export type SessionRealtimeEvent =
  | {
      type: "message";
      message: SerializedSessionMessage;
    }
  | {
      type: "mode";
      mode: SessionMode;
    };

export function serializeSessionMessage(
  message: Pick<
    DbMessage,
    | "id"
    | "direction"
    | "senderType"
    | "content"
    | "timestamp"
    | "isHumanAgentMessage"
  >
): SerializedSessionMessage {
  return {
    id: message.id,
    direction: message.direction,
    senderType: message.senderType,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    isHumanAgentMessage: message.isHumanAgentMessage,
  };
}

export function createMessageEvent(
  message: Pick<
    DbMessage,
    | "id"
    | "direction"
    | "senderType"
    | "content"
    | "timestamp"
    | "isHumanAgentMessage"
  >
): SessionRealtimeEvent {
  return {
    type: "message",
    message: serializeSessionMessage(message),
  };
}

export function createModeEvent(mode: SessionMode): SessionRealtimeEvent {
  return {
    type: "mode",
    mode,
  };
}

export async function publishSessionEvent(
  sessionId: string,
  event: SessionRealtimeEvent
) {
  const pub = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  try {
    await pub.publish(`session:${sessionId}`, JSON.stringify(event));
  } finally {
    pub.disconnect();
  }
}
