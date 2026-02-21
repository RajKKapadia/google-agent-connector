"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plug,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/sessions", label: "Sessions", icon: MessageSquare },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-background flex flex-col shrink-0">
      <div className="h-14 flex items-center px-4 border-b shrink-0">
        <Link href="/dashboard" className="text-lg font-bold">
          CES Connector
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
