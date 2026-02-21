"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, count } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { connections, subscriptions } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/stripe";

const connectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  whatsappAppId: z.string().min(1, "Meta App ID is required"),
  whatsappAppSecret: z.string().min(1, "Meta App Secret is required"),
  whatsappPhoneNumberId: z.string().min(1, "Sender ID (Phone Number ID) is required"),
  whatsappAccessToken: z.string().min(1, "WhatsApp Access Token is required"),
  cesAppVersion: z
    .string()
    .min(1, "CES App Version path is required")
    .refine(
      (s) => s.includes("/versions/"),
      "Must be a full app version path (e.g. projects/.../versions/...)"
    ),
  cesDeployment: z.string().optional(),
  googleAccessToken: z
    .string()
    .trim()
    .min(1, "Service Account JSON is required")
    .refine((s) => {
      try {
        const parsed = JSON.parse(s);
        return parsed.type === "service_account";
      } catch {
        return false;
      }
    }, "Must be valid service account JSON (type: service_account)"),
});

export type ConnectionFormData = z.infer<typeof connectionSchema>;

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

async function getConnectionLimit(userId: string): Promise<number> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub || !sub.plan) return PLANS.starter.connections;

  const plan = sub.plan as PlanKey;
  if (sub.status && ["active", "trialing"].includes(sub.status)) {
    return PLANS[plan].connections;
  }

  return PLANS.starter.connections;
}

export async function createConnection(
  formData: ConnectionFormData
): Promise<ActionResult<{ id: string }>> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const parsed = connectionSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Check connection limit
  const limit = await getConnectionLimit(userId);
  const [{ value: currentCount }] = await db
    .select({ value: count() })
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.isActive, true)));

  if (currentCount >= limit) {
    return {
      success: false,
      error: `Your plan allows a maximum of ${limit} active connection${limit === 1 ? "" : "s"}. Please upgrade to add more.`,
    };
  }

  const whatsappVerifyToken = randomBytes(32).toString("hex");

  // Encrypt all sensitive fields
  const encryptedAppSecret = encrypt(data.whatsappAppSecret);
  const encryptedAccessToken = encrypt(data.whatsappAccessToken);
  const encryptedGoogleToken = encrypt(data.googleAccessToken);

  const [newConnection] = await db
    .insert(connections)
    .values({
      userId,
      name: data.name,
      whatsappAppId: data.whatsappAppId,
      whatsappAppSecret: encryptedAppSecret,
      whatsappPhoneNumberId: data.whatsappPhoneNumberId,
      whatsappAccessToken: encryptedAccessToken,
      whatsappVerifyToken,
      cesAppVersion: data.cesAppVersion,
      cesDeployment: data.cesDeployment || null,
      googleAccessToken: encryptedGoogleToken,
    })
    .returning({ id: connections.id });

  revalidatePath("/connections");

  return { success: true, data: { id: newConnection.id } };
}

export async function updateConnection(
  id: string,
  formData: Partial<ConnectionFormData>
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db.query.connections.findFirst({
    where: and(eq(connections.id, id), eq(connections.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Connection not found" };
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (formData.name !== undefined) updateData.name = formData.name;
  if (formData.whatsappAppId !== undefined) updateData.whatsappAppId = formData.whatsappAppId;
  if (formData.whatsappAppSecret !== undefined)
    updateData.whatsappAppSecret = encrypt(formData.whatsappAppSecret);
  if (formData.whatsappPhoneNumberId !== undefined)
    updateData.whatsappPhoneNumberId = formData.whatsappPhoneNumberId;
  if (formData.whatsappAccessToken !== undefined)
    updateData.whatsappAccessToken = encrypt(formData.whatsappAccessToken);
  if (formData.cesAppVersion !== undefined) updateData.cesAppVersion = formData.cesAppVersion;
  if (formData.cesDeployment !== undefined)
    updateData.cesDeployment = formData.cesDeployment || null;
  if (formData.googleAccessToken !== undefined)
    updateData.googleAccessToken = encrypt(formData.googleAccessToken);

  await db
    .update(connections)
    .set(updateData)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)));

  revalidatePath("/connections");
  revalidatePath(`/connections/${id}`);

  return { success: true };
}

export async function deleteConnection(id: string): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existing = await db.query.connections.findFirst({
    where: and(eq(connections.id, id), eq(connections.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Connection not found" };
  }

  await db
    .update(connections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(connections.id, id), eq(connections.userId, userId)));

  revalidatePath("/connections");

  return { success: true };
}

export async function getUserConnections() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return db.query.connections.findMany({
    where: and(eq(connections.userId, userId), eq(connections.isActive, true)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

export async function getConnectionById(id: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, id), eq(connections.userId, userId)),
  });

  return connection ?? null;
}
