import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add Google CX Agent</h1>
        <p className="text-sm text-muted-foreground">Store the CES app version and service account used for routed conversations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
