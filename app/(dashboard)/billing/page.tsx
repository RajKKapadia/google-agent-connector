import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
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
import { Check, ArrowRight } from "lucide-react";
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

  // Create default row if not exists
  if (!subscription) {
    const [created] = await db
      .insert(subscriptions)
      .values({ userId, plan: "starter" })
      .returning();
    subscription = created;
  }

  const currentPlan = (subscription.plan ?? "starter") as PlanKey;
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  const plans: PlanKey[] = ["starter", "business", "enterprise"];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Subscription activated successfully! Your plan has been updated.
        </div>
      )}
      {canceled && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          Checkout was canceled. Your plan has not changed.
        </div>
      )}

      {/* Current plan summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
          <CardDescription>
            Your active subscription and usage overview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold capitalize">{currentPlan}</span>
            {isActive ? (
              <Badge className="bg-green-100 text-green-700 border-0">
                Active
              </Badge>
            ) : subscription.status ? (
              <Badge variant="destructive" className="capitalize">
                {subscription.status.replace("_", " ")}
              </Badge>
            ) : (
              <Badge variant="secondary">Free tier</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {PLANS[currentPlan].connections} connection
            {PLANS[currentPlan].connections > 1 ? "s" : ""} ·{" "}
            ${PLANS[currentPlan].price}/month
          </p>
          {subscription.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Renews on{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              {subscription.cancelAtPeriodEnd && " (cancels at period end)"}
            </p>
          )}
        </CardContent>
        {subscription.stripeCustomerId && (
          <CardFooter>
            <form action={openBillingPortal}>
              <Button variant="outline" type="submit">
                Manage Subscription
              </Button>
            </form>
          </CardFooter>
        )}
      </Card>

      <Separator className="mb-8" />

      {/* Plan cards */}
      <h2 className="text-lg font-semibold mb-4">Change Plan</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === currentPlan && isActive;
          const isPopular = key === "business";
          return (
            <Card
              key={key}
              className={`flex flex-col relative ${isPopular ? "border-blue-600" : ""} ${isCurrent ? "bg-muted/50" : ""}`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-xs">
                  Popular
                </Badge>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-base capitalize">{key}</CardTitle>
                <div>
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {planFeatures[key].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      {f}
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
                  <form action={startCheckout.bind(null, key)} className="w-full">
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                      type="submit"
                    >
                      {key === "enterprise" || (currentPlan === "starter" && key !== "starter")
                        ? "Upgrade"
                        : "Switch"}{" "}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </form>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
