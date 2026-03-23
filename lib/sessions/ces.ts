const CES_CONTEXT_CHAR_LIMIT = 4000;

export function buildCesInput(
  messageText: string,
  pendingCesContext?: string | null
) {
  if (!pendingCesContext) {
    return messageText;
  }

  return [
    "Conversation context from the recent human takeover:",
    pendingCesContext,
    "",
    `Latest user message: ${messageText}`,
  ].join("\n");
}

export function buildPendingCesContext(
  history: Array<{ senderType: "user" | "human_agent"; content: string }>
) {
  if (history.length === 0) {
    return null;
  }

  const transcript = history
    .map((message) => {
      const label = message.senderType === "human_agent" ? "Human agent" : "User";
      return `${label}: ${message.content.trim()}`;
    })
    .join("\n");

  if (transcript.length <= CES_CONTEXT_CHAR_LIMIT) {
    return transcript;
  }

  return transcript.slice(transcript.length - CES_CONTEXT_CHAR_LIMIT);
}
