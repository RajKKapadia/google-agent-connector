"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/actions/types";
import {
  createAdminSession,
  destroyCurrentAdminSession,
  getCurrentAdmin,
  hasAdminUser,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const setupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.string().trim().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export type SetupFormData = z.infer<typeof setupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;

export async function createInitialAdmin(
  formData: SetupFormData
): Promise<ActionResult> {
  if (await hasAdminUser()) {
    return {
      success: false,
      error: "Initial setup has already been completed.",
    };
  }

  const parsed = setupSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [adminUser] = await db
    .insert(adminUsers)
    .values({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash: hashPassword(parsed.data.password),
      updatedAt: new Date(),
    })
    .returning({ id: adminUsers.id });

  await createAdminSession(adminUser.id);

  return { success: true };
}

export async function loginAdmin(
  formData: LoginFormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminUser = await db.query.adminUsers.findFirst({
    where: (t, { eq }) => eq(t.email, parsed.data.email.toLowerCase()),
  });

  if (!adminUser || !verifyPassword(parsed.data.password, adminUser.passwordHash)) {
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  await createAdminSession(adminUser.id);

  return { success: true };
}

export async function logoutAdmin() {
  await destroyCurrentAdminSession();
  redirect("/login");
}

export async function getAuthenticatedAdmin() {
  return getCurrentAdmin();
}
