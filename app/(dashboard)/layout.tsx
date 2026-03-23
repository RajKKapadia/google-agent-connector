import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { logoutAdmin } from "@/lib/actions/auth";
import { hasAdminUser, requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasAdminUser())) {
    redirect("/setup");
  }

  const admin = await requireAdmin();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex">
          <AppSidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur shrink-0">
            <MobileNav />
            <div>
              <p className="text-sm font-medium">{admin.name}</p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
            </div>
            <div className="flex-1" />
            <form action={logoutAdmin}>
              <Button variant="outline" size="sm" type="submit">
                Logout
              </Button>
            </form>
          </header>
          <main className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
