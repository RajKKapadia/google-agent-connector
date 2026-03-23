import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelForm } from "@/components/channels/channel-form";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, id),
  });

  if (!channel) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Channel</h1>
        <p className="text-sm text-muted-foreground">Update channel credentials and presentation settings.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Channel Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelForm
            mode="edit"
            channelId={channel.id}
            channelType={channel.type}
            initialValues={
              channel.type === "website"
                ? {
                    name: channel.name,
                    websiteDomain: channel.websiteDomain || "",
                    widgetTitle: channel.widgetTitle || "",
                    widgetBubbleColor: channel.widgetBubbleColor || "#2563eb",
                    widgetFontFamily: channel.widgetFontFamily || "system-ui, sans-serif",
                  }
                : {
                    name: channel.name,
                    whatsappAppId: channel.whatsappAppId,
                    whatsappAppSecret: decrypt(channel.whatsappAppSecret),
                    whatsappPhoneNumberId: channel.whatsappPhoneNumberId,
                    whatsappAccessToken: decrypt(channel.whatsappAccessToken),
                  }
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}