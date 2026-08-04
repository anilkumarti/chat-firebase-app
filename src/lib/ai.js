const MODEL = "llama-3.1-8b-instant";

export const fetchAIResponse = async (message, history = [], userId = null) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.error("VITE_GROQ_API_KEY is not set.");
    return "AI is currently unavailable.";
  }

  const messages = [
    { role: "system", content: "You are a helpful, friendly AI assistant." },
    ...history
      .filter((m) => m.text?.trim())
      .map((m) => ({
        role: userId && m.senderId === userId ? "user" : "assistant",
        content: m.text,
      })),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);
    return data.choices?.[0]?.message?.content?.trim() || "AI is currently unavailable.";
  } catch (err) {
    console.error("AI fetch error:", err);
    return "AI is currently unavailable.";
  }
};
