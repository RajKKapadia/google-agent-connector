import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { connections, endUserSessions } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WebhookUrlDisplay } from "@/components/dashboard/webhook-url-display";
import { DeleteConnectionButton } from "@/components/connections/delete-connection-button";
import { EmbedScriptCard } from "@/components/connections/embed-script-card";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { count } from "drizzle-orm";

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, id), eq(connections.userId, userId)),
  });

  if (!connection) notFound();

  const [{ value: sessionCount }] = await db
    .select({ value: count() })
    .from(endUserSessions)
    .where(eq(endUserSessions.connectionId, id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const scriptTag = connection.type === "website" && connection.widgetKey
    ? `<script src="${appUrl}/api/widget/${connection.id}/script?key=${connection.widgetKey}" defer></script>`
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/connections">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{connection.name}</h1>
        <Badge variant={connection.isActive ? "secondary" : "destructive"}>
          {connection.type === "website" ? "Website" : "WhatsApp"}
        </Badge>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/connections/${id}/edit`}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sessions</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sessionCount}</div>
            <Button variant="link" className="p-0 h-auto text-xs" asChild>
              <Link href={`/sessions?connectionId=${id}`}>View sessions <ExternalLink className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Created</CardTitle></CardHeader>
          <CardContent><div className="text-base font-medium">{connection.createdAt.toLocaleDateString()}</div></CardContent>
        </Card>
      </div>

      {connection.type === "whatsapp" ? (
        <WebhookUrlDisplay connectionId={connection.id} verifyToken={connection.whatsappVerifyToken} />
      ) : scriptTag ? (
        <EmbedScriptCard
          scriptTag={scriptTag}
          websiteDomain={connection.websiteDomain}
        />
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Connection Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-y-3">
            {connection.type === "website" ? (
              <>
                <span className="text-muted-foreground">Allowed Site(s)</span>
                <span className="font-mono">{connection.websiteDomain}</span>
                <span className="text-muted-foreground">Bubble Color</span>
                <span className="font-mono">{connection.widgetBubbleColor}</span>
                <span className="text-muted-foreground">Font Family</span>
                <span className="font-mono text-xs truncate">{connection.widgetFontFamily}</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">Phone Number ID</span>
                <span className="font-mono">{connection.whatsappPhoneNumberId}</span>
                <span className="text-muted-foreground">Meta App ID</span>
                <span className="font-mono">{connection.whatsappAppId}</span>
              </>
            )}

            <span className="text-muted-foreground">App Version</span>
            <span className="font-mono text-xs truncate">{connection.cesAppVersion}</span>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Danger Zone</h3>
          <p className="text-sm text-muted-foreground">Deleting this connection will stop all message processing.</p>
        </div>
        <DeleteConnectionButton connectionId={connection.id} connectionName={connection.name} />
      </div>
    </div>
  );
}
