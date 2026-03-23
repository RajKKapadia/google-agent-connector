import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { getWidgetEmbedSource, isAllowedWidgetSite } from "@/lib/widget/security";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const key = req.nextUrl.searchParams.get("key");

  const channel = await db.query.channels.findFirst({
    where: and(eq(channels.id, connectionId), eq(channels.isActive, true)),
  });

  if (!channel || channel.type !== "website" || !key || key !== channel.widgetKey) {
    return new Response("console.error('Invalid widget config');", {
      headers: { "content-type": "application/javascript" },
    });
  }

  if (!isAllowedWidgetSite(getWidgetEmbedSource(req.headers), channel.websiteDomain)) {
    return new Response("console.error('Widget is not allowed on this site');", {
      headers: { "content-type": "application/javascript" },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const appOrigin = new URL(appUrl).origin;

  const js = `(function(){
  const iframeUrlBase = ${JSON.stringify(`${appUrl}/widget/${connectionId}?key=${key}`)};
  const closeMessageType = 'ces-widget-close';
  const btn = document.createElement('button');
  btn.innerText = 'Chat';
  btn.style.position = 'fixed';
  btn.style.right = '24px';
  btn.style.bottom = '24px';
  btn.style.width = '56px';
  btn.style.height = '56px';
  btn.style.borderRadius = '9999px';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  btn.style.color = '#fff';
  btn.style.fontWeight = '600';
  btn.style.zIndex = '2147483646';
  btn.style.background = ${JSON.stringify(channel.widgetBubbleColor || '#2563eb')};

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '24px';
  frame.style.bottom = '92px';
  frame.style.width = '360px';
  frame.style.maxWidth = 'calc(100vw - 32px)';
  frame.style.height = '540px';
  frame.style.maxHeight = 'calc(100vh - 120px)';
  frame.style.border = '1px solid #e5e7eb';
  frame.style.borderRadius = '16px';
  frame.style.boxShadow = '0 20px 50px rgba(0,0,0,0.18)';
  frame.style.display = 'none';
  frame.style.zIndex = '2147483646';
  let hasLoadedFrame = false;

  window.addEventListener('message', function(event){
    if (event.origin !== ${JSON.stringify(appOrigin)}) return;
    if (!event.data || event.data.type !== closeMessageType) return;
    if (event.data.connectionId !== ${JSON.stringify(connectionId)}) return;
    frame.style.display = 'none';
  });

  btn.onclick = function(){
    const shouldOpen = frame.style.display === 'none';

    if (shouldOpen && !hasLoadedFrame) {
      const iframeUrl = new URL(iframeUrlBase);
      iframeUrl.searchParams.set('origin', window.location.origin);
      frame.src = iframeUrl.toString();
      hasLoadedFrame = true;
    }

    frame.style.display = shouldOpen ? 'block' : 'none';
  };

  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();`;

  return new Response(js, {
    headers: { "content-type": "application/javascript" },
  });
}
