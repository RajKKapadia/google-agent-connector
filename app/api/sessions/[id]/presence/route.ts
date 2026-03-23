import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endUserSessions } from "@/lib/db/schema";
import { getCurrentAdmin } from "@/lib/auth/session";
import { isWebsiteSessionActive } from "@/lib/sessions/presence";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, sessionId),
    with: {
      channel: {
        columns: {
          id: true,
          type: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.channel.type !== "website") {
    return NextResponse.json({ active: true });
  }

  const active = await isWebsiteSessionActive(sessionId);
  return NextResponse.json({ active });
}
