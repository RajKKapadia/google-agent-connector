import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Plug, ArrowRight } from "lucide-react";

export default async function ConnectionsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const userConnections = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.isActive, true)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Connections</h1>
        <Button asChild>
          <Link href="/connections/new">
            <Plus className="h-4 w-4 mr-2" />
            New Connection
          </Link>
        </Button>
      </div>

      {userConnections.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first connection to link a WhatsApp number to a CES agent.
          </p>
          <Button asChild>
            <Link href="/connections/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Connection
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {userConnections.map((conn) => (
            <Card key={conn.id} className="flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{conn.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Phone ID:</span>{" "}
                  <span className="font-mono">{conn.whatsappPhoneNumberId}</span>
                </p>
                <p>
                  <span className="font-medium">Meta App ID:</span>{" "}
                  <span className="font-mono">{conn.whatsappAppId}</span>
                </p>
                <p className="truncate">
                  <span className="font-medium">App Version:</span>{" "}
                  <span className="font-mono text-xs">{conn.cesAppVersion}</span>
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/connections/${conn.id}`}>
                    View Details <ArrowRight className="h-3 w-3 ml-2" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
