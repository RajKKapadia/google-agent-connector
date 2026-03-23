import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, endUserSessions } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWebsiteSessionPresenceMap } from "@/lib/sessions/presence";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Bot, User } from "lucide-react";

function maskWaId(waId: string): string {
  if (waId.length <= 5) return waId;
  return `${"•".repeat(waId.length - 5)}${waId.slice(-5)}`;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connectionId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { connectionId } = await searchParams;

  const userConnections = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.isActive, true)),
  });

  const connectionIds = userConnections.map((c) => c.id);
  const scopedConnectionIds = connectionId
    ? connectionIds.filter((id) => id === connectionId)
    : connectionIds;

  if (connectionIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Sessions</h1>
        <div className="border rounded-lg p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No connections yet.{" "}
            <Link href="/connections/new" className="text-blue-600 underline">
              Create one
            </Link>{" "}
            to start receiving messages.
          </p>
        </div>
      </div>
    );
  }

  if (scopedConnectionIds.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sessions">Clear filter</Link>
          </Button>
        </div>
        <div className="border rounded-lg p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No sessions found for that connection.
          </p>
        </div>
      </div>
    );
  }

  // Fetch sessions with their latest message to determine unread state
  const sessions = await db.query.endUserSessions.findMany({
    where: inArray(endUserSessions.connectionId, scopedConnectionIds),
    with: {
      connection: { columns: { name: true, id: true, type: true } },
      messages: {
        orderBy: (m, { desc }) => [desc(m.timestamp)],
        limit: 1,
      },
    },
    orderBy: (t, { desc }) => [desc(t.lastActivityAt)],
    limit: 100,
  });

  const websiteSessionPresence = await getWebsiteSessionPresenceMap(
    sessions
      .filter((session) => session.connection.type === "website")
      .map((session) => session.id)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{sessions.length} sessions</span>
          {connectionId && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sessions">Clear filter</Link>
            </Button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No sessions yet. Start a conversation from one of your connected
            channels to see it here.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {sessions.map((session) => {
              const lastMessage = session.messages[0];
              const hasUnread = lastMessage?.direction === "incoming";
              const websiteSessionActive =
                session.connection.type !== "website"
                  ? null
                  : websiteSessionPresence.get(session.id) ?? false;

              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center gap-3 border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="relative shrink-0">
                    <MessageSquare className="h-9 w-9 text-muted-foreground" />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">
                        {maskWaId(session.waId)}
                      </span>
                      {session.mode === "ai" ? (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 border-0 shrink-0"
                        >
                          <Bot className="h-3 w-3 mr-1" />
                          AI
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-0 shrink-0">
                          <User className="h-3 w-3 mr-1" />
                          Human
                        </Badge>
                      )}
                      {websiteSessionActive !== null ? (
                        <Badge
                          variant="outline"
                          className={
                            websiteSessionActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0"
                              : "border-slate-200 bg-slate-100 text-slate-600 shrink-0"
                          }
                        >
                          {websiteSessionActive ? "Active" : "Inactive"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.connection.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.lastActivityAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const lastMessage = session.messages[0];
                  const hasUnread = lastMessage?.direction === "incoming";
                  const websiteSessionActive =
                    session.connection.type !== "website"
                      ? null
                      : websiteSessionPresence.get(session.id) ?? false;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasUnread && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <span className="font-mono">
                            {maskWaId(session.waId)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{session.connection.name}</TableCell>
                      <TableCell>
                        {session.mode === "ai" ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 border-0"
                          >
                            <Bot className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-0">
                            <User className="h-3 w-3 mr-1" />
                            Human
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {websiteSessionActive !== null ? (
                          <Badge
                            variant="outline"
                            className={
                              websiteSessionActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }
                          >
                            {websiteSessionActive ? "Active" : "Inactive"}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(session.lastActivityAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sessions/${session.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
