import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connections, endUserSessions, messages } from "@/lib/db/schema";
import { createCESClient } from "@/lib/ces/client";

function getHostname(origin: string | null) {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin: string | null, domain: string | null) {
  if (!domain) return false;
  const host = getHostname(origin);
  if (!host) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const body = (await req.json()) as {
    key?: string;
    sessionId?: string;
    message?: string;
  };

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website") {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (!isAllowedOrigin(req.headers.get("origin"), connection.websiteDomain)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  if (!body.key || body.key !== connection.widgetKey) {
    return NextResponse.json({ error: "Invalid widget key" }, { status: 403 });
  }

  const messageText = body.message?.trim();
  if (!messageText) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const browserSession = (body.sessionId || crypto.randomUUID()).slice(0, 64);
  const waId = `web:${browserSession}`;

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
      .returning();
    session = created;
  }

  await db.insert(messages).values({
    sessionId: session.id,
    direction: "incoming",
    senderType: "user",
    content: messageText,
    isHumanAgentMessage: false,
  });

  const cesClient = createCESClient(connection);
  const cesResponse = await cesClient.runSession(session.cesSessionId, messageText);
  const responseText = cesClient.extractTextResponse(cesResponse);

  await db.insert(messages).values({
    sessionId: session.id,
    direction: "outgoing",
    senderType: "ai",
    content: responseText,
    isHumanAgentMessage: false,
  });

  return NextResponse.json({ reply: responseText, sessionId: browserSession });
}
