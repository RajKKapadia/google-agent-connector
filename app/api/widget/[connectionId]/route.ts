import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connections, endUserSessions, messages } from "@/lib/db/schema";
import { createCESClient } from "@/lib/ces/client";
import { buildCesInput } from "@/lib/sessions/ces";
import {
  createMessageEvent,
  publishSessionEvent,
  serializeSessionMessage,
} from "@/lib/sessions/realtime";
import { verifyWidgetAccessToken } from "@/lib/widget/security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const body = (await req.json()) as {
    key?: string;
    token?: string;
    sessionId?: string;
    message?: string;
  };

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website") {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (!body.key || body.key !== connection.widgetKey) {
    return NextResponse.json({ error: "Invalid widget key" }, { status: 403 });
  }

  if (!verifyWidgetAccessToken(body.token, connection.id, connection.widgetKey!)) {
    return NextResponse.json({ error: "Invalid widget token" }, { status: 403 });
  }

  const messageText = body.message?.trim();
  if (!messageText) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const browserSessionId = (body.sessionId || crypto.randomUUID()).slice(0, 64);
  const waId = `web:${browserSessionId}`;

  let session = await db.query.endUserSessions.findFirst({
    where: and(
      eq(endUserSessions.connectionId, connectionId),
      eq(endUserSessions.waId, waId)
    ),
  });

  if (!session) {
    const [created] = await db
      .insert(endUserSessions)
      .values({ connectionId, waId })
      .onConflictDoNothing({
        target: [endUserSessions.connectionId, endUserSessions.waId],
      })
      .returning();

    if (created) {
      session = created;
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
    return NextResponse.json(
      { error: "Failed to create website session" },
      { status: 500 }
    );
  }

  const [incomingMessage] = await db
    .insert(messages)
    .values({
      sessionId: session.id,
      direction: "incoming",
      senderType: "user",
      content: messageText,
      isHumanAgentMessage: false,
    })
    .returning();

  await db
    .update(endUserSessions)
    .set({ lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(endUserSessions.id, session.id));

  await publishSessionEvent(session.id, createMessageEvent(incomingMessage));

  if (session.mode === "human") {
    await db
      .update(messages)
      .set({ aiHandledAt: new Date() })
      .where(eq(messages.id, incomingMessage.id));

    return NextResponse.json({
      sessionId: browserSessionId,
      mode: session.mode,
      messages: [serializeSessionMessage(incomingMessage)],
    });
  }

  const cesClient = createCESClient(connection);
  const cesResponse = await cesClient.runSession(
    session.cesSessionId,
    buildCesInput(messageText, session.pendingCesContext)
  );
  const responseText = cesClient.extractTextResponse(cesResponse);

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

  return NextResponse.json({
    sessionId: browserSessionId,
    mode: session.mode,
    messages: [
      serializeSessionMessage(incomingMessage),
      serializeSessionMessage(outgoingMessage),
    ],
  });
}
