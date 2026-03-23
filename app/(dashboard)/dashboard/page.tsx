import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { Bot, Link2, MessageSquare, Plus, Plug } from "lucide-react";
import { db } from "@/lib/db";
import { agents, channels, endUserSessions } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const quickActions = [
  {
    title: "Add Google CX Agent",
    description: "Register a CES app version and service account for routing.",
    href: "/agents/new",
    icon: Bot,
  },
  {
    title: "Add WhatsApp Connection",
    description: "Create a WhatsApp channel for Meta webhook and outbound replies.",
    href: "/channels/new?type=whatsapp",
    icon: Plug,
  },
  {
    title: "Add Website Widget",
    description: "Create an embeddable website widget channel with a secure key.",
    href: "/channels/new?type=website",
    icon: Plus,
  },
  {
    title: "Map Channel to Agent",
    description: "Assign exactly one CES agent to each live channel.",
    href: "/mappings",
    icon: Link2,
  },
  {
    title: "View Conversations",
    description: "Monitor AI and human takeover conversations in real time.",
    href: "/conversations",
    icon: MessageSquare,
  },
];

export default async function DashboardPage() {
  const [agentRows, channelRows, conversationRows, unmappedRows] = await Promise.all([
    db.select({ value: count() }).from(agents),
    db.select({ value: count() }).from(channels).where(eq(channels.isActive, true)),
    db.select({ value: count() }).from(endUserSessions),
    db
      .select({ value: count() })
      .from(channels)
      .where(and(eq(channels.isActive, true), isNull(channels.agentId))),
  ]);

  const stats = [
    { label: "Agents", value: agentRows[0]?.value ?? 0, tone: "bg-sky-50 text-sky-700 border-sky-200" },
    { label: "Active Channels", value: channelRows[0]?.value ?? 0, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Conversations", value: conversationRows[0]?.value ?? 0, tone: "bg-slate-50 text-slate-700 border-slate-200" },
    { label: "Unmapped Channels", value: unmappedRows[0]?.value ?? 0, tone: "bg-amber-50 text-amber-700 border-amber-200" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage Google CX agents, channel configuration, mappings, and conversations from one internal console.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
          Self Hosted
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${stat.tone}`}>
                Live snapshot
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <Card key={action.title} className="overflow-hidden border-border/70 bg-background/90">
            <CardHeader>
              <div className="mb-3 inline-flex w-fit rounded-xl border bg-muted/30 p-2">
                <action.icon className="h-4 w-4 text-sky-600" />
              </div>
              <CardTitle className="text-lg">{action.title}</CardTitle>
              <CardDescription>{action.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={action.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
