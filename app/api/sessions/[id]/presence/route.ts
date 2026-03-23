import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endUserSessions } from "@/lib/db/schema";
import { isWebsiteSessionActive } from "@/lib/sessions/presence";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
    with: {
      connection: {
        columns: {
          id: true,
          userId: true,
          type: true,
        },
      },
    },
  });

  if (!session || session.connection.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.connection.type !== "website") {
    return NextResponse.json({ active: true });
  }

  const active = await isWebsiteSessionActive(sessionId);

  return NextResponse.json({ active });
}
