import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import IORedis from "ioredis";
import { db } from "@/lib/db";
import { endUserSessions } from "@/lib/db/schema";

export const runtime = "nodejs"; // SSE requires Node.js runtime, not Edge
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: sessionId } = await params;

  // Verify the session belongs to the authenticated user
  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
    with: { connection: true },
  });

  if (!session || session.connection.userId !== userId) {
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

      // Send a heartbeat comment every 30s to keep connection alive
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
      "X-Accel-Buffering": "no", // Disable Nginx buffering for SSE
    },
  });
}
