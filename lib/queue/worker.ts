import { Worker, Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, endUserSessions, messages } from "@/lib/db/schema";
import { createGoogleAgentClient } from "@/lib/google-agent/client";
import { createWhatsAppClient } from "@/lib/whatsapp/client";
import { buildCesInput } from "@/lib/sessions/ces";
import { createMessageEvent, publishSessionEvent } from "@/lib/sessions/realtime";
import { getWorkerConcurrency } from "./config";
import type { MessageJobData } from "./index";
import { acquireSessionLock } from "./session-lock";

export async function processMessage(job: Job<MessageJobData>): Promise<void> {
  const { channelId, waId, messageText, messageId } = job.data;

  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, channelId), eq(channels.isActive, true)),
    with: { agent: true },
  });

  if (!channel) {
    throw new Error(`Channel ${channelId} not found or inactive`);
  }

  if (!channel.agent) {
    throw new Error(`Channel ${channelId} is not mapped to an agent`);
  }

  const sessionLock = await acquireSessionLock(channelId, waId);

  try {
    let session = await db.query.endUserSessions.findFirst({
      where: and(
        eq(endUserSessions.channelId, channelId),
        eq(endUserSessions.waId, waId)
      ),
    });

    if (!session) {
      const [newSession] = await db
        .insert(endUserSessions)
        .values({
          channelId,
          waId,
        })
        .onConflictDoNothing({
          target: [endUserSessions.channelId, endUserSessions.waId],
        })
        .returning();

      if (newSession) {
        session = newSession;
      } else {
        session = await db.query.endUserSessions.findFirst({
          where: and(
            eq(endUserSessions.channelId, channelId),
            eq(endUserSessions.waId, waId)
          ),
        });
      }
    }

    if (!session) {
      throw new Error(`Failed to create session for ${channelId}/${waId}`);
    }

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

    session =
      (await db.query.endUserSessions.findFirst({
        where: eq(endUserSessions.id, session.id),
      })) ?? session;

    const incomingMessage =
      insertedIncomingMessage ??
      (await db.query.messages.findFirst({
        where: eq(messages.whatsappMessageId, messageId),
      }));

    if (!incomingMessage) {
      throw new Error(`Failed to load inbound message ${messageId}`);
    }

    if (insertedIncomingMessage) {
      await db
        .update(endUserSessions)
        .set({ lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(endUserSessions.id, session.id));

      await publishSessionEvent(session.id, createMessageEvent(incomingMessage));
    }

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

    const agentClient = createGoogleAgentClient(channel.agent);
    const responseText = await agentClient.sendText(
      session.cesSessionId,
      buildCesInput(messageText, session.pendingCesContext)
    );

    const waClient = createWhatsAppClient(channel);
    await waClient.sendTextMessage({ to: waId, text: responseText });

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

    await publishSessionEvent(session.id, createMessageEvent(outgoingMessage));
  } finally {
    await sessionLock.release();
  }
}

export function createMessageWorker(): Worker<MessageJobData> {
  const worker = new Worker<MessageJobData>(
    "whatsapp-messages",
    processMessage,
    {
      connection: { url: process.env.REDIS_URL! },
      concurrency: getWorkerConcurrency(),
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
