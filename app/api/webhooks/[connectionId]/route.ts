import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
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

// GET — WhatsApp webhook verification
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

  const connection = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  });

  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (connection.whatsappVerifyToken !== verifyToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

// POST — Receive incoming WhatsApp messages
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;

  // Must read raw bytes before any parsing
  const rawBody = await req.arrayBuffer();
  const rawBuffer = Buffer.from(rawBody);

  // Load connection to get the per-connection App Secret
  const connection = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  });

  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Use per-connection App Secret for HMAC verification
  const appSecret = decrypt(connection.whatsappAppSecret);
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppSignature(rawBuffer, signature, appSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBuffer.toString("utf-8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge immediately (Meta requires quick response)
  const response = NextResponse.json({ status: "ok" }, { status: 200 });

  // Enqueue jobs asynchronously (fire and forget)
  if (payload.object === "whatsapp_business_account") {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        for (const msg of value?.messages ?? []) {
          if (msg.type === "text" && msg.text?.body) {
            const jobId = `${connectionId}-${msg.id}`;
            const jobData: MessageJobData = {
              connectionId,
              waId: msg.from,
              messageText: msg.text.body,
              messageId: msg.id,
              timestamp: parseInt(msg.timestamp, 10),
            };
            messageQueue
              .add("process-message", jobData, { jobId })
              .catch((err: Error) => {
                console.error(`Failed to enqueue job ${jobId}:`, err.message);
              });
          }
        }
      }
    }
  }

  return response;
}
