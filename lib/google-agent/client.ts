import { SessionsClient } from "@google-cloud/dialogflow-cx";
import { GoogleAuth, JWT } from "google-auth-library";
import { decrypt } from "@/lib/encryption";
import type { AgentPlatform } from "@/lib/agents/config";

const DEFAULT_FALLBACK_TEXT =
  "I'm sorry, I couldn't process your request at this time.";

type TextResponsePayload = {
  outputs?: Array<{
    text?: string;
    [key: string]: unknown;
  }>;
  queryResult?: {
    responseMessages?: Array<{
      text?: { text?: string[] };
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export type GoogleAgentRecord = {
  platform: AgentPlatform;
  cesAppVersion: string | null;
  cesDeployment?: string | null;
  dialogflowProjectId?: string | null;
  dialogflowLocation?: string | null;
  dialogflowAgentId?: string | null;
  dialogflowEnvironmentId?: string | null;
  googleServiceAccount: string;
};

export type DialogflowPathClient = Pick<
  SessionsClient,
  | "projectLocationAgentSessionPath"
  | "projectLocationAgentEnvironmentSessionPath"
>;

export interface GoogleAgentClient {
  sendText(sessionId: string, messageText: string): Promise<string>;
}

function readServiceAccountCredentials(
  serviceAccountJsonEncrypted: string
): ServiceAccountCredentials {
  return JSON.parse(decrypt(serviceAccountJsonEncrypted)) as ServiceAccountCredentials;
}

function buildRunSessionUrl(cesAppVersion: string, sessionId: string): string {
  const versionIdx = cesAppVersion.lastIndexOf("/versions/");
  if (versionIdx === -1) {
    throw new Error(
      `Invalid cesAppVersion - expected ".../versions/...": ${cesAppVersion}`
    );
  }

  const appPath = cesAppVersion.slice(0, versionIdx);
  return `https://ces.googleapis.com/v1beta/${appPath}/sessions/${sessionId}:runSession`;
}

export function getGoogleAgentPlatform(platform: AgentPlatform): AgentPlatform {
  return platform;
}

export function buildDialogflowSessionPath(
  client: DialogflowPathClient,
  agent: {
    dialogflowProjectId: string;
    dialogflowLocation: string;
    dialogflowAgentId: string;
    dialogflowEnvironmentId?: string | null;
  },
  sessionId: string
): string {
  if (agent.dialogflowEnvironmentId) {
    return client.projectLocationAgentEnvironmentSessionPath(
      agent.dialogflowProjectId,
      agent.dialogflowLocation,
      agent.dialogflowAgentId,
      agent.dialogflowEnvironmentId,
      sessionId
    );
  }

  return client.projectLocationAgentSessionPath(
    agent.dialogflowProjectId,
    agent.dialogflowLocation,
    agent.dialogflowAgentId,
    sessionId
  );
}

export function extractTextResponse(
  response: TextResponsePayload,
  fallbackText = DEFAULT_FALLBACK_TEXT
): string {
  const texts: string[] = [];

  for (const output of response.outputs ?? []) {
    if (typeof output.text === "string" && output.text) {
      texts.push(output.text);
    }
  }

  for (const message of response.queryResult?.responseMessages ?? []) {
    if (message.text?.text) {
      texts.push(
        ...message.text.text.filter((text): text is string => Boolean(text))
      );
    }
  }

  return texts.join("\n").trim() || fallbackText;
}

class CESAgentStudioClient implements GoogleAgentClient {
  constructor(private readonly agent: GoogleAgentRecord) {}

  private async getAccessToken(): Promise<string> {
    const credentials = readServiceAccountCredentials(
      this.agent.googleServiceAccount
    );
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = (await auth.getClient()) as JWT;
    const { token } = await client.getAccessToken();
    if (!token) {
      throw new Error("Failed to obtain Google access token");
    }

    return token;
  }

  async sendText(sessionId: string, messageText: string): Promise<string> {
    if (!this.agent.cesAppVersion) {
      throw new Error("CES app version is not configured");
    }

    const accessToken = await this.getAccessToken();
    const url = buildRunSessionUrl(this.agent.cesAppVersion, sessionId);
    const versionIdx = this.agent.cesAppVersion.lastIndexOf("/versions/");
    const appPath = this.agent.cesAppVersion.slice(0, versionIdx);
    const sessionResourceName = `${appPath}/sessions/${sessionId}`;

    const config: Record<string, string> = {
      session: sessionResourceName,
      app_version: this.agent.cesAppVersion,
    };

    if (this.agent.cesDeployment) {
      config.deployment = this.agent.cesDeployment;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config,
        inputs: [{ text: messageText }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CES API error ${response.status}: ${errorText}`);
    }

    return extractTextResponse((await response.json()) as TextResponsePayload);
  }
}

class ConversationalAgentsClient implements GoogleAgentClient {
  private readonly credentials: ServiceAccountCredentials;

  constructor(private readonly agent: GoogleAgentRecord) {
    this.credentials = readServiceAccountCredentials(agent.googleServiceAccount);
  }

  private createClient(): SessionsClient {
    return new SessionsClient({
      credentials: {
        client_email: this.credentials.client_email,
        private_key: this.credentials.private_key,
      },
      projectId: this.agent.dialogflowProjectId || this.credentials.project_id,
    });
  }

  async sendText(sessionId: string, messageText: string): Promise<string> {
    if (
      !this.agent.dialogflowProjectId ||
      !this.agent.dialogflowLocation ||
      !this.agent.dialogflowAgentId
    ) {
      throw new Error("Conversational Agents target is not fully configured");
    }

    const client = this.createClient();
    const session = buildDialogflowSessionPath(
      client,
      {
        dialogflowProjectId: this.agent.dialogflowProjectId,
        dialogflowLocation: this.agent.dialogflowLocation,
        dialogflowAgentId: this.agent.dialogflowAgentId,
        dialogflowEnvironmentId: this.agent.dialogflowEnvironmentId,
      },
      sessionId
    );

    const [response] = await client.detectIntent({
      session,
      queryInput: {
        text: {
          text: messageText,
        },
        languageCode: "en",
      },
    });

    return extractTextResponse(response as TextResponsePayload);
  }
}

export function createGoogleAgentClient(
  agent: GoogleAgentRecord
): GoogleAgentClient {
  if (agent.platform === "ces_agent_studio") {
    return new CESAgentStudioClient(agent);
  }

  return new ConversationalAgentsClient(agent);
}
