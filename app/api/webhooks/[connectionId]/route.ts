import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/client";
import { decrypt } from "@/lib/encryption";
import { messageQueue, type MessageJobData } from "@/lib/queue";

interface WhatsAppMessage {
  id: string;
  from: string;
  text?: { body: string };
  type: string;
  timestamp: string;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !verifyToken || !challenge) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, connectionId),
  });

  if (!channel || channel.type !== "whatsapp") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (channel.whatsappVerifyToken !== verifyToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const rawBody = await req.arrayBuffer();
  const rawBuffer = Buffer.from(rawBody);

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, connectionId),
  });

  if (!channel || channel.type !== "whatsapp") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!channel.agentId) {
    return NextResponse.json(
      { error: "Channel is not mapped to an agent" },
      { status: 409 }
    );
  }

  const appSecret = decrypt(channel.whatsappAppSecret);
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppSignature(rawBuffer, signature, appSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBuffer.toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const response = NextResponse.json({ status: "ok" }, { status: 200 });

  if (payload.object === "whatsapp_business_account") {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const message of value?.messages ?? []) {
          if (message.type === "text" && message.text?.body) {
            const jobId = `${connectionId}-${message.id}`;
            const jobData: MessageJobData = {
              channelId: connectionId,
              waId: message.from,
              messageText: message.text.body,
              messageId: message.id,
              timestamp: parseInt(message.timestamp, 10),
            };
            messageQueue
              .add("process-message", jobData, { jobId })
              .catch((error: Error) => {
                console.error(`Failed to enqueue job ${jobId}:`, error.message);
              });
          }
        }
      }
    }
  }

  return response;
}
