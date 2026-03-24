"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import {
  agentFormSchema,
  buildAgentPersistenceValues,
  type AgentFormData,
} from "@/lib/agents/config";
import { encrypt } from "@/lib/encryption";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/types";

export async function createAgent(
  formData: AgentFormData
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = agentFormSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const values = buildAgentPersistenceValues(parsed.data);

  const [agent] = await db
    .insert(agents)
    .values({
      ...values,
      googleServiceAccount: encrypt(values.googleServiceAccount),
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

  const parsed = agentFormSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const values = buildAgentPersistenceValues(parsed.data);

  await db
    .update(agents)
    .set({
      ...values,
      googleServiceAccount: encrypt(values.googleServiceAccount),
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id));

  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);
  revalidatePath("/mappings");

  return { success: true };
}
