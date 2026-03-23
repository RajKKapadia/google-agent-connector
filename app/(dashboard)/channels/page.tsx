import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ChannelsPage() {
  const channelRows = await db.query.channels.findMany({
    where: eq(channels.isActive, true),
    with: { agent: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Channels</h1>
          <p className="text-sm text-muted-foreground">Manage WhatsApp and website widget channels for this deployment.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/channels/new?type=website">Add Website Widget</Link>
          </Button>
          <Button asChild>
            <Link href="/channels/new?type=whatsapp">Add WhatsApp Connection</Link>
          </Button>
        </div>
      </div>

      {channelRows.length === 0 ? (
        <div className="rounded-xl border bg-background p-12 text-center text-muted-foreground">
          No channels yet. Add a WhatsApp connection or website widget to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channelRows.map((channel) => (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{channel.name}</CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {channel.type}
                  </Badge>
                </div>
                <CardDescription>
                  {channel.agent ? `Mapped to ${channel.agent.name}` : "Unmapped - will not process AI traffic"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  {channel.type === "website"
                    ? `Allowed sites: ${channel.websiteDomain}`
                    : `Phone Number ID: ${channel.whatsappPhoneNumberId}`}
                </p>
                <Button variant="outline" asChild>
                  <Link href={`/channels/${channel.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
