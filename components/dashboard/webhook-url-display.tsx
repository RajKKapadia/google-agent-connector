"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WebhookUrlDisplayProps {
  connectionId: string;
  verifyToken: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-sm" />
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function WebhookUrlDisplay({
  connectionId,
  verifyToken,
}: WebhookUrlDisplayProps) {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  const webhookUrl = `${appUrl}/api/webhooks/${connectionId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp Webhook Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CopyField label="Callback URL" value={webhookUrl} />
        <CopyField label="Verify Token" value={verifyToken} />

        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-medium text-foreground">Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Meta for Developers
              </a>
            </li>
            <li>Open your App → WhatsApp → Configuration</li>
            <li>Paste the Callback URL above into the Webhook URL field</li>
            <li>Paste the Verify Token above into the Verify Token field</li>
            <li>Click Verify and Save</li>
            <li>Subscribe to the &quot;messages&quot; webhook field</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
