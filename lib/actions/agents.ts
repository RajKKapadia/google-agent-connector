"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/types";

const agentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  cesAppVersion: z
    .string()
    .trim()
    .min(1, "CES app version is required")
    .refine(
      (value) => value.includes("/versions/"),
      "Must be a full app version path"
    ),
  cesDeployment: z.string().trim().optional(),
  googleServiceAccount: z
    .string()
    .trim()
    .min(1, "Service account JSON is required")
    .refine((value) => {
      try {
        const parsed = JSON.parse(value);
        return parsed.type === "service_account";
      } catch {
        return false;
      }
    }, "Must be valid service account JSON"),
});

export type AgentFormData = z.infer<typeof agentSchema>;

export async function createAgent(
  formData: AgentFormData
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = agentSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [agent] = await db
    .insert(agents)
    .values({
      name: parsed.data.name,
      cesAppVersion: parsed.data.cesAppVersion,
      cesDeployment: parsed.data.cesDeployment || null,
      googleServiceAccount: encrypt(parsed.data.googleServiceAccount),
      updatedAt: new Date(),
    })
    .returning({ id: agents.id });

  revalidatePath("/agents");
  revalidatePath("/dashboard");
  revalidatePath("/mappings");

  return { success: true, data: { id: agent.id } };
}

export async function updateAgent(
  id: string,
  formData: AgentFormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = agentSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await db
    .update(agents)
    .set({
      name: parsed.data.name,
      cesAppVersion: parsed.data.cesAppVersion,
      cesDeployment: parsed.data.cesDeployment || null,
      googleServiceAccount: encrypt(parsed.data.googleServiceAccount),
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id));

  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);
  revalidatePath("/mappings");

  return { success: true };
}
