import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold shrink-0">
            CES Connector
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            {/* Pricing hidden on mobile to save space */}
            <Link
              href="/pricing"
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <SignedOut>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                asChild
              >
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton />
            </SignedIn>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground px-4">
        © {new Date().getFullYear()} CES Connector. All rights reserved.
      </footer>
    </div>
  );
}
