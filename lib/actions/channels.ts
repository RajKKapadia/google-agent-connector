"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/types";

const channelSchema = z
  .object({
    type: z.enum(["whatsapp", "website"]),
    name: z.string().trim().min(1, "Name is required").max(100),
    whatsappAppId: z.string().optional(),
    whatsappAppSecret: z.string().optional(),
    whatsappPhoneNumberId: z.string().optional(),
    whatsappAccessToken: z.string().optional(),
    websiteDomain: z.string().optional(),
    widgetTitle: z.string().optional(),
    widgetBubbleColor: z.string().optional(),
    widgetFontFamily: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "whatsapp") {
      if (!data.whatsappAppId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappAppId"],
          message: "Meta App ID is required",
        });
      }
      if (!data.whatsappAppSecret?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappAppSecret"],
          message: "Meta App Secret is required",
        });
      }
      if (!data.whatsappPhoneNumberId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappPhoneNumberId"],
          message: "Phone Number ID is required",
        });
      }
      if (!data.whatsappAccessToken?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappAccessToken"],
          message: "WhatsApp access token is required",
        });
      }
    }

    if (data.type === "website") {
      if (!data.websiteDomain?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["websiteDomain"],
          message: "Allowed site(s) are required",
        });
      }
      if (!data.widgetTitle?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["widgetTitle"],
          message: "Widget title is required",
        });
      }
    }
  });

export type ChannelFormData = z.infer<typeof channelSchema>;

export async function createChannel(
  formData: ChannelFormData
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = channelSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const whatsappVerifyToken = randomBytes(32).toString("hex");
  const widgetKey = randomBytes(24).toString("hex");

  const [channel] = await db
    .insert(channels)
    .values({
      name: data.name,
      type: data.type,
      whatsappAppId: data.whatsappAppId?.trim() || "website",
      whatsappAppSecret: encrypt(data.whatsappAppSecret?.trim() || "website"),
      whatsappPhoneNumberId: data.whatsappPhoneNumberId?.trim() || "website",
      whatsappAccessToken: encrypt(data.whatsappAccessToken?.trim() || "website"),
      whatsappVerifyToken,
      websiteDomain: data.websiteDomain?.trim() || null,
      widgetKey: data.type === "website" ? widgetKey : null,
      widgetTitle:
        data.type === "website"
          ? data.widgetTitle?.trim() || data.name
          : null,
      widgetBubbleColor: data.widgetBubbleColor?.trim() || "#2563eb",
      widgetFontFamily:
        data.widgetFontFamily?.trim() || "system-ui, sans-serif",
      updatedAt: new Date(),
    })
    .returning({ id: channels.id });

  revalidatePath("/channels");
  revalidatePath("/dashboard");
  revalidatePath("/mappings");

  return { success: true, data: { id: channel.id } };
}

export async function updateChannel(
  id: string,
  formData: ChannelFormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = channelSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {
    name: data.name,
    updatedAt: new Date(),
  };

  if (data.type === "whatsapp") {
    updateData.whatsappAppId = data.whatsappAppId?.trim() || "website";
    updateData.whatsappAppSecret = encrypt(
      data.whatsappAppSecret?.trim() || "website"
    );
    updateData.whatsappPhoneNumberId =
      data.whatsappPhoneNumberId?.trim() || "website";
    updateData.whatsappAccessToken = encrypt(
      data.whatsappAccessToken?.trim() || "website"
    );
  } else {
    updateData.websiteDomain = data.websiteDomain?.trim() || null;
    updateData.widgetTitle = data.widgetTitle?.trim() || data.name;
    updateData.widgetBubbleColor = data.widgetBubbleColor?.trim() || "#2563eb";
    updateData.widgetFontFamily =
      data.widgetFontFamily?.trim() || "system-ui, sans-serif";
  }

  await db.update(channels).set(updateData).where(eq(channels.id, id));

  revalidatePath("/channels");
  revalidatePath(`/channels/${id}`);
  revalidatePath("/mappings");

  return { success: true };
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(channels)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(channels.id, id));

  revalidatePath("/channels");
  revalidatePath("/dashboard");
  revalidatePath("/mappings");

  return { success: true };
}
