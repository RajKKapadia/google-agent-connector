import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminUser } from "@/lib/auth/session";
import { SetupForm } from "@/components/auth/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdminUser()) {
    const admin = await getCurrentAdmin();
    redirect(admin ? "/dashboard" : "/login");
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-center">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            First Run Setup
          </span>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Create the admin account for this self-hosted Google AI workspace.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              This replaces the old SaaS signup flow. After setup, the dashboard lets you add Google agents, connect WhatsApp or website channels, map channels to agents, and monitor conversations.
            </p>
          </div>
        </section>
        <SetupForm />
      </div>
    </main>
  );
}
