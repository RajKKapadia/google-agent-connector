import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { EditConnectionForm } from "@/components/connections/edit-connection-form";
import { ArrowLeft } from "lucide-react";

export default async function EditConnectionPage({
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/connections/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Edit Connection</h1>
      </div>

      <EditConnectionForm
        connectionId={id}
        connectionType={connection.type}
        defaultValues={{
          name: connection.name,
          whatsappAppId: connection.whatsappAppId,
          whatsappPhoneNumberId: connection.whatsappPhoneNumberId,
          cesAppVersion: connection.cesAppVersion,
          cesDeployment: connection.cesDeployment,
          websiteDomain: connection.websiteDomain,
          widgetTitle: connection.widgetTitle,
          widgetBubbleColor: connection.widgetBubbleColor,
          widgetFontFamily: connection.widgetFontFamily,
        }}
      />
    </div>
  );
}
