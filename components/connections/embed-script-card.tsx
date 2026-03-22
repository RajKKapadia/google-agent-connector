"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmbedScriptCardProps {
  scriptTag: string;
  websiteDomain: string | null;
}

export function EmbedScriptCard({
  scriptTag,
  websiteDomain,
}: EmbedScriptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Website Embed Script</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add this script before the closing <code>&lt;/body&gt;</code> tag
            on <span className="font-medium">{websiteDomain}</span>.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
          <code>{scriptTag}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
