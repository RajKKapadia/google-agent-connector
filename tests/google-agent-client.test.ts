import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDialogflowSessionPath,
  extractTextResponse,
  getGoogleAgentPlatform,
} from "@/lib/google-agent/client";

const fakePathClient = {
  projectLocationAgentSessionPath(project: string, location: string, agent: string, session: string) {
    return `agent:${project}/${location}/${agent}/${session}`;
  },
  projectLocationAgentEnvironmentSessionPath(
    project: string,
    location: string,
    agent: string,
    environment: string,
    session: string
  ) {
    return `environment:${project}/${location}/${agent}/${environment}/${session}`;
  },
};

test("buildDialogflowSessionPath uses direct agent path when environment is blank", () => {
  const sessionPath = buildDialogflowSessionPath(
    fakePathClient,
    {
      dialogflowProjectId: "demo-project",
      dialogflowLocation: "global",
      dialogflowAgentId: "agent-123",
      dialogflowEnvironmentId: null,
    },
    "session-1"
  );

  assert.equal(sessionPath, "agent:demo-project/global/agent-123/session-1");
});

test("buildDialogflowSessionPath uses environment path when configured", () => {
  const sessionPath = buildDialogflowSessionPath(
    fakePathClient,
    {
      dialogflowProjectId: "demo-project",
      dialogflowLocation: "global",
      dialogflowAgentId: "agent-123",
      dialogflowEnvironmentId: "prod",
    },
    "session-1"
  );

  assert.equal(
    sessionPath,
    "environment:demo-project/global/agent-123/prod/session-1"
  );
});

test("extractTextResponse combines outputs and response messages", () => {
  const text = extractTextResponse({
    outputs: [{ text: "From CES" }],
    queryResult: {
      responseMessages: [{ text: { text: ["Hello", "World"] } }],
    },
  });

  assert.equal(text, "From CES\nHello\nWorld");
});

test("extractTextResponse falls back when no text is returned", () => {
  const text = extractTextResponse({}, "Fallback message");

  assert.equal(text, "Fallback message");
});

test("getGoogleAgentPlatform preserves the selected platform", () => {
  assert.equal(getGoogleAgentPlatform("ces_agent_studio"), "ces_agent_studio");
  assert.equal(
    getGoogleAgentPlatform("conversational_agents"),
    "conversational_agents"
  );
});
