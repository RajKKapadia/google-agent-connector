"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, User, Send } from "lucide-react";
import { setSessionMode, sendHumanAgentMessage } from "@/lib/actions/sessions";

interface HumanTakeoverControlsProps {
  sessionId: string;
  mode: "ai" | "human";
  excludeHumanMessages: boolean;
  connectionType: "whatsapp" | "website";
  initialWebsiteSessionActive: boolean | null;
}

export function HumanTakeoverControls({
  sessionId,
  mode,
  excludeHumanMessages,
  connectionType,
  initialWebsiteSessionActive,
}: HumanTakeoverControlsProps) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [excludeHistory, setExcludeHistory] = useState(excludeHumanMessages);
  const [messageText, setMessageText] = useState("");
  const [websiteSessionActive, setWebsiteSessionActive] = useState(
    initialWebsiteSessionActive ?? false
  );
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const isWebsiteConnection = connectionType === "website";
  const isWebsiteSendDisabled =
    isWebsiteConnection && currentMode === "human" && !websiteSessionActive;

  useEffect(() => {
    if (!isWebsiteConnection) return;

    let cancelled = false;

    async function refreshPresence() {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/presence`, {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as { active?: boolean };
        if (!cancelled && typeof data.active === "boolean") {
          setWebsiteSessionActive(data.active);
        }
      } catch {
        // Keep the last known presence value if polling fails.
      }
    }

    void refreshPresence();
    const intervalId = window.setInterval(() => {
      void refreshPresence();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isWebsiteConnection, sessionId]);

  async function handleTakeOver() {
    startTransition(async () => {
      const result = await setSessionMode(sessionId, "human");
      if (result.success) {
        setCurrentMode("human");
        toast.success("You've taken over this session");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleReturnToAI() {
    startTransition(async () => {
      const result = await setSessionMode(sessionId, "ai", excludeHistory);
      if (result.success) {
        setCurrentMode("ai");
        setReturnDialogOpen(false);
        toast.success("Returned to AI mode");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleSendMessage() {
    if (isWebsiteSendDisabled) {
      toast.error("Website session is inactive. Wait for the widget to reconnect.");
      return;
    }
    if (!messageText.trim()) return;
    setIsSending(true);
    try {
      const result = await sendHumanAgentMessage(sessionId, messageText);
      if (result.success) {
        setMessageText("");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <div className="border-t bg-background">
      {/* Mode bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          {currentMode === "ai" ? (
            <Badge className="bg-blue-100 text-blue-700 border-0">
              <Bot className="h-3 w-3 mr-1" />
              AI Mode
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700 border-0">
              <User className="h-3 w-3 mr-1" />
              Human Mode
            </Badge>
          )}
          {isWebsiteConnection ? (
            <Badge
              variant="outline"
              className={
                websiteSessionActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }
            >
              {websiteSessionActive ? "Widget Active" : "Widget Inactive"}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {currentMode === "ai" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTakeOver}
              disabled={isPending}
            >
              Take Over
            </Button>
          ) : (
            <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Return to AI
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Return to AI Mode</DialogTitle>
                  <DialogDescription>
                    The AI agent will resume handling this conversation.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3 py-2">
                  <Switch
                    id="exclude-history"
                    checked={excludeHistory}
                    onCheckedChange={setExcludeHistory}
                  />
                  <div>
                    <Label htmlFor="exclude-history" className="cursor-pointer">
                      Exclude human messages from AI history
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      If enabled, the AI will not see messages sent during human
                      takeover.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setReturnDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleReturnToAI} disabled={isPending}>
                    Return to AI
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Human message input */}
      {currentMode === "human" && (
        <div className="p-3">
          <div className="flex gap-2">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              className="min-h-15 max-h-37.5 resize-none"
              disabled={isSending || isWebsiteSendDisabled}
            />
            <Button
              onClick={handleSendMessage}
              disabled={
                isSending || isWebsiteSendDisabled || !messageText.trim()
              }
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {isWebsiteSendDisabled ? (
            <p className="mt-2 text-xs text-muted-foreground">
              User is offline. Wait for the website widget to reconnect before
              sending a message.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
