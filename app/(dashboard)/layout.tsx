import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <header className="h-14 flex items-center px-4 border-b shrink-0 bg-background gap-3">
            {/* Mobile hamburger — hidden on lg+ */}
            <MobileNav />
            {/* Spacer pushes UserButton to the right */}
            <div className="flex-1" />
            <UserButton />
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
