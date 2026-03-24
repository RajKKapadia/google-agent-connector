import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAgentPlatformLabel, type AgentFormData } from "@/lib/agents/config";
import { decrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentForm } from "@/components/agents/agent-form";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });

  if (!agent) notFound();

  const initialValues: AgentFormData =
    agent.platform === "ces_agent_studio"
      ? {
          name: agent.name,
          platform: agent.platform,
          cesAppVersion: agent.cesAppVersion || "",
          cesDeployment: agent.cesDeployment || "",
          dialogflowProjectId: "",
          dialogflowLocation: "",
          dialogflowAgentId: "",
          dialogflowEnvironmentId: "",
          googleServiceAccount: decrypt(agent.googleServiceAccount),
        }
      : {
          name: agent.name,
          platform: agent.platform,
          cesAppVersion: "",
          cesDeployment: "",
          dialogflowProjectId: agent.dialogflowProjectId || "",
          dialogflowLocation: agent.dialogflowLocation || "",
          dialogflowAgentId: agent.dialogflowAgentId || "",
          dialogflowEnvironmentId: agent.dialogflowEnvironmentId || "",
          googleServiceAccount: decrypt(agent.googleServiceAccount),
        };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Agent</h1>
        <p className="text-sm text-muted-foreground">
          Update the {getAgentPlatformLabel(agent.platform).toLowerCase()} configuration used by mapped channels.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentForm mode="edit" agentId={agent.id} initialValues={initialValues} />
        </CardContent>
      </Card>
    </div>
  );
}
