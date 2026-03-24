import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getAgentPlatformLabel, getAgentResourceSummary } from "@/lib/agents/config";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
    with: {
      channels: true,
    },
  });

  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{agent.name}</h1>
            <Badge variant="outline">{getAgentPlatformLabel(agent.platform)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Mapped channels: {agent.channels.length}
          </p>
        </div>
        <Button asChild>
          <Link href={`/agents/${agent.id}/edit`}>Edit Agent</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">Platform</div>
            <div>{getAgentPlatformLabel(agent.platform)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Primary Resource</div>
            <div className="font-mono text-xs">{getAgentResourceSummary(agent)}</div>
          </div>
          {agent.platform === "ces_agent_studio" ? (
            <div>
              <div className="text-muted-foreground">CES Deployment</div>
              <div className="font-mono text-xs">{agent.cesDeployment || "Not set"}</div>
            </div>
          ) : (
            <div>
              <div className="text-muted-foreground">Environment</div>
              <div className="font-mono text-xs">
                {agent.dialogflowEnvironmentId || "Direct agent session path"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapped Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels are mapped to this agent yet.</p>
          ) : (
            agent.channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{channel.type}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/channels/${channel.id}`}>Open Channel</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
