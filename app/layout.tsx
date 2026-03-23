import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CES Connector Admin",
  description: "Self-hosted admin console for CES channels and conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_35%),linear-gradient(180deg,#ffffff,#f8fafc)] text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
