import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { WidgetChatClient } from "@/components/widget/widget-chat-client";
import {
  createWidgetAccessToken,
  getWidgetEmbedSource,
  isAllowedWidgetSite,
} from "@/lib/widget/security";

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>;
  searchParams: Promise<{ key?: string; origin?: string }>;
}) {
  const { connectionId } = await params;
  const { key, origin } = await searchParams;
  const requestHeaders = await headers();

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website" || !key || key !== connection.widgetKey) {
    notFound();
  }

  if (
    !isAllowedWidgetSite(
      getWidgetEmbedSource(requestHeaders),
      connection.websiteDomain
    )
  ) {
    notFound();
  }

  const widgetToken = createWidgetAccessToken(connection.id, connection.widgetKey!);

  return (
    <WidgetChatClient
      connectionId={connection.id}
      widgetKey={connection.widgetKey!}
      widgetToken={widgetToken}
      widgetTitle={connection.widgetTitle || connection.name}
      parentOrigin={origin ?? null}
      fontFamily={connection.widgetFontFamily || "Inter, system-ui, sans-serif"}
      bubbleColor={connection.widgetBubbleColor || "#2563eb"}
    />
  );
}
