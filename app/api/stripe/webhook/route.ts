import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import type { PlanKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function upsertSubscription(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Retrieve customer to get clerk userId from metadata
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const userId = customer.metadata?.clerk_user_id;
  if (!userId) {
    console.warn(`Stripe customer ${customerId} has no clerk_user_id metadata`);
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? null;

  // Determine plan from price ID
  const planMap: Record<string, PlanKey> = {
    [process.env.STRIPE_STARTER_PRICE_ID!]: "starter",
    [process.env.STRIPE_BUSINESS_PRICE_ID!]: "business",
    [process.env.STRIPE_ENTERPRISE_PRICE_ID!]: "enterprise",
  };
  const plan: PlanKey =
    priceId && planMap[priceId] ? planMap[priceId] : "starter";

  const statusMap: Record<
    Stripe.Subscription.Status,
    | "active"
    | "canceled"
    | "past_due"
    | "trialing"
    | "incomplete"
  > = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    trialing: "trialing",
    incomplete: "incomplete",
    incomplete_expired: "incomplete",
    paused: "canceled",
    unpaid: "past_due",
  };

  const status = statusMap[sub.status] ?? "incomplete";

  // In Stripe API 2026-01-28.clover, current_period_start/end are gone.
  // Use billing_cycle_anchor as a proxy for the start.
  const periodStart = sub.billing_cycle_anchor
    ? new Date(sub.billing_cycle_anchor * 1000)
    : null;

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        plan,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // In new API, subscription ref is in parent.subscription_details.subscription
        const parent = invoice.parent;
        if (parent && "subscription_details" in parent && parent.subscription_details) {
          const subRef = parent.subscription_details.subscription;
          if (subRef) {
            const subId = typeof subRef === "string" ? subRef : subRef.id;
            await db
              .update(subscriptions)
              .set({ status: "past_due", updatedAt: new Date() })
              .where(eq(subscriptions.stripeSubscriptionId, subId));
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
