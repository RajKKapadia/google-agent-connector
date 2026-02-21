import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export const PLANS = {
  starter: {
    name: "Starter",
    price: 19,
    connections: 1,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
  },
  business: {
    name: "Business",
    price: 49,
    connections: 5,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID!,
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    connections: 20,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Get or create a Stripe customer for a given Clerk userId + email.
 */
export async function createOrRetrieveCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Search for existing customer by metadata
  const existing = await stripe.customers.search({
    query: `metadata['clerk_user_id']:'${userId}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { clerk_user_id: userId },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription.
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { clerk_customer_id: customerId },
    },
  });

  return session.url!;
}

/**
 * Create a Stripe Billing Portal session.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
