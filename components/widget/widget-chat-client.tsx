"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Msg = { role: "user" | "ai"; content: string };
type PersistedWidgetState = { sessionId: string; messages: Msg[] };

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

  return (await res.json()) as { reply: string; sessionId: string };
}

function getStorageKey(connectionId: string) {
  return `ces-widget:${connectionId}`;
}

function isValidMessage(value: unknown): value is Msg {
  return (
    typeof value === "object" &&
    value !== null &&
    ("role" in value && (value.role === "user" || value.role === "ai")) &&
    ("content" in value && typeof value.content === "string")
  );
}

function loadPersistedWidgetState(connectionId: string): PersistedWidgetState | null {
  try {
    const raw = window.localStorage.getItem(getStorageKey(connectionId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      sessionId?: unknown;
      messages?: unknown;
    };

    if (
      typeof parsed.sessionId !== "string" ||
      !Array.isArray(parsed.messages) ||
      !parsed.messages.every(isValidMessage)
    ) {
      window.localStorage.removeItem(getStorageKey(connectionId));
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      messages: parsed.messages,
    };
  } catch {
    window.localStorage.removeItem(getStorageKey(connectionId));
    return null;
  }
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
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const didBootstrap = useRef(false);

  async function sendMessage(
    message: string,
    options?: { includeUserMessage?: boolean }
  ) {
    if (!message.trim() || loading) return;

    const includeUserMessage = options?.includeUserMessage ?? true;

    if (includeUserMessage) {
      setMessages((prev) => [...prev, { role: "user", content: message }]);
    }

    setLoading(true);
    const data = await requestWidgetReply({
      connectionId,
      widgetKey,
      widgetToken,
      sessionId,
      message,
    });

    if (!data) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Sorry, I could not answer right now." },
      ]);
      setLoading(false);
      return;
    }

    setSessionId(data.sessionId);
    setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;

      const persisted = loadPersistedWidgetState(connectionId);
      if (persisted) {
        setSessionId(persisted.sessionId);
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
      JSON.stringify({ sessionId, messages })
    );
  }, [connectionId, hasHydrated, messages, sessionId]);

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
          { role: "ai", content: "Sorry, I could not answer right now." },
        ]);
        setLoading(false);
        return;
      }

      setSessionId(data.sessionId);
      setMessages([{ role: "ai", content: data.reply }]);
      setLoading(false);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [connectionId, hasHydrated, messages.length, sessionId, widgetKey, widgetToken]);

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
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {loading && messages.length === 0 ? (
          <div className="text-left">
            <span className="inline-block rounded-xl border bg-white px-3 py-2 text-sm">
              ...
            </span>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={m.role === "user" ? "inline-block rounded-xl px-3 py-2 text-sm bg-slate-900 text-white" : "inline-block rounded-xl px-3 py-2 text-sm bg-white border"}>
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input className="flex-1 border rounded-md px-3 py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question..." />
        <button className="text-white rounded-md px-3 py-2 text-sm" style={{ background: bubbleColor }} disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
