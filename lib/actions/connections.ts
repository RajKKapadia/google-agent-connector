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
  type: z.enum(["whatsapp", "website"]).default("whatsapp"),
  name: z.string().min(1, "Name is required").max(100),
  whatsappAppId: z.string().optional(),
  whatsappAppSecret: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  whatsappAccessToken: z.string().optional(),
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
  websiteDomain: z.string().optional(),
  widgetTitle: z.string().optional(),
  widgetBubbleColor: z.string().optional(),
  widgetFontFamily: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "whatsapp") {
    if (!data.whatsappAppId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsappAppId"], message: "Meta App ID is required" });
    }
    if (!data.whatsappAppSecret?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsappAppSecret"], message: "Meta App Secret is required" });
    }
    if (!data.whatsappPhoneNumberId?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsappPhoneNumberId"], message: "Sender ID (Phone Number ID) is required" });
    }
    if (!data.whatsappAccessToken?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsappAccessToken"], message: "WhatsApp Access Token is required" });
    }
  }

  if (data.type === "website" && !data.websiteDomain?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["websiteDomain"], message: "Website domain is required" });
  }

  if (data.type === "website" && !data.widgetTitle?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["widgetTitle"], message: "Widget title is required" });
  }
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
  const widgetKey = randomBytes(24).toString("hex");

  // Encrypt all sensitive fields
  const encryptedAppSecret = encrypt(data.whatsappAppSecret?.trim() || "website");
  const encryptedAccessToken = encrypt(
    data.whatsappAccessToken?.trim() || "website"
  );
  const encryptedGoogleToken = encrypt(data.googleAccessToken);

  const [newConnection] = await db
    .insert(connections)
    .values({
      userId,
      name: data.name,
      type: data.type,
      whatsappAppId: data.whatsappAppId?.trim() || "website",
      whatsappAppSecret: encryptedAppSecret,
      whatsappPhoneNumberId: data.whatsappPhoneNumberId?.trim() || "website",
      whatsappAccessToken: encryptedAccessToken,
      whatsappVerifyToken,
      cesAppVersion: data.cesAppVersion.trim(),
      cesDeployment: data.cesDeployment || null,
      googleAccessToken: encryptedGoogleToken,
      websiteDomain: data.websiteDomain?.trim() || null,
      widgetKey: data.type === "website" ? widgetKey : null,
      widgetTitle:
        data.type === "website"
          ? data.widgetTitle?.trim() || data.name.trim()
          : null,
      widgetBubbleColor: data.widgetBubbleColor?.trim() || "#2563eb",
      widgetFontFamily: data.widgetFontFamily?.trim() || "Inter, system-ui, sans-serif",
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
  if (formData.type !== undefined) updateData.type = formData.type;
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
  if (formData.websiteDomain !== undefined)
    updateData.websiteDomain = formData.websiteDomain || null;
  if (formData.widgetTitle !== undefined)
    updateData.widgetTitle = formData.widgetTitle || null;
  if (formData.widgetBubbleColor !== undefined)
    updateData.widgetBubbleColor = formData.widgetBubbleColor || null;
  if (formData.widgetFontFamily !== undefined)
    updateData.widgetFontFamily = formData.widgetFontFamily || null;

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
