"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { endUserSessions, channels, messages } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { createWhatsAppClient, WhatsAppApiError } from "@/lib/whatsapp/client";
import { buildPendingCesContext } from "@/lib/sessions/ces";
import { isWebsiteSessionActive } from "@/lib/sessions/presence";
import { createMessageEvent, createModeEvent, publishSessionEvent } from "@/lib/sessions/realtime";
import type { ActionResult } from "./types";

async function verifySessionExists(sessionId: string) {
  return db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
    with: { channel: true },
  });
}

export async function setSessionMode(
  sessionId: string,
  mode: "ai" | "human",
  excludeHumanMessages?: boolean
): Promise<ActionResult> {
  await requireAdmin();

  const session = await verifySessionExists(sessionId);
  if (!session) {
    return { success: false, error: "Conversation not found" };
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
  revalidatePath(`/conversations/${sessionId}`);

  return { success: true };
}

export async function sendHumanAgentMessage(
  sessionId: string,
  content: string
): Promise<ActionResult<{ messageId: string }>> {
  await requireAdmin();

  const session = await verifySessionExists(sessionId);
  if (!session) {
    return { success: false, error: "Conversation not found" };
  }

  if (session.mode !== "human") {
    return {
      success: false,
      error:
        "Conversation is not in human mode. Take over the conversation before sending messages.",
    };
  }

  if (!content.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  const trimmedContent = content.trim();

  if (session.channel.type === "whatsapp") {
    const latestInboundMessage = await db.query.messages.findFirst({
      where: and(
        eq(messages.sessionId, sessionId),
        eq(messages.direction, "incoming"),
        eq(messages.senderType, "user")
      ),
      orderBy: (t, { desc }) => [desc(t.timestamp)],
      columns: {
        whatsappMessageId: true,
      },
    });

    const waClient = createWhatsAppClient(session.channel);

    try {
      await waClient.sendTextMessage({
        to: session.waId,
        text: trimmedContent,
        messageId: latestInboundMessage?.whatsappMessageId ?? undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to send WhatsApp message";

      console.error("WhatsApp human send failed", {
        sessionId,
        channelId: session.channel.id,
        waId: session.waId,
        error: errorMessage,
        providerStatus: error instanceof WhatsAppApiError ? error.status : undefined,
        providerCode: error instanceof WhatsAppApiError ? error.code : undefined,
        providerSubcode:
          error instanceof WhatsAppApiError ? error.subcode : undefined,
        providerTraceId:
          error instanceof WhatsAppApiError ? error.traceId : undefined,
        providerBody: error instanceof WhatsAppApiError ? error.body : undefined,
      });

      return { success: false, error: errorMessage };
    }
  } else {
    let websiteSessionActive = false;

    try {
      websiteSessionActive = await isWebsiteSessionActive(sessionId);
    } catch (error) {
      console.error("Failed to verify website session presence", {
        sessionId,
        channelId: session.channel.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: "Failed to verify website session status. Please try again.",
      };
    }

    if (!websiteSessionActive) {
      return {
        success: false,
        error: "Website session is inactive. Wait for the widget to reconnect.",
      };
    }
  }

  const [newMessage] = await db
    .insert(messages)
    .values({
      sessionId,
      direction: "outgoing",
      senderType: "human_agent",
      content: trimmedContent,
      isHumanAgentMessage: true,
    })
    .returning();

  await db
    .update(endUserSessions)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(endUserSessions.id, sessionId));

  await publishSessionEvent(sessionId, createMessageEvent(newMessage));

  return { success: true, data: { messageId: newMessage.id } };
}

export async function getSessionWithMessages(sessionId: string) {
  await requireAdmin();

  const session = await verifySessionExists(sessionId);
  if (!session) return null;

  const sessionMessages = await db.query.messages.findMany({
    where: eq(messages.sessionId, sessionId),
    orderBy: (t, { asc }) => [asc(t.timestamp)],
  });

  return { session, messages: sessionMessages };
}

export async function getUserSessions(channelId?: string) {
  await requireAdmin();

  const activeChannels = await db.query.channels.findMany({
    where: eq(channels.isActive, true),
    columns: { id: true },
  });

  const channelIds = activeChannels.map((channel) => channel.id);
  if (channelIds.length === 0) return [];

  const scopedChannelIds = channelId
    ? channelIds.filter((id) => id === channelId)
    : channelIds;

  if (scopedChannelIds.length === 0) return [];

  return db.query.endUserSessions.findMany({
    where: inArray(endUserSessions.channelId, scopedChannelIds),
    with: { channel: { columns: { name: true, id: true } } },
    orderBy: (t, { desc }) => [desc(t.lastActivityAt)],
  });
}
