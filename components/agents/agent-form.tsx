"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  agentFormSchema,
  getAgentPlatformLabel,
  type AgentFormData,
} from "@/lib/agents/config";
import { createAgent, updateAgent } from "@/lib/actions/agents";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: string;
  initialValues?: AgentFormData;
}

const emptyValues: AgentFormData = {
  name: "",
  platform: "ces_agent_studio",
  cesAppVersion: "",
  cesDeployment: "",
  dialogflowProjectId: "",
  dialogflowLocation: "",
  dialogflowAgentId: "",
  dialogflowEnvironmentId: "",
  googleServiceAccount: "",
};

export function AgentForm({ mode, agentId, initialValues }: AgentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: initialValues ?? emptyValues,
  });
  const platform = form.watch("platform");

  async function onSubmit(values: AgentFormData) {
    setIsSubmitting(true);
    try {
      const result =
        mode === "create"
          ? await createAgent(values)
          : await updateAgent(agentId!, values);

      if (result.success) {
        const targetId = mode === "create" ? result.data?.id : agentId;
        router.push(`/agents/${targetId}`);
        router.refresh();
        return;
      }

      toast.error(result.error);
      if (result.fieldErrors) {
        for (const [field, errors] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof AgentFormData, { message: errors[0] });
        }
      }
    } catch {
      toast.error(
        mode === "create" ? "Failed to create agent" : "Failed to update agent"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agent Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Support Agent" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) =>
                  field.onChange(value as AgentFormData["platform"])
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ces_agent_studio">
                    {getAgentPlatformLabel("ces_agent_studio")}
                  </SelectItem>
                  <SelectItem value="conversational_agents">
                    {getAgentPlatformLabel("conversational_agents")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Choose whether this agent routes through CES Agent Studio or Dialogflow CX Conversational Agents.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {platform === "ces_agent_studio" ? (
          <>
            <FormField
              control={form.control}
              name="cesAppVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CES App Version</FormLabel>
                  <FormControl>
                    <Input
                      className="font-mono text-sm"
                      placeholder="projects/my-project/locations/us/apps/app-id/versions/version-id"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cesDeployment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CES Deployment</FormLabel>
                  <FormControl>
                    <Input
                      className="font-mono text-sm"
                      placeholder="projects/my-project/locations/us/apps/app-id/deployments/deployment-id"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional. Leave blank to use the app version default deployment behavior.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="dialogflowProjectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project ID</FormLabel>
                  <FormControl>
                    <Input className="font-mono text-sm" placeholder="my-project" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dialogflowLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input className="font-mono text-sm" placeholder="global" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dialogflowAgentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent ID</FormLabel>
                  <FormControl>
                    <Input className="font-mono text-sm" placeholder="00000000-0000-0000-0000-000000000000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dialogflowEnvironmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Environment ID</FormLabel>
                  <FormControl>
                    <Input className="font-mono text-sm" placeholder="Optional production environment" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional. Leave blank to use the direct agent session path instead of an environment session path.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="googleServiceAccount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Account JSON</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-56 resize-y font-mono text-sm"
                  placeholder={'{\n  "type": "service_account"\n}'}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Agent"
                : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
