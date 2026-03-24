import Link from "next/link";
import { getAgentPlatformLabel, getAgentResourceSummary } from "@/lib/agents/config";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AgentsPage() {
  const agentRows = await db.query.agents.findMany({
    with: {
      channels: {
        columns: { id: true },
      },
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage Google agent definitions used by mapped channels.
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">Add Google Agent</Link>
        </Button>
      </div>

      {agentRows.length === 0 ? (
        <div className="rounded-xl border bg-background p-12 text-center text-muted-foreground">
          No agents yet. Add your first Google agent to start mapping channels.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agentRows.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <Badge variant="secondary">{agent.channels.length} mapped</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getAgentPlatformLabel(agent.platform)}</Badge>
                </div>
                <CardDescription className="truncate font-mono text-xs">
                  {getAgentResourceSummary(agent)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href={`/agents/${agent.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
