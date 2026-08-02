import { supabase } from "./Supabase";

/** Save a call event (ended / missed / declined) into the chat's messages array. */
export const saveCallEvent = async (chatId, { callType, status, duration, initiatorId }) => {
  if (!chatId || chatId.startsWith("deepseek_ai_")) return;
  try {
    const { data } = await supabase.from("chats").select("messages").eq("id", chatId).single();
    const event = {
      type: "call_event",
      callType,          // "audio" | "video"
      status,            // "ended" | "missed" | "declined"
      duration: duration || 0,
      initiatorId,
      createdAt: new Date().toISOString(),
    };
    const updated = [...(data?.messages ?? []), event];
    await supabase.from("chats").update({ messages: updated }).eq("id", chatId);
  } catch (e) {
    console.error("saveCallEvent:", e);
  }
};
