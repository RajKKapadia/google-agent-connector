import test from "node:test";
import assert from "node:assert/strict";
import {
  agentFormSchema,
  buildAgentPersistenceValues,
} from "@/lib/agents/config";

const serviceAccountJson = JSON.stringify({
  type: "service_account",
  client_email: "bot@example.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
});

test("agentFormSchema accepts CES Agent Studio config", () => {
  const parsed = agentFormSchema.safeParse({
    name: "Support",
    platform: "ces_agent_studio",
    cesAppVersion: "projects/demo/locations/us/apps/app-id/versions/v1",
    cesDeployment: "projects/demo/locations/us/apps/app-id/deployments/prod",
    dialogflowProjectId: "",
    dialogflowLocation: "",
    dialogflowAgentId: "",
    dialogflowEnvironmentId: "",
    googleServiceAccount: serviceAccountJson,
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected CES config to validate");
  }

  assert.deepEqual(buildAgentPersistenceValues(parsed.data), {
    name: "Support",
    platform: "ces_agent_studio",
    cesAppVersion: "projects/demo/locations/us/apps/app-id/versions/v1",
    cesDeployment: "projects/demo/locations/us/apps/app-id/deployments/prod",
    dialogflowProjectId: null,
    dialogflowLocation: null,
    dialogflowAgentId: null,
    dialogflowEnvironmentId: null,
    googleServiceAccount: serviceAccountJson,
  });
});

test("agentFormSchema accepts Conversational Agents config with blank environment", () => {
  const parsed = agentFormSchema.safeParse({
    name: "Support",
    platform: "conversational_agents",
    cesAppVersion: "",
    cesDeployment: "",
    dialogflowProjectId: "demo-project",
    dialogflowLocation: "global",
    dialogflowAgentId: "agent-123",
    dialogflowEnvironmentId: "",
    googleServiceAccount: serviceAccountJson,
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) {
    assert.fail("Expected Conversational Agents config to validate");
  }

  assert.deepEqual(buildAgentPersistenceValues(parsed.data), {
    name: "Support",
    platform: "conversational_agents",
    cesAppVersion: null,
    cesDeployment: null,
    dialogflowProjectId: "demo-project",
    dialogflowLocation: "global",
    dialogflowAgentId: "agent-123",
    dialogflowEnvironmentId: null,
    googleServiceAccount: serviceAccountJson,
  });
});

test("agentFormSchema rejects incomplete Conversational Agents config", () => {
  const parsed = agentFormSchema.safeParse({
    name: "Support",
    platform: "conversational_agents",
    cesAppVersion: "",
    cesDeployment: "",
    dialogflowProjectId: "",
    dialogflowLocation: "global",
    dialogflowAgentId: "agent-123",
    dialogflowEnvironmentId: "",
    googleServiceAccount: serviceAccountJson,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected Conversational Agents config to fail validation");
  }

  assert.match(parsed.error.flatten().fieldErrors.dialogflowProjectId?.[0] ?? "", /required/i);
});

test("agentFormSchema rejects invalid service account JSON", () => {
  const parsed = agentFormSchema.safeParse({
    name: "Support",
    platform: "ces_agent_studio",
    cesAppVersion: "projects/demo/locations/us/apps/app-id/versions/v1",
    cesDeployment: "",
    dialogflowProjectId: "",
    dialogflowLocation: "",
    dialogflowAgentId: "",
    dialogflowEnvironmentId: "",
    googleServiceAccount: "{}",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    assert.fail("Expected invalid service account JSON to fail validation");
  }

  assert.match(parsed.error.flatten().fieldErrors.googleServiceAccount?.[0] ?? "", /valid service account/i);
});
