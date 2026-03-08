"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  PLANS,
  createOrRetrieveCustomer,
  createCheckoutSession,
  createBillingPortalSession,
} from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PlanKey } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function getOrCreateSubscription() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (existing) return existing;

  // Create default free/starter subscription row
  const [created] = await db
    .insert(subscriptions)
    .values({ userId, plan: "starter" })
    .returning();

  return created;
}

export async function startCheckout(plan: PlanKey) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const customerId = await createOrRetrieveCustomer(userId, email);

  const url = await createCheckoutSession(
    customerId,
    PLANS[plan].priceId,
    `${APP_URL}/billing?success=true`,
    `${APP_URL}/billing?canceled=true`
  );

  redirect(url);
}

export async function openBillingPortal() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer found. Please subscribe first.");
  }

  const url = await createBillingPortalSession(
    sub.stripeCustomerId,
    `${APP_URL}/billing`
  );

  redirect(url);
}
