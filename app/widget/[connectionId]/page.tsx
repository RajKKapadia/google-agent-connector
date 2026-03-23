import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
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

  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, connectionId), eq(channels.isActive, true)),
  });

  if (!channel || channel.type !== "website" || !key || key !== channel.widgetKey) {
    notFound();
  }

  if (!isAllowedWidgetSite(getWidgetEmbedSource(requestHeaders), channel.websiteDomain)) {
    notFound();
  }

  const widgetToken = createWidgetAccessToken(channel.id, channel.widgetKey!);

  return (
    <WidgetChatClient
      connectionId={channel.id}
      widgetKey={channel.widgetKey!}
      widgetToken={widgetToken}
      widgetTitle={channel.widgetTitle || channel.name}
      parentOrigin={origin ?? null}
      fontFamily={channel.widgetFontFamily || "system-ui, sans-serif"}
      bubbleColor={channel.widgetBubbleColor || "#2563eb"}
    />
  );
}
