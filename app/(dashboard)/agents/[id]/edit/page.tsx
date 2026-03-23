import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Agent</h1>
        <p className="text-sm text-muted-foreground">Update the CES configuration used by mapped channels.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentForm
            mode="edit"
            agentId={agent.id}
            initialValues={{
              name: agent.name,
              cesAppVersion: agent.cesAppVersion,
              cesDeployment: agent.cesDeployment || "",
              googleServiceAccount: decrypt(agent.googleServiceAccount),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}