import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { getWidgetEmbedSource, isAllowedWidgetSite } from "@/lib/widget/security";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params;
  const key = req.nextUrl.searchParams.get("key");

  const connection = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), eq(connections.isActive, true)),
  });

  if (!connection || connection.type !== "website" || !key || key !== connection.widgetKey) {
    return new Response("console.error('Invalid widget config');", {
      headers: { "content-type": "application/javascript" },
    });
  }

  if (
    !isAllowedWidgetSite(
      getWidgetEmbedSource(req.headers),
      connection.websiteDomain
    )
  ) {
    return new Response("console.error('Widget is not allowed on this site');", {
      headers: { "content-type": "application/javascript" },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const js = `(function(){
  const iframeUrl = ${JSON.stringify(`${appUrl}/widget/${connectionId}?key=${key}`)};
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
  btn.style.background = ${JSON.stringify(connection.widgetBubbleColor || '#2563eb')};

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

  btn.onclick = function(){
    const shouldOpen = frame.style.display === 'none';

    if (shouldOpen && !hasLoadedFrame) {
      frame.src = iframeUrl;
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
