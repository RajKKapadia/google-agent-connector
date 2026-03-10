import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { WidgetChatClient } from "@/components/widget/widget-chat-client";

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { connectionId } = await params;
  const { key } = await searchParams;

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website" || !key || key !== connection.widgetKey) {
    notFound();
  }

  return (
    <WidgetChatClient
      connectionId={connection.id}
      widgetKey={connection.widgetKey!}
      greeting={connection.widgetGreeting || "Hi! How can we help today?"}
      fontFamily={connection.widgetFontFamily || "Inter, system-ui, sans-serif"}
      bubbleColor={connection.widgetBubbleColor || "#2563eb"}
    />
  );
}
