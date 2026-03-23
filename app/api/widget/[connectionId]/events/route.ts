import { and, eq } from "drizzle-orm";
import IORedis from "ioredis";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { connections, endUserSessions } from "@/lib/db/schema";
import { createModeEvent } from "@/lib/sessions/realtime";
import { verifyWidgetAccessToken } from "@/lib/widget/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const key = req.nextUrl.searchParams.get("key");
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const browserSessionId = req.nextUrl.searchParams.get("sessionId")?.slice(0, 64);

  if (!key || !browserSessionId) {
    return new Response("Bad request", { status: 400 });
  }

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website" || key !== connection.widgetKey) {
    return new Response("Not found", { status: 404 });
  }

  if (!verifyWidgetAccessToken(token, connection.id, connection.widgetKey!)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = await db.query.endUserSessions.findFirst({
    where: and(
      eq(endUserSessions.connectionId, connection.id),
      eq(endUserSessions.waId, `web:${browserSessionId}`)
    ),
  });

  if (!session) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sub = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });

      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(createModeEvent(session.mode))}\n\n`)
        );
      } catch {
        await sub.quit().catch(() => {});
        return;
      }

      await sub.subscribe(`session:${session.id}`);

      sub.on("message", (_channel, data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      });

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        sub.unsubscribe().catch(() => {});
        sub.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
