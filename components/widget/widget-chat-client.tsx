"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "ai"; content: string };

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

export function WidgetChatClient({
  connectionId,
  widgetKey,
  widgetToken,
  fontFamily,
  bubbleColor,
}: {
  connectionId: string;
  widgetKey: string;
  widgetToken: string;
  fontFamily: string;
  bubbleColor: string;
}) {
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
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
    if (didBootstrap.current) return;

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
  }, [connectionId, widgetKey, widgetToken]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const current = text.trim();
    if (!current || loading) return;

    setText("");
    await sendMessage(current);
  }

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily }}>
      <div className="p-3 text-white font-semibold" style={{ background: bubbleColor }}>
        CX Agent
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
