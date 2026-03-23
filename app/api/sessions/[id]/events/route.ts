import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { endUserSessions } from "@/lib/db/schema";
import { getCurrentAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: sessionId } = await params;
  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
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

      await sub.subscribe(`session:${sessionId}`);

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
