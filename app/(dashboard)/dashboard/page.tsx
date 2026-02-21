import { auth } from "@clerk/nextjs/server";
import { eq, and, count, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, endUserSessions, messages } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug, MessageSquare, Users, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  // Get user connections
  const userConnections = await db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.isActive, true)),
    columns: { id: true },
  });
  const connectionIds = userConnections.map((c) => c.id);

  let sessionCount = 0;
  let messagesToday = 0;
  let activeSessionCount = 0;

  if (connectionIds.length > 0) {
    const { inArray } = await import("drizzle-orm");

    // Total sessions
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(endUserSessions)
      .where(inArray(endUserSessions.connectionId, connectionIds));
    sessionCount = total;

    // Sessions with activity today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get session IDs
    const userSessions = await db.query.endUserSessions.findMany({
      where: inArray(endUserSessions.connectionId, connectionIds),
      columns: { id: true },
    });
    const sessionIds = userSessions.map((s) => s.id);

    if (sessionIds.length > 0) {
      const [{ value: todayMsgs }] = await db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            inArray(messages.sessionId, sessionIds),
            gte(messages.timestamp, startOfDay)
          )
        );
      messagesToday = todayMsgs;

      // Active sessions (human mode)
      const [{ value: active }] = await db
        .select({ value: count() })
        .from(endUserSessions)
        .where(
          and(
            inArray(endUserSessions.connectionId, connectionIds),
            eq(endUserSessions.mode, "human")
          )
        );
      activeSessionCount = active;
    }
  }

  const stats = [
    {
      title: "Active Connections",
      value: connectionIds.length,
      icon: Plug,
      description: "Live WhatsApp connections",
    },
    {
      title: "Total Sessions",
      value: sessionCount,
      icon: Users,
      description: "Unique end-user conversations",
    },
    {
      title: "Messages Today",
      value: messagesToday,
      icon: MessageSquare,
      description: "Messages processed today",
    },
    {
      title: "Human Takeovers",
      value: activeSessionCount,
      icon: TrendingUp,
      description: "Sessions in human mode",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
