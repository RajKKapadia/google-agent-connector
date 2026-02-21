import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { endUserSessions, messages } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ChatView } from "@/components/chat/chat-view";
import { HumanTakeoverControls } from "@/components/chat/human-takeover-controls";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, id),
    with: { connection: true },
  });

  if (!session || session.connection.userId !== userId) notFound();

  const sessionMessages = await db.query.messages.findMany({
    where: eq(messages.sessionId, id),
    orderBy: (t, { asc }) => [asc(t.timestamp)],
  });

  const serializedMessages = sessionMessages.map((m) => ({
    ...m,
    timestamp: m.timestamp.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sessions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="font-semibold text-sm font-mono">
          {"•".repeat(Math.max(0, session.waId.length - 5)) + session.waId.slice(-5)}
        </h1>
          <p className="text-xs text-muted-foreground">
            {session.connection.name}
          </p>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-muted/10">
        <ChatView
          sessionId={session.id}
          initialMessages={serializedMessages}
          mode={session.mode}
        />
      </div>

      {/* Takeover controls + human message input */}
      <HumanTakeoverControls
        sessionId={session.id}
        mode={session.mode}
        excludeHumanMessages={session.excludeHumanMessagesFromHistory}
      />
    </div>
  );
}
