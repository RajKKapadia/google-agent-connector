import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { endUserSessions, messages } from "@/lib/db/schema";
import { isWebsiteSessionActive } from "@/lib/sessions/presence";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat/chat-view";
import { HumanTakeoverControls } from "@/components/chat/human-takeover-controls";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await db.query.endUserSessions.findFirst({
    where: eq(endUserSessions.id, id),
    with: { channel: true },
  });

  if (!session) notFound();

  const sessionMessages = await db.query.messages.findMany({
    where: eq(messages.sessionId, id),
    orderBy: (t, { asc }) => [asc(t.timestamp)],
  });

  const serializedMessages = sessionMessages.map((message) => ({
    ...message,
    timestamp: message.timestamp.toISOString(),
  }));
  const initialWebsiteSessionActive =
    session.channel.type === "website"
      ? await isWebsiteSessionActive(session.id)
      : null;

  return (
    <div className="-m-6 flex h-full flex-col">
      <div className="flex items-center gap-3 border-b bg-background px-6 py-4 shrink-0">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/conversations">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="font-mono text-sm font-semibold">
            {"•".repeat(Math.max(0, session.waId.length - 5)) + session.waId.slice(-5)}
          </h1>
          <p className="text-xs text-muted-foreground">{session.channel.name}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10">
        <ChatView sessionId={session.id} initialMessages={serializedMessages} mode={session.mode} />
      </div>
      <HumanTakeoverControls
        sessionId={session.id}
        mode={session.mode}
        excludeHumanMessages={session.excludeHumanMessagesFromHistory}
        connectionType={session.channel.type}
        initialWebsiteSessionActive={initialWebsiteSessionActive}
      />
    </div>
  );
}