const MODEL = "llama-3.1-8b-instant";

const groqFetch = (messages, temperature = 0.7) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return Promise.reject(new Error("VITE_GROQ_API_KEY not set"));
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, temperature }),
  }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error?.message); return d; }));
};

export const fetchAIResponse = async (message, history = [], userId = null) => {
  const msgs = [
    { role: "system", content: "You are a helpful, friendly AI assistant." },
    ...history
      .filter((m) => m.text?.trim())
      .map((m) => ({ role: userId && m.senderId === userId ? "user" : "assistant", content: m.text })),
    { role: "user", content: message },
  ];
  try {
    const data = await groqFetch(msgs);
    return data.choices?.[0]?.message?.content?.trim() || "AI is currently unavailable.";
  } catch (err) {
    console.error("AI fetch error:", err);
    return "AI is currently unavailable.";
  }
};

export const fetchReplySuggestions = async (messages, userId) => {
  const textMsgs = messages.filter((m) => m.text?.trim());
  const recent = textMsgs.slice(-12);
  if (!recent.length) return [];

  const lastMsg = recent[recent.length - 1];
  const lastIsOther = lastMsg.senderId !== userId;

  const convo = recent
    .map((m) => `${m.senderId === userId ? "Me" : "Them"}: ${m.text}`)
    .join("\n");

  const prompt = lastIsOther
    ? `You are helping someone reply in a chat. The other person just said:\n"${lastMsg.text}"\n\nFull conversation for context:\n${convo}\n\nWrite exactly 3 short, natural replies for "Me" that directly respond to what they said. Max 15 words each, varied in tone. Return ONLY a JSON array, no explanation:\n["reply1","reply2","reply3"]`
    : `You are helping someone continue a chat conversation. "Me" sent the last message.\n\nConversation:\n${convo}\n\nBased on what this conversation is about, write exactly 3 short, natural follow-up messages "Me" could send next. Max 15 words each, varied in tone. Return ONLY a JSON array, no explanation:\n["reply1","reply2","reply3"]`;

  try {
    const data = await groqFetch([{ role: "user", content: prompt }], 0.85);
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    const match = raw.match(/\[[\s\S]*?\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 3) : [];
  } catch (err) {
    console.error("fetchReplySuggestions:", err);
    return [];
  }
};
