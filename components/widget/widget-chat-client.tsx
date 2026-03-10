"use client";

import { FormEvent, useState } from "react";

type Msg = { role: "user" | "ai"; content: string };

export function WidgetChatClient({
  connectionId,
  widgetKey,
  greeting,
  fontFamily,
  bubbleColor,
}: {
  connectionId: string;
  widgetKey: string;
  greeting: string;
  fontFamily: string;
  bubbleColor: string;
}) {
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", content: greeting }]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    const current = text;
    setText("");
    setMessages((prev) => [...prev, { role: "user", content: current }]);
    setLoading(true);

    const res = await fetch(`/api/widget/${connectionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: widgetKey, sessionId, message: current }),
    });

    if (!res.ok) {
      setMessages((prev) => [...prev, { role: "ai", content: "Sorry, I could not answer right now." }]);
      setLoading(false);
      return;
    }

    const data = (await res.json()) as { reply: string; sessionId: string };
    setSessionId(data.sessionId);
    setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    setLoading(false);
  }

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily }}>
      <div className="p-3 text-white font-semibold" style={{ background: bubbleColor }}>
        CX Agent
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
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
