import { db } from "@/lib/db";
import { MappingManager } from "@/components/mappings/mapping-manager";

export default async function MappingsPage() {
  const [agentRows, channelRows] = await Promise.all([
    db.query.agents.findMany({
      columns: { id: true, name: true },
      orderBy: (t, { asc }) => [asc(t.name)],
    }),
    db.query.channels.findMany({
      columns: {
        id: true,
        name: true,
        type: true,
        agentId: true,
        isActive: true,
      },
      orderBy: (t, { asc }) => [asc(t.name)],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Map Channel to Agent</h1>
        <p className="text-sm text-muted-foreground">Each channel can be assigned to exactly one Google CX agent at a time.</p>
      </div>
      <MappingManager agents={agentRows} channels={channelRows} />
    </div>
  );
}
