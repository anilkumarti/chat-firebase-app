


export const fetchAIResponse = async (message) => {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY; 
    if (!apiKey) {
        console.error("DeepSeek API key is missing.");
        return "DeepSeek AI is currently unavailable.";
      }
    
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: message }],
        }),
      });
  
      const data = await response.json();
      return data.choices[0]?.message?.content || "DeepSeek AI is currently unavailable.";
    } catch (error) {
      console.error("Error fetching AI response:", error);
      return "DeepSeek AI is currently unavailable.";
    }
  };
  