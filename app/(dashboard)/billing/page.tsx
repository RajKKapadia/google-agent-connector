import { auth } from "@clerk/nextjs/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, subscriptions } from "@/lib/db/schema";
import { PLANS } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { startCheckout, openBillingPortal } from "@/lib/actions/billing";
import type { PlanKey } from "@/lib/stripe";

const planFeatures: Record<PlanKey, string[]> = {
  starter: [
    "1 WhatsApp connection",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Email support",
  ],
  business: [
    "5 WhatsApp connections",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Priority support",
    "Analytics overview",
  ],
  enterprise: [
    "20 WhatsApp connections",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Dedicated support",
    "Advanced analytics",
    "Custom integrations",
  ],
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { success, canceled } = await searchParams;

  let subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!subscription) {
    const [created] = await db
      .insert(subscriptions)
      .values({ userId, plan: "starter" })
      .returning();
    subscription = created;
  }

  const [{ value: activeConnections }] = await db
    .select({ value: count() })
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.isActive, true)));

  const currentPlan = (subscription.plan ?? "starter") as PlanKey;
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const plans: PlanKey[] = ["starter", "business", "enterprise"];
  const connectionLimit = PLANS[currentPlan].connections;
  const usagePercent = Math.min(
    100,
    Math.round((activeConnections / connectionLimit) * 100)
  );

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage plan changes, track connection capacity, and keep your CES
            deployment aligned with current demand.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
        >
          Subscription Control
        </Badge>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Subscription activated successfully. Your plan has been updated.
        </div>
      )}

      {canceled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Checkout was canceled. Your plan has not changed.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <section className="space-y-6">
          <Card className="overflow-hidden border-border/70">
            <CardHeader className="gap-5 border-b bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,0.96))]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl capitalize text-foreground">
                    {currentPlan} Plan
                  </CardTitle>
                  <CardDescription className="max-w-xl text-muted-foreground">
                    Your current billing state, allowance, and renewal details
                    in a single summary.
                  </CardDescription>
                </div>
                {isActive ? (
                  <Badge className="border-0 bg-emerald-100 px-3 py-1 text-emerald-700">
                    Active
                  </Badge>
                ) : subscription.status ? (
                  <Badge
                    variant="outline"
                    className="border-border bg-background/80 px-3 py-1 capitalize text-foreground"
                  >
                    {subscription.status.replace("_", " ")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                  >
                    No active checkout
                  </Badge>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Monthly Price
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    ${PLANS[currentPlan].price}
                    <span className="text-sm font-medium text-muted-foreground">
                      /mo
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Connection Limit
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {connectionLimit}
                  </p>
                </div>
                <div className="rounded-xl border bg-background/90 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Renewal
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : "No billing cycle yet"}
                  </p>
                  {subscription.cancelAtPeriodEnd && (
                    <p className="mt-1 text-xs text-amber-700">
                      Cancels at period end
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>

            {subscription.stripeCustomerId && (
              <CardFooter className="justify-between border-t bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Open Stripe’s billing portal to update payment methods or
                  cancel the subscription.
                </p>
                <form action={openBillingPortal}>
                  <Button variant="outline" type="submit">
                    Manage Subscription
                  </Button>
                </form>
              </CardFooter>
            )}
          </Card>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Change Plan</h2>
              <p className="text-sm text-muted-foreground">
                Move up when you need more active numbers, better support, or
                additional reporting headroom.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {plans.map((key) => {
                const plan = PLANS[key];
                const isCurrent = key === currentPlan && isActive;
                const isPopular = key === "business";

                return (
                  <Card
                    key={key}
                    className={`relative flex h-full flex-col overflow-hidden ${
                      isPopular
                        ? "border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.18)]"
                        : ""
                    } ${isCurrent ? "bg-muted/35" : ""}`}
                  >
                    {isPopular && (
                      <Badge className="absolute right-5 top-5 bg-sky-500 text-white">
                        Popular
                      </Badge>
                    )}

                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg capitalize">{key}</CardTitle>
                      <CardDescription>
                        {key === "starter" &&
                          "Best for a single production line or a first CES rollout."}
                        {key === "business" &&
                          "A balanced tier for teams actively managing several numbers."}
                        {key === "enterprise" &&
                          "Extra capacity and support for higher-volume operations."}
                      </CardDescription>
                      <div className="pt-1">
                        <span className="text-4xl font-semibold">${plan.price}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <span className="font-medium">{plan.connections}</span>{" "}
                        active connection{plan.connections > 1 ? "s" : ""} included
                      </div>

                      <ul className="space-y-2.5">
                        {planFeatures[key].map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      {isCurrent ? (
                        <Button className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <form
                          action={startCheckout.bind(null, key)}
                          className="w-full"
                        >
                          <Button
                            className="w-full"
                            variant={isPopular ? "default" : "outline"}
                            type="submit"
                          >
                            {key === "enterprise" ||
                            (currentPlan === "starter" && key !== "starter")
                              ? "Upgrade"
                              : "Switch"}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </form>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDollarSign className="h-4 w-4 text-sky-600" />
                Usage Snapshot
              </CardTitle>
              <CardDescription>
                See how much of the current plan is already committed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Connections in use</span>
                  <span className="font-medium">
                    {activeConnections}/{connectionLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-sky-500 transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {connectionLimit - activeConnections > 0
                    ? `${connectionLimit - activeConnections} slot${
                        connectionLimit - activeConnections === 1 ? "" : "s"
                      } remaining before the next upgrade is required.`
                    : "You are at capacity for the current plan."}
                </p>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-lg border bg-muted/25 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Support
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {currentPlan === "enterprise"
                      ? "Dedicated support"
                      : currentPlan === "business"
                        ? "Priority support"
                        : "Email support"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/25 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Automation
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Human takeover is included on every tier
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/25 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Scale
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Unlimited message volume across all plans
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Changes When You Upgrade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p>Higher plans raise the connection cap immediately after checkout.</p>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p>Existing connections, sessions, and encrypted credentials remain untouched.</p>
              </div>
              <div className="flex gap-3">
                <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <p>Billing portal access stays available for cancellations and payment updates.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
