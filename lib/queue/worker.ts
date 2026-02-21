import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  endUserSessions,
  messages,
} from "@/lib/db/schema";
import { createCESClient } from "@/lib/ces/client";
import { createWhatsAppClient } from "@/lib/whatsapp/client";
import type { MessageJobData } from "./index";

// Separate Redis connection for pub/sub publishing (uses direct IORedis)
function createPubClient() {
  return new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

export async function processMessage(job: Job<MessageJobData>): Promise<void> {
  const { connectionId, waId, messageText, messageId } = job.data;

  // 1. Load connection
  const connection = await db.query.connections.findFirst({
    where: and(
      eq(connections.id, connectionId),
      eq(connections.isActive, true)
    ),
  });

  if (!connection) {
    throw new Error(`Connection ${connectionId} not found or inactive`);
  }

  // 2. Get or create end user session
  let session = await db.query.endUserSessions.findFirst({
    where: and(
      eq(endUserSessions.connectionId, connectionId),
      eq(endUserSessions.waId, waId)
    ),
  });

  if (!session) {
    const [newSession] = await db
      .insert(endUserSessions)
      .values({
        connectionId,
        waId,
      })
      .returning();
    session = newSession;
  }

  // 3. Insert incoming message
  const [incomingMessage] = await db
    .insert(messages)
    .values({
      sessionId: session.id,
      direction: "incoming",
      senderType: "user",
      content: messageText,
      whatsappMessageId: messageId,
      isHumanAgentMessage: false,
    })
    .returning();

  // 4. Update session lastActivityAt
  await db
    .update(endUserSessions)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(endUserSessions.id, session.id));

  // 5. Publish incoming message event
  const pub = createPubClient();
  try {
    await pub.publish(
      `session:${session.id}`,
      JSON.stringify({ type: "message", message: incomingMessage })
    );
  } finally {
    pub.disconnect();
  }

  // 6. If mode is 'human', stop here — no CES call
  if (session.mode === "human") {
    return;
  }

  // 7. Call CES API
  const cesClient = createCESClient(connection);
  const cesResponse = await cesClient.runSession(
    session.cesSessionId,
    messageText
  );
  const responseText = cesClient.extractTextResponse(cesResponse);

  // 8. Send WhatsApp reply
  const waClient = createWhatsAppClient(connection);
  await waClient.sendTextMessage({ to: waId, text: responseText });

  // 9. Insert outgoing AI message
  const [outgoingMessage] = await db
    .insert(messages)
    .values({
      sessionId: session.id,
      direction: "outgoing",
      senderType: "ai",
      content: responseText,
      isHumanAgentMessage: false,
    })
    .returning();

  // 10. Publish outgoing message event
  const pub2 = createPubClient();
  try {
    await pub2.publish(
      `session:${session.id}`,
      JSON.stringify({ type: "message", message: outgoingMessage })
    );
  } finally {
    pub2.disconnect();
  }
}

export function createMessageWorker(): Worker<MessageJobData> {
  const worker = new Worker<MessageJobData>(
    "whatsapp-messages",
    processMessage,
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: 10,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    const cause = (err as { cause?: Error }).cause;
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    if (cause) console.error(`[Worker] Caused by:`, cause.message ?? cause);
  });

  return worker;
}
