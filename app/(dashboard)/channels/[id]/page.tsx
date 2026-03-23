import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { channels, endUserSessions } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookUrlDisplay } from "@/components/dashboard/webhook-url-display";
import { EmbedScriptCard } from "@/components/connections/embed-script-card";
import { DeleteChannelButton } from "@/components/channels/delete-channel-button";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, id),
    with: { agent: true },
  });

  if (!channel) notFound();

  const [{ value: conversationCount }] = await db
    .select({ value: count() })
    .from(endUserSessions)
    .where(eq(endUserSessions.channelId, id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const scriptTag =
    channel.type === "website" && channel.widgetKey
      ? `<script src="${appUrl}/api/widget/${channel.id}/script?key=${channel.widgetKey}" defer></script>`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{channel.name}</h1>
            <Badge variant="secondary" className="capitalize">
              {channel.type}
            </Badge>
            <Badge
              variant="outline"
              className={channel.agent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}
            >
              {channel.agent ? `Mapped to ${channel.agent.name}` : "Unmapped"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Conversations: {conversationCount}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/channels/${channel.id}/edit`}>Edit Channel</Link>
          </Button>
          <DeleteChannelButton channelId={channel.id} channelName={channel.name} />
        </div>
      </div>

      {channel.type === "whatsapp" ? (
        <WebhookUrlDisplay connectionId={channel.id} verifyToken={channel.whatsappVerifyToken} />
      ) : scriptTag ? (
        <EmbedScriptCard scriptTag={scriptTag} websiteDomain={channel.websiteDomain} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Channel Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          {channel.type === "website" ? (
            <>
              <div>
                <div className="text-muted-foreground">Allowed Site(s)</div>
                <div>{channel.websiteDomain}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Widget Title</div>
                <div>{channel.widgetTitle}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Bubble Color</div>
                <div className="font-mono">{channel.widgetBubbleColor}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Font Family</div>
                <div>{channel.widgetFontFamily}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Meta App ID</div>
                <div className="font-mono">{channel.whatsappAppId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Phone Number ID</div>
                <div className="font-mono">{channel.whatsappPhoneNumberId}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}