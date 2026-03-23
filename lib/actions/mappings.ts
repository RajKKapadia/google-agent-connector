"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/types";

export async function assignChannelAgent(
  channelId: string,
  agentId: string | null
): Promise<ActionResult> {
  await requireAdmin();

  await db
    .update(channels)
    .set({
      agentId,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId));

  revalidatePath("/channels");
  revalidatePath(`/channels/${channelId}`);
  revalidatePath("/mappings");
  revalidatePath("/dashboard");

  return { success: true };
}
