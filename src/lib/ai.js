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

export const summarizeConversation = async (messages, userId) => {
  const textMsgs = messages.filter((m) => m.text?.trim()).slice(-30);
  if (textMsgs.length < 3) return "Not enough messages to summarize.";
  const convo = textMsgs.map((m) => `${m.senderId === userId ? "Me" : "Them"}: ${m.text}`).join("\n");
  const prompt = `Summarize this chat conversation in 3–5 concise bullet points. Cover what was discussed, any decisions, and key info shared. Use plain bullet points (no markdown headers).\n\nConversation:\n${convo}`;
  try {
    const data = await groqFetch([{ role: "user", content: prompt }], 0.4);
    return data.choices?.[0]?.message?.content?.trim() || "Could not generate summary.";
  } catch (err) {
    console.error("summarizeConversation:", err);
    return "Could not generate summary.";
  }
};

export const rewriteMessage = async (text, tone) => {
  const instructions = {
    casual:     "Rewrite this message in a casual, relaxed tone — like texting a friend.",
    formal:     "Rewrite this message in a professional, formal tone.",
    friendlier: "Rewrite this message in a warm, friendly, and more positive tone.",
    shorter:    "Make this message more concise — same meaning, fewer words.",
  };
  const prompt = `${instructions[tone] || "Rewrite this message."}\nReturn ONLY the rewritten message, nothing else.\n\nOriginal: ${text}`;
  try {
    const data = await groqFetch([{ role: "user", content: prompt }], 0.7);
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error("rewriteMessage:", err);
    return text;
  }
};

export const transcribeAudio = async (audioUrl) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return "";
  try {
    const audioRes = await fetch(audioUrl);
    const blob = await audioRes.blob();
    const file = new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-large-v3-turbo");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message);
    return data.text?.trim() || "";
  } catch (err) {
    console.error("transcribeAudio:", err);
    return "";
  }
};

export const translateMessage = async (text) => {
  const prompt = `Detect the language of the following message and translate it to English. If it is already in English, return it unchanged. Return ONLY the translated text, nothing else.\n\n${text}`;
  try {
    const data = await groqFetch([{ role: "user", content: prompt }], 0.3);
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    console.error("translateMessage:", err);
    return text;
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
