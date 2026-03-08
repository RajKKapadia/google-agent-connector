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

function buildCesInput(messageText: string, pendingCesContext?: string | null) {
  if (!pendingCesContext) {
    return messageText;
  }

  return [
    "Conversation context from the recent human takeover:",
    pendingCesContext,
    "",
    `Latest user message: ${messageText}`,
  ].join("\n");
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
      .onConflictDoNothing({
        target: [endUserSessions.connectionId, endUserSessions.waId],
      })
      .returning();

    if (newSession) {
      session = newSession;
    } else {
      session = await db.query.endUserSessions.findFirst({
        where: and(
          eq(endUserSessions.connectionId, connectionId),
          eq(endUserSessions.waId, waId)
        ),
      });
    }
  }

  if (!session) {
    throw new Error(`Failed to create session for ${connectionId}/${waId}`);
  }

  // 3. Insert incoming message
  const [insertedIncomingMessage] = await db
    .insert(messages)
    .values({
      sessionId: session.id,
      direction: "incoming",
      senderType: "user",
      content: messageText,
      whatsappMessageId: messageId,
      isHumanAgentMessage: false,
    })
    .onConflictDoNothing({ target: messages.whatsappMessageId })
    .returning();

  const incomingMessage =
    insertedIncomingMessage ??
    (await db.query.messages.findFirst({
      where: eq(messages.whatsappMessageId, messageId),
    }));

  if (!incomingMessage) {
    throw new Error(`Failed to load inbound message ${messageId}`);
  }

  // 4. Update session lastActivityAt
  if (insertedIncomingMessage) {
    await db
      .update(endUserSessions)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(endUserSessions.id, session.id));
  }

  // 5. Publish incoming message event
  if (insertedIncomingMessage) {
    const pub = createPubClient();
    try {
      await pub.publish(
        `session:${session.id}`,
        JSON.stringify({ type: "message", message: incomingMessage })
      );
    } finally {
      pub.disconnect();
    }
  }

  // 6. If mode is 'human', stop here — no CES call
  if (session.mode === "human") {
    if (!incomingMessage.aiHandledAt) {
      await db
        .update(messages)
        .set({ aiHandledAt: new Date() })
        .where(eq(messages.id, incomingMessage.id));
    }
    return;
  }

  if (incomingMessage.aiHandledAt) {
    return;
  }

  // 7. Call CES API
  const cesClient = createCESClient(connection);
  const cesResponse = await cesClient.runSession(
    session.cesSessionId,
    buildCesInput(messageText, session.pendingCesContext)
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

  await db
    .update(messages)
    .set({ aiHandledAt: new Date() })
    .where(eq(messages.id, incomingMessage.id));

  if (session.pendingCesContext) {
    await db
      .update(endUserSessions)
      .set({ pendingCesContext: null, updatedAt: new Date() })
      .where(eq(endUserSessions.id, session.id));
  }

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
