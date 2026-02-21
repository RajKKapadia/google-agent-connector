import { createHmac, timingSafeEqual } from "crypto";
import { decrypt } from "@/lib/encryption";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";

interface SendTextMessageOptions {
  to: string;
  text: string;
  messageId?: string;
}

export class WhatsAppClient {
  private phoneNumberId: string;
  private accessToken: string;

  constructor(options: {
    phoneNumberId: string;
    accessTokenEncrypted: string;
  }) {
    this.phoneNumberId = options.phoneNumberId;
    this.accessToken = decrypt(options.accessTokenEncrypted);
  }

  async sendTextMessage(options: SendTextMessageOptions): Promise<void> {
    const { to, text, messageId } = options;

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    };

    if (messageId) {
      body.context = { message_id: messageId };
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `WhatsApp API error ${response.status}: ${errorText}`
      );
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    const body = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    const response = await fetch(
      `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      // Non-fatal — log and continue
      console.warn(`Failed to mark message as read: ${response.status}`);
    }
  }
}

/**
 * Verify the X-Hub-Signature-256 header from Meta/WhatsApp.
 * Returns true if the HMAC matches.
 */
export function verifyWhatsAppSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;

  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;

  const signature = signatureHeader.slice(expectedPrefix.length);

  const hmac = createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export function createWhatsAppClient(connection: {
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
}): WhatsAppClient {
  return new WhatsAppClient({
    phoneNumberId: connection.whatsappPhoneNumberId,
    accessTokenEncrypted: connection.whatsappAccessToken,
  });
}
