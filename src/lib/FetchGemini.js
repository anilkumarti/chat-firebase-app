const MODEL = "gemini-1.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// history: array of stored message objects { senderId, text }
export const fetchGeminiResponse = async (message, history = []) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API key is missing.");
    return "Gemini AI is currently unavailable.";
  }

  // Build multi-turn contents from stored history, skipping image-only or empty messages
  const historyContents = history
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.senderId === "deepseek_ai" || m.senderId === "gemini_ai" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

  // Gemini requires alternating user/model turns — dedupe consecutive same-role entries
  const deduped = historyContents.reduce((acc, cur) => {
    if (acc.length && acc[acc.length - 1].role === cur.role) return acc;
    return [...acc, cur];
  }, []);

  const contents = [...deduped, { role: "user", parts: [{ text: message }] }];

  try {
    const response = await fetch(`${BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Gemini AI is currently unavailable."
    );
  } catch (error) {
    console.error("Gemini fetch error:", error);
    return "Gemini AI is currently unavailable.";
  }
};
