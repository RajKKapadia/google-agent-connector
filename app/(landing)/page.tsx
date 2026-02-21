import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Bot,
  Webhook,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Conversations",
    description:
      "Connect Google's Customer Engagement Suite AI agents to your WhatsApp Business number for intelligent, automated responses.",
  },
  {
    icon: Users,
    title: "Human Takeover",
    description:
      "Seamlessly hand off conversations from AI to human agents. Take control when it matters most.",
  },
  {
    icon: Zap,
    title: "Real-Time Dashboard",
    description:
      "Monitor all your conversations in real-time with live updates via Server-Sent Events.",
  },
  {
    icon: Webhook,
    title: "Simple Webhook Setup",
    description:
      "One-click webhook configuration. Just paste your URL into Meta Business Manager and you're live.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "End-to-end encryption for all credentials. HMAC signature verification on every webhook.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Connection",
    description:
      "Manage multiple WhatsApp numbers, each connected to different AI agents.",
  },
];

const steps = [
  {
    step: "1",
    title: "Create a Connection",
    description:
      "Link your WhatsApp Business Phone Number ID and your Google CES agent credentials.",
  },
  {
    step: "2",
    title: "Configure Your Webhook",
    description:
      "Copy the generated webhook URL and verify token into Meta Business Manager.",
  },
  {
    step: "3",
    title: "Go Live",
    description:
      "Start receiving and responding to WhatsApp messages with your AI agent instantly.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="min-h-[60vh] flex items-center justify-center py-16 sm:py-24 px-4 text-center bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto w-full">
          <Badge variant="secondary" className="mb-4">
            WhatsApp × Google CES
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Connect WhatsApp to{" "}
            <span className="text-blue-600">Google AI Agents</span>
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            CES Connector bridges your WhatsApp Business numbers with Google
            Customer Engagement Suite agents. Deploy AI-powered customer
            support in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">
            Everything You Need
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <f.icon className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 px-4 text-center bg-blue-600 text-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to automate your WhatsApp support?
          </h2>
          <p className="text-blue-100 mb-8 text-sm sm:text-base">
            Get started in minutes. No credit card required for the first
            connection.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sign-up">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
