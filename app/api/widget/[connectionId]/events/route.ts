import { and, eq } from "drizzle-orm";
import IORedis from "ioredis";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { channels, endUserSessions } from "@/lib/db/schema";
import {
  touchWebsiteSessionPresence,
  WEBSITE_SESSION_PRESENCE_REFRESH_INTERVAL_MS,
} from "@/lib/sessions/presence";
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

  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, connectionId), eq(channels.isActive, true)),
  });

  if (!channel || channel.type !== "website" || key !== channel.widgetKey) {
    return new Response("Not found", { status: 404 });
  }

  if (!verifyWidgetAccessToken(token, channel.id, channel.widgetKey!)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = await db.query.endUserSessions.findFirst({
    where: and(
      eq(endUserSessions.channelId, channel.id),
      eq(endUserSessions.waId, `web:${browserSessionId}`)
    ),
  });

  if (!session) {
    return new Response("Not found", { status: 404 });
  }

  const activeSession = session;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sub = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });
      const presence = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });

      async function refreshPresence() {
        try {
          await touchWebsiteSessionPresence(presence, activeSession.id);
        } catch (error) {
          console.error("Failed to refresh website session presence", {
            sessionId: activeSession.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        await refreshPresence();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(createModeEvent(activeSession.mode))}\n\n`
          )
        );
      } catch {
        presence.quit().catch(() => {});
        await sub.quit().catch(() => {});
        return;
      }

      await sub.subscribe(`session:${activeSession.id}`);

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
      const presenceInterval = setInterval(() => {
        void refreshPresence();
      }, WEBSITE_SESSION_PRESENCE_REFRESH_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        clearInterval(presenceInterval);
        sub.unsubscribe().catch(() => {});
        sub.quit().catch(() => {});
        presence.quit().catch(() => {});
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
