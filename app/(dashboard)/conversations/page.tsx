import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { Bot, User } from "lucide-react";
import { db } from "@/lib/db";
import { channels, endUserSessions } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationsAutoRefresh } from "@/components/conversations/conversations-auto-refresh";
import { getWebsiteSessionPresenceMap } from "@/lib/sessions/presence";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function maskWaId(waId: string): string {
  if (waId.length <= 5) return waId;
  return `${"•".repeat(waId.length - 5)}${waId.slice(-5)}`;
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channelId?: string }>;
}) {
  const { channelId } = await searchParams;
  const activeChannels = await db.query.channels.findMany({
    where: eq(channels.isActive, true),
    columns: { id: true, name: true },
  });

  const channelIds = activeChannels.map((channel) => channel.id);
  const scopedChannelIds = channelId ? channelIds.filter((id) => id === channelId) : channelIds;

  if (channelIds.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-12 text-center text-muted-foreground">
        No channels yet. Create a channel before expecting conversations.
      </div>
    );
  }

  const sessions = scopedChannelIds.length
    ? await db.query.endUserSessions.findMany({
        where: inArray(endUserSessions.channelId, scopedChannelIds),
        with: {
          channel: { columns: { name: true, id: true, type: true } },
          messages: {
            orderBy: (m, { desc }) => [desc(m.timestamp)],
            limit: 1,
          },
        },
        orderBy: (t, { desc }) => [desc(t.lastActivityAt)],
        limit: 100,
      })
    : [];

  const websiteSessionPresence = await getWebsiteSessionPresenceMap(
    sessions
      .filter((session) => session.channel.type === "website")
      .map((session) => session.id)
  );

  return (
    <div className="space-y-6">
      <ConversationsAutoRefresh />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">Real-time view of AI and human-handled conversations.</p>
        </div>
        <span className="text-sm text-muted-foreground">{sessions.length} conversations</span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No conversations found for the selected channels.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const lastMessage = session.messages[0];
                const websiteSessionActive =
                  session.channel.type !== "website"
                    ? null
                    : websiteSessionPresence.get(session.id) ?? false;

                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lastMessage?.direction === "incoming" ? (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        ) : null}
                        <span className="font-mono">{maskWaId(session.waId)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{session.channel.name}</TableCell>
                    <TableCell>
                      {session.mode === "ai" ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0">
                          <Bot className="mr-1 h-3 w-3" />
                          AI
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-0">
                          <User className="mr-1 h-3 w-3" />
                          Human
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {websiteSessionActive === null ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={websiteSessionActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}
                        >
                          {websiteSessionActive ? "Widget Active" : "Widget Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/conversations/${session.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
