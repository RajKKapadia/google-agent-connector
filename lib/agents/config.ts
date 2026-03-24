import { z } from "zod";

export const agentPlatforms = [
  "ces_agent_studio",
  "conversational_agents",
] as const;

export type AgentPlatform = (typeof agentPlatforms)[number];

const serviceAccountSchema = z
  .string()
  .trim()
  .min(1, "Service account JSON is required")
  .refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return parsed.type === "service_account";
    } catch {
      return false;
    }
  }, "Must be valid service account JSON");

const baseAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  googleServiceAccount: serviceAccountSchema,
});

export const cesAgentStudioSchema = baseAgentSchema.extend({
  platform: z.literal("ces_agent_studio"),
  cesAppVersion: z
    .string()
    .trim()
    .min(1, "CES app version is required")
    .refine(
      (value) => value.includes("/versions/"),
      "Must be a full app version path"
    ),
  cesDeployment: z.string().trim().optional(),
  dialogflowProjectId: z.string().trim().optional(),
  dialogflowLocation: z.string().trim().optional(),
  dialogflowAgentId: z.string().trim().optional(),
  dialogflowEnvironmentId: z.string().trim().optional(),
});

export const conversationalAgentsSchema = baseAgentSchema.extend({
  platform: z.literal("conversational_agents"),
  cesAppVersion: z.string().trim().optional(),
  cesDeployment: z.string().trim().optional(),
  dialogflowProjectId: z.string().trim().min(1, "Project ID is required"),
  dialogflowLocation: z.string().trim().min(1, "Location is required"),
  dialogflowAgentId: z.string().trim().min(1, "Agent ID is required"),
  dialogflowEnvironmentId: z.string().trim().optional(),
});

export const agentFormSchema = z.discriminatedUnion("platform", [
  cesAgentStudioSchema,
  conversationalAgentsSchema,
]);

export type AgentFormData = z.infer<typeof agentFormSchema>;

export function buildAgentPersistenceValues(formData: AgentFormData) {
  if (formData.platform === "ces_agent_studio") {
    return {
      name: formData.name,
      platform: formData.platform,
      cesAppVersion: formData.cesAppVersion,
      cesDeployment: formData.cesDeployment || null,
      dialogflowProjectId: null,
      dialogflowLocation: null,
      dialogflowAgentId: null,
      dialogflowEnvironmentId: null,
      googleServiceAccount: formData.googleServiceAccount,
    };
  }

  return {
    name: formData.name,
    platform: formData.platform,
    cesAppVersion: null,
    cesDeployment: null,
    dialogflowProjectId: formData.dialogflowProjectId,
    dialogflowLocation: formData.dialogflowLocation,
    dialogflowAgentId: formData.dialogflowAgentId,
    dialogflowEnvironmentId: formData.dialogflowEnvironmentId || null,
    googleServiceAccount: formData.googleServiceAccount,
  };
}

export function getAgentPlatformLabel(platform: AgentPlatform): string {
  return platform === "ces_agent_studio"
    ? "CES Agent Studio"
    : "Conversational Agents";
}

export function getAgentResourceSummary(agent: {
  platform: AgentPlatform;
  cesAppVersion: string | null;
  dialogflowProjectId: string | null;
  dialogflowLocation: string | null;
  dialogflowAgentId: string | null;
  dialogflowEnvironmentId: string | null;
}): string {
  if (agent.platform === "ces_agent_studio") {
    return agent.cesAppVersion || "CES app version not set";
  }

  const base = [
    agent.dialogflowProjectId,
    agent.dialogflowLocation,
    agent.dialogflowAgentId,
  ]
    .filter(Boolean)
    .join(" / ");

  return agent.dialogflowEnvironmentId
    ? `${base} / env ${agent.dialogflowEnvironmentId}`
    : base || "Dialogflow agent not set";
}
