import { GoogleAuth, JWT } from "google-auth-library";
import { decrypt } from "@/lib/encryption";

// Response shape for POST :runSession (v1beta)
interface CESRunSessionResponse {
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
}

/**
 * Builds the runSession URL from the app version full path.
 *
 * cesAppVersion: "projects/P/locations/L/apps/A/versions/V"
 * → "https://ces.googleapis.com/v1beta/projects/P/locations/L/apps/A/sessions/{sessionId}:runSession"
 */
function buildRunSessionUrl(cesAppVersion: string, sessionId: string): string {
  const versionIdx = cesAppVersion.lastIndexOf("/versions/");
  if (versionIdx === -1) {
    throw new Error(
      `Invalid cesAppVersion — expected ".../versions/...": ${cesAppVersion}`
    );
  }
  const appPath = cesAppVersion.slice(0, versionIdx);
  return `https://ces.googleapis.com/v1beta/${appPath}/sessions/${sessionId}:runSession`;
}

export class CESClient {
  private cesAppVersion: string;
  private cesDeployment: string | null;
  private serviceAccountJsonEncrypted: string;

  constructor(options: {
    cesAppVersion: string;
    cesDeployment?: string | null;
    serviceAccountJsonEncrypted: string;
  }) {
    this.cesAppVersion = options.cesAppVersion;
    this.cesDeployment = options.cesDeployment ?? null;
    this.serviceAccountJsonEncrypted = options.serviceAccountJsonEncrypted;
  }

  private async getAccessToken(): Promise<string> {
    const serviceAccountJson = JSON.parse(
      decrypt(this.serviceAccountJsonEncrypted)
    );
    const auth = new GoogleAuth({
      credentials: serviceAccountJson,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = (await auth.getClient()) as JWT;
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Failed to obtain Google access token");
    return token;
  }

  async runSession(
    cesSessionId: string,
    messageText: string
  ): Promise<CESRunSessionResponse> {
    const accessToken = await this.getAccessToken();
    const url = buildRunSessionUrl(this.cesAppVersion, cesSessionId);

    const versionIdx = this.cesAppVersion.lastIndexOf("/versions/");
    const appPath = this.cesAppVersion.slice(0, versionIdx);
    const sessionResourceName = `${appPath}/sessions/${cesSessionId}`;

    const config: Record<string, string> = {
      session: sessionResourceName,
      app_version: this.cesAppVersion,
    };
    if (this.cesDeployment) {
      config.deployment = this.cesDeployment;
    }

    const body = {
      config,
      inputs: [{ text: messageText }],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CES API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as CESRunSessionResponse;
    console.log("[CES] Raw response:", JSON.stringify(data, null, 2));
    return data;
  }

  extractTextResponse(response: CESRunSessionResponse): string {
    const texts: string[] = [];

    for (const output of response.outputs ?? []) {
      if (typeof output.text === "string" && output.text) {
        texts.push(output.text);
      }
    }

    for (const msg of response.queryResult?.responseMessages ?? []) {
      if (msg.text?.text) texts.push(...msg.text.text);
    }

    if (texts.length === 0) {
      console.warn(
        "[CES] Could not extract text from response:",
        JSON.stringify(response)
      );
    }

    return (
      texts.join("\n").trim() ||
      "I'm sorry, I couldn't process your request at this time."
    );
  }
}

export function createCESClient(connection: {
  cesAppVersion: string;
  cesDeployment?: string | null;
  googleAccessToken: string; // stores encrypted service account JSON
}): CESClient {
  return new CESClient({
    cesAppVersion: connection.cesAppVersion,
    cesDeployment: connection.cesDeployment,
    serviceAccountJsonEncrypted: connection.googleAccessToken,
  });
}
