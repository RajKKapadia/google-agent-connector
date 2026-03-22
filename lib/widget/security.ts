import { createHmac, timingSafeEqual } from "crypto";

const WIDGET_TOKEN_TTL_MS = 15 * 60 * 1000;

interface ParsedSite {
  hostname: string;
  port: string | null;
}

interface WidgetTokenPayload {
  connectionId: string;
  widgetKey: string;
  expiresAt: number;
}

function getWidgetTokenSecret() {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("ENCRYPTION_KEY is required for widget token signing");
  }

  return secret;
}

function parseSite(value: string | null | undefined): ParsedSite | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const normalized = trimmed.includes("://")
      ? trimmed
      : `http://${trimmed}`;
    const url = new URL(normalized);

    return {
      hostname: url.hostname.toLowerCase(),
      port: url.port || null,
    };
  } catch {
    return null;
  }
}

function parseAllowedSites(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split(/[\n,;]+/)
    .map((entry) => parseSite(entry))
    .filter((entry): entry is ParsedSite => entry !== null);
}

function isHostMatch(hostname: string, allowedHostname: string) {
  return hostname === allowedHostname || hostname.endsWith(`.${allowedHostname}`);
}

function isPortMatch(port: string | null, allowedPort: string | null) {
  if (!allowedPort) return true;
  return port === allowedPort;
}

function hasValidSignature(encodedPayload: string, signature: string) {
  const expected = createHmac("sha256", getWidgetTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function isAllowedWidgetSite(
  requestUrl: string | null,
  allowedSite: string | null
) {
  const requestSite = parseSite(requestUrl);
  const configuredSites = parseAllowedSites(allowedSite);

  if (!requestSite || configuredSites.length === 0) return false;

  return configuredSites.some(
    (configuredSite) =>
      isHostMatch(requestSite.hostname, configuredSite.hostname) &&
      isPortMatch(requestSite.port, configuredSite.port)
  );
}

export function getWidgetEmbedSource(headers: Headers) {
  return headers.get("referer") ?? headers.get("origin");
}

export function createWidgetAccessToken(connectionId: string, widgetKey: string) {
  const payload: WidgetTokenPayload = {
    connectionId,
    widgetKey,
    expiresAt: Date.now() + WIDGET_TOKEN_TTL_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getWidgetTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyWidgetAccessToken(
  token: string | undefined,
  connectionId: string,
  widgetKey: string
) {
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  if (!hasValidSignature(encodedPayload, signature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as WidgetTokenPayload;

    return (
      payload.connectionId === connectionId &&
      payload.widgetKey === widgetKey &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
