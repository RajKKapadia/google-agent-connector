"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  direction: "incoming" | "outgoing";
  senderType: "user" | "ai" | "human_agent";
  content: string;
  timestamp: string | Date;
  isHumanAgentMessage: boolean;
}

interface SSEEvent {
  type: "message";
  message: Message;
}

interface ChatViewProps {
  sessionId: string;
  initialMessages: Message[];
  mode: "ai" | "human";
}

const senderLabels: Record<string, string> = {
  user: "User",
  ai: "AI Agent",
  human_agent: "Agent",
};

const senderColors: Record<string, string> = {
  user: "bg-muted text-muted-foreground",
  ai: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  human_agent:
    "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
};

export function ChatView({
  sessionId,
  initialMessages,
  mode,
}: ChatViewProps) {
  const [msgs, setMsgs] = useState<Message[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/events`);

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (data.type === "message" && data.message) {
          setMsgs((prev) => {
            // Deduplicate by id
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch {
        // Ignore parse errors (e.g. heartbeat comments won't reach here)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error
    };

    return () => es.close();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
      {msgs.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-8">
          No messages yet. Waiting for the user to send a message on WhatsApp.
        </div>
      )}
      {msgs.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex flex-col max-w-[85%] sm:max-w-[75%] rounded-lg px-4 py-2 shadow-sm",
            msg.direction === "incoming" ? "self-start" : "self-end",
            senderColors[msg.senderType]
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">
              {senderLabels[msg.senderType]}
            </span>
            {msg.senderType === "ai" && mode === "human" && (
              <Badge variant="outline" className="text-xs py-0 h-4">
                AI (paused)
              </Badge>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap wrap-break-words">{msg.content}</p>
          <span className="text-xs text-muted-foreground mt-1 self-end">
            {format(new Date(msg.timestamp), "HH:mm")}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
