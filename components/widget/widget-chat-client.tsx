"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type SessionMode = "ai" | "human";

type WidgetMessage = {
  id: string;
  direction: "incoming" | "outgoing";
  senderType: "user" | "ai" | "human_agent";
  content: string;
  timestamp: string;
  isHumanAgentMessage: boolean;
};

type WidgetSendResponse = {
  sessionId: string;
  mode: SessionMode;
  messages: WidgetMessage[];
};

type WidgetRealtimeEvent =
  | {
      type: "message";
      message: WidgetMessage;
    }
  | {
      type: "mode";
      mode: SessionMode;
    };

type PersistedWidgetState = {
  sessionId: string;
  mode: SessionMode;
  messages: WidgetMessage[];
};

async function requestWidgetReply({
  connectionId,
  widgetKey,
  widgetToken,
  sessionId,
  message,
}: {
  connectionId: string;
  widgetKey: string;
  widgetToken: string;
  sessionId?: string;
  message: string;
}) {
  const res = await fetch(`/api/widget/${connectionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: widgetKey,
      token: widgetToken,
      sessionId,
      message,
    }),
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as WidgetSendResponse;
}

function getStorageKey(connectionId: string) {
  return `ces-widget:${connectionId}`;
}

function isValidMode(value: unknown): value is SessionMode {
  return value === "ai" || value === "human";
}

function isValidMessage(value: unknown): value is WidgetMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    ("id" in value && typeof value.id === "string") &&
    ("direction" in value &&
      (value.direction === "incoming" || value.direction === "outgoing")) &&
    ("senderType" in value &&
      (value.senderType === "user" ||
        value.senderType === "ai" ||
        value.senderType === "human_agent")) &&
    ("content" in value && typeof value.content === "string") &&
    ("timestamp" in value && typeof value.timestamp === "string") &&
    ("isHumanAgentMessage" in value &&
      typeof value.isHumanAgentMessage === "boolean")
  );
}

function loadPersistedWidgetState(connectionId: string): PersistedWidgetState | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey(connectionId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      sessionId?: unknown;
      mode?: unknown;
      messages?: unknown;
    };

    if (
      typeof parsed.sessionId !== "string" ||
      !isValidMode(parsed.mode) ||
      !Array.isArray(parsed.messages) ||
      !parsed.messages.every(isValidMessage)
    ) {
      window.localStorage.removeItem(getStorageKey(connectionId));
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      mode: parsed.mode,
      messages: parsed.messages,
    };
  } catch {
    window.localStorage.removeItem(getStorageKey(connectionId));
    return null;
  }
}

function sortMessages(messages: WidgetMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function mergeMessages(
  currentMessages: WidgetMessage[],
  nextMessages: WidgetMessage[],
  options?: { includeUserMessages?: boolean }
) {
  const includeUserMessages = options?.includeUserMessages ?? true;
  const merged = new Map(currentMessages.map((message) => [message.id, message]));

  for (const message of nextMessages) {
    if (!includeUserMessages && message.senderType === "user") {
      continue;
    }

    merged.set(message.id, message);
  }

  return sortMessages(Array.from(merged.values()));
}

function createLocalMessage(
  senderType: WidgetMessage["senderType"],
  content: string
): WidgetMessage {
  return {
    id: `local:${globalThis.crypto.randomUUID()}`,
    direction: senderType === "user" ? "incoming" : "outgoing",
    senderType,
    content,
    timestamp: new Date().toISOString(),
    isHumanAgentMessage: senderType === "human_agent",
  };
}

function resolveParentOrigin(parentOrigin: string | null) {
  if (parentOrigin) return parentOrigin;

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

export function WidgetChatClient({
  connectionId,
  widgetKey,
  widgetToken,
  widgetTitle,
  parentOrigin,
  fontFamily,
  bubbleColor,
}: {
  connectionId: string;
  widgetKey: string;
  widgetToken: string;
  widgetTitle: string;
  parentOrigin: string | null;
  fontFamily: string;
  bubbleColor: string;
}) {
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [mode, setMode] = useState<SessionMode>("ai");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const didBootstrap = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(
    message: string,
    options?: { includeUserMessage?: boolean }
  ) {
    if (!message.trim() || loading) return;

    const includeUserMessage = options?.includeUserMessage ?? true;

    setLoading(true);
    const data = await requestWidgetReply({
      connectionId,
      widgetKey,
      widgetToken,
      sessionId,
      message,
    });

    if (!data) {
      setMessages((prev) =>
        mergeMessages(prev, [
          ...(includeUserMessage ? [createLocalMessage("user", message)] : []),
          createLocalMessage("ai", "Sorry, I could not answer right now."),
        ])
      );
      setLoading(false);
      return;
    }

    setSessionId(data.sessionId);
    setMode(data.mode);
    setMessages((prev) =>
      mergeMessages(prev, data.messages, { includeUserMessages: includeUserMessage })
    );
    setLoading(false);
  }

  useEffect(() => {
    didBootstrap.current = false;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;

      const persisted = loadPersistedWidgetState(connectionId);
      if (persisted) {
        setSessionId(persisted.sessionId);
        setMode(persisted.mode);
        setMessages(persisted.messages);
      }
      setHasHydrated(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [connectionId]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!sessionId || messages.length === 0) {
      window.localStorage.removeItem(getStorageKey(connectionId));
      return;
    }

    window.localStorage.setItem(
      getStorageKey(connectionId),
      JSON.stringify({ sessionId, mode, messages })
    );
  }, [connectionId, hasHydrated, messages, mode, sessionId]);

  useEffect(() => {
    if (!hasHydrated || !sessionId) return;

    const searchParams = new URLSearchParams({
      key: widgetKey,
      token: widgetToken,
      sessionId,
    });

    const es = new EventSource(
      `/api/widget/${connectionId}/events?${searchParams.toString()}`
    );

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WidgetRealtimeEvent;

        if (data.type === "message") {
          setMessages((prev) => mergeMessages(prev, [data.message]));
          return;
        }

        if (data.type === "mode") {
          setMode(data.mode);
        }
      } catch {
        // Ignore invalid events.
      }
    };

    return () => es.close();
  }, [connectionId, hasHydrated, sessionId, widgetKey, widgetToken]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (didBootstrap.current) return;
    if (messages.length > 0 || sessionId) return;

    didBootstrap.current = true;
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      if (cancelled) return;

      setLoading(true);
      const data = await requestWidgetReply({
        connectionId,
        widgetKey,
        widgetToken,
        message: "hi",
      });

      if (cancelled) return;

      if (!data) {
        setMessages([
          createLocalMessage("ai", "Sorry, I could not answer right now."),
        ]);
        setLoading(false);
        return;
      }

      setSessionId(data.sessionId);
      setMode(data.mode);
      setMessages(
        mergeMessages([], data.messages, { includeUserMessages: false })
      );
      setLoading(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [connectionId, hasHydrated, messages.length, sessionId, widgetKey, widgetToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages, mode]);

  function closeWidget() {
    const targetOrigin = resolveParentOrigin(parentOrigin);
    if (!targetOrigin) return;

    window.parent.postMessage(
      { type: "ces-widget-close", connectionId },
      targetOrigin
    );
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const current = text.trim();
    if (!current || loading) return;

    setText("");
    await sendMessage(current);
  }

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily }}>
      <div
        className="flex items-center justify-between p-3 text-white"
        style={{ background: bubbleColor }}
      >
        <div className="font-semibold">{widgetTitle}</div>
        <button
          type="button"
          onClick={closeWidget}
          className="rounded-md p-1 transition-colors hover:bg-white/15"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {mode === "human" ? (
        <div className="border-b bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          A human agent has joined the chat.
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {loading && messages.length === 0 ? (
          <div className="text-left">
            <span className="inline-block rounded-xl border bg-white px-3 py-2 text-sm">
              ...
            </span>
          </div>
        ) : null}
        {messages.map((message) => {
          const isUser = message.senderType === "user";
          const isHumanAgent = message.senderType === "human_agent";

          return (
          <div
            key={message.id}
            className={isUser ? "text-right" : "text-left"}
          >
            {!isUser ? (
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                {isHumanAgent ? "Agent" : "AI"}
              </div>
            ) : null}
            <span
              className={
                isUser
                  ? "inline-block rounded-xl px-3 py-2 text-sm text-white"
                  : isHumanAgent
                    ? "inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                    : "inline-block rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
              }
              style={isUser ? { background: bubbleColor } : undefined}
            >
              {message.content}
            </span>
          </div>
          );
        })}
        {loading && messages.length > 0 ? (
          <div className="text-left">
            <span className="inline-block rounded-xl border bg-white px-3 py-2 text-sm">
              ...
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "human" ? "Message the agent..." : "Ask a question..."}
        />
        <button
          className="text-white rounded-md px-3 py-2 text-sm"
          style={{ background: bubbleColor }}
          disabled={loading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
