import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelForm } from "@/components/channels/channel-form";

export default async function NewChannelPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const channelType = type === "website" ? "website" : "whatsapp";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {channelType === "website" ? "Add Website Widget" : "Add WhatsApp Connection"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {channelType === "website"
            ? "Create an embeddable website channel. Map it to an agent from the mappings screen."
            : "Create a WhatsApp channel for Meta webhook traffic. Map it to an agent from the mappings screen."}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Channel Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelForm mode="create" channelType={channelType} />
        </CardContent>
      </Card>
    </div>
  );
}
