"use client";

import { useEffect, useEffectEvent, useTransition } from "react";
import { useRouter } from "next/navigation";

const CONVERSATIONS_REFRESH_INTERVAL_MS = 5_000;

export function ConversationsAutoRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const refreshConversations = useEffectEvent(() => {
    if (document.visibilityState !== "visible") {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshConversations();
    }, CONVERSATIONS_REFRESH_INTERVAL_MS);

    function handleWindowFocus() {
      refreshConversations();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshConversations();
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
