"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getAgentPlatformLabel, type AgentPlatform } from "@/lib/agents/config";
import { assignChannelAgent } from "@/lib/actions/mappings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MappingManagerProps {
  agents: Array<{ id: string; name: string; platform: AgentPlatform }>;
  channels: Array<{
    id: string;
    name: string;
    type: "whatsapp" | "website";
    agentId: string | null;
    isActive: boolean;
  }>;
}

export function MappingManager({ agents, channels }: MappingManagerProps) {
  const initialSelections = useMemo(
    () =>
      Object.fromEntries(
        channels.map((channel) => [channel.id, channel.agentId ?? "unmapped"])
      ),
    [channels]
  );
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>(initialSelections);
  const [isPending, startTransition] = useTransition();

  function handleSave(channelId: string) {
    startTransition(async () => {
      const value = selectedAgents[channelId];
      const result = await assignChannelAgent(
        channelId,
        value === "unmapped" ? null : value
      );

      if (result.success) {
        toast.success("Mapping updated");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned Agent</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {channels.map((channel) => (
            <TableRow key={channel.id}>
              <TableCell className="font-medium">{channel.name}</TableCell>
              <TableCell className="capitalize">{channel.type}</TableCell>
              <TableCell>
                <Badge
                  variant={channel.agentId ? "secondary" : "outline"}
                  className={channel.agentId ? "bg-emerald-100 text-emerald-700 border-0" : "border-amber-200 bg-amber-50 text-amber-700"}
                >
                  {channel.agentId ? "Mapped" : "Unmapped"}
                </Badge>
              </TableCell>
              <TableCell>
                <Select
                  value={selectedAgents[channel.id]}
                  onValueChange={(value) =>
                    setSelectedAgents((current) => ({
                      ...current,
                      [channel.id]: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unmapped">Unmapped</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({getAgentPlatformLabel(agent.platform)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={() => handleSave(channel.id)} disabled={isPending}>
                  Save
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
