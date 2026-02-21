import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/stripe";

const planFeatures = {
  starter: [
    "1 WhatsApp connection",
    "1 CES AI agent",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Email support",
  ],
  business: [
    "5 WhatsApp connections",
    "5 CES AI agents",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Priority email support",
    "Analytics overview",
  ],
  enterprise: [
    "20 WhatsApp connections",
    "20 CES AI agents",
    "Unlimited messages",
    "Real-time dashboard",
    "Human takeover",
    "Dedicated support",
    "Advanced analytics",
    "Custom integrations",
  ],
};

type PlanKey = keyof typeof PLANS;

export default function PricingPage() {
  const plans: PlanKey[] = ["starter", "business", "enterprise"];

  return (
    <div className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground">
            Choose the plan that fits your needs. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((key) => {
            const plan = PLANS[key];
            const isPopular = key === "business";
            return (
              <Card
                key={key}
                className={`relative flex flex-col ${isPopular ? "border-blue-600 shadow-lg" : ""}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Up to {plan.connections} connection{plan.connections > 1 ? "s" : ""}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {planFeatures[key].map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/sign-up">Get Started</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-6">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-medium">Feature</th>
                  {plans.map((key) => (
                    <th key={key} className="py-3 px-4 font-medium">
                      {PLANS[key].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["WhatsApp Connections", "1", "5", "20"],
                  ["CES AI Agents", "1", "5", "20"],
                  ["Messages per Month", "Unlimited", "Unlimited", "Unlimited"],
                  ["Human Takeover", "✓", "✓", "✓"],
                  ["Real-time Dashboard", "✓", "✓", "✓"],
                  ["Support", "Email", "Priority", "Dedicated"],
                  ["Analytics", "Basic", "Overview", "Advanced"],
                ].map(([feature, ...values]) => (
                  <tr key={feature} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-left text-muted-foreground">
                      {feature}
                    </td>
                    {values.map((v, i) => (
                      <td key={i} className="py-3 px-4 text-center">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
