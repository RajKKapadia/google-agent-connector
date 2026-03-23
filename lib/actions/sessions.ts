"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { endUserSessions, connections, messages } from "@/lib/db/schema";
import { createWhatsAppClient } from "@/lib/whatsapp/client";
import { buildPendingCesContext } from "@/lib/sessions/ces";
import { createMessageEvent, createModeEvent, publishSessionEvent } from "@/lib/sessions/realtime";
import type { ActionResult } from "./connections";

async function verifySessionOwnership(sessionId: string, userId: string) {
  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
    with: { connection: true },
  });

  if (!session || session.connection.userId !== userId) {
    return null;
  }

  return session;
}

export async function setSessionMode(
  sessionId: string,
  mode: "ai" | "human",
  excludeHumanMessages?: boolean
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const session = await verifySessionOwnership(sessionId, userId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const updateData: Record<string, unknown> = {
    mode,
    updatedAt: new Date(),
  };

  if (mode === "human") {
    updateData.humanModeStartedAt = new Date();
    updateData.pendingCesContext = null;
  } else {
    if (excludeHumanMessages !== undefined) {
      updateData.excludeHumanMessagesFromHistory = excludeHumanMessages;
    }

    if (!excludeHumanMessages && session.humanModeStartedAt) {
      const humanModeMessages = await db.query.messages.findMany({
        where: and(
          eq(messages.sessionId, sessionId),
          gte(messages.timestamp, session.humanModeStartedAt)
        ),
        orderBy: (t, { asc }) => [asc(t.timestamp)],
        columns: {
          senderType: true,
          content: true,
        },
      });

      const replayableHistory = humanModeMessages.filter(
        (message): message is { senderType: "user" | "human_agent"; content: string } =>
          message.senderType === "user" || message.senderType === "human_agent"
      );

      updateData.pendingCesContext = buildPendingCesContext(replayableHistory);
    } else {
      updateData.pendingCesContext = null;
    }

    updateData.humanModeStartedAt = null;
  }

  await db
    .update(endUserSessions)
    .set(updateData)
    .where(eq(endUserSessions.id, sessionId));

  await publishSessionEvent(sessionId, createModeEvent(mode));
  revalidatePath(`/sessions/${sessionId}`);

  return { success: true };
}

export async function sendHumanAgentMessage(
  sessionId: string,
  content: string
): Promise<ActionResult<{ messageId: string }>> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const session = await verifySessionOwnership(sessionId, userId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  if (session.mode !== "human") {
    return {
      success: false,
      error:
        "Session is not in human mode. Take over the session before sending messages.",
    };
  }

  if (!content.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  if (session.connection.type === "whatsapp") {
    const waClient = createWhatsAppClient(session.connection);
    await waClient.sendTextMessage({ to: session.waId, text: content.trim() });
  }

  // Insert message record
  const [newMessage] = await db
    .insert(messages)
    .values({
      sessionId,
      direction: "outgoing",
      senderType: "human_agent",
      content: content.trim(),
      isHumanAgentMessage: true,
    })
    .returning();

  // Update lastActivityAt
  await db
    .update(endUserSessions)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(endUserSessions.id, sessionId));

  await publishSessionEvent(sessionId, createMessageEvent(newMessage));

  return { success: true, data: { messageId: newMessage.id } };
}

export async function getSessionWithMessages(sessionId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const session = await verifySessionOwnership(sessionId, userId);
  if (!session) return null;

  const sessionMessages = await db.query.messages.findMany({
    where: eq(messages.sessionId, sessionId),
    orderBy: (t, { asc }) => [asc(t.timestamp)],
  });

  return { session, messages: sessionMessages };
}

export async function getUserSessions(connectionId?: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Get all connections for user
  const userConnections = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.isActive, true)),
    columns: { id: true },
  });

  const connectionIds = userConnections.map((c) => c.id);

  if (connectionIds.length === 0) return [];

  const scopedConnectionIds = connectionId
    ? connectionIds.filter((id) => id === connectionId)
    : connectionIds;

  if (scopedConnectionIds.length === 0) return [];

  return db.query.endUserSessions.findMany({
    where: inArray(endUserSessions.connectionId, scopedConnectionIds),
    with: { connection: { columns: { name: true, id: true } } },
    orderBy: (t, { desc }) => [desc(t.lastActivityAt)],
  });
}
