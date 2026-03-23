import { redirect } from "next/navigation";
import { getCurrentAdmin, hasAdminUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasAdminUser())) {
    redirect("/setup");
  }

  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-center">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Admin Access
          </span>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Sign in to manage agents, channels, mappings, and conversations.
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              This is an internal console only. Public integrations for WhatsApp webhooks and website widgets remain active without dashboard authentication.
            </p>
          </div>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
