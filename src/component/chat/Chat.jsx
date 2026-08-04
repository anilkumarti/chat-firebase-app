import { useCallback, useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { fetchAIResponse } from "../../lib/FetchDeepseek";
import "./Chat.css";
import { supabase } from "../../lib/Supabase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/UserStore";
import { useCallStore } from "../../lib/callStore";
import { toast } from "react-toastify";
import upload from "../../lib/Upload";
import CameraModal from "./CameraModal";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const fmtCallDuration = (s) => {
  if (!s) return "";
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
};

const formatDateLabel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getDate() === db.getDate() && da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
};

const Chat = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [img, setImg] = useState({ file: null, url: "" });
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hoveredMsg, setHoveredMsg] = useState(null);

  const {
    chatId, user, isGroupChat, groupInfo,
    isCurrentUserBlocked, isRecieverBlocked, triggerChatListRefresh, toggleDetail, resetChat,
  } = useChatStore();
  const { currentUser } = useUserStore();
  const { setPendingCall, setSignalCh } = useCallStore();

  const endRef = useRef(null);
  const emojiRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const chatChannelRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!emojiRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!chatId) return;
    const isAI = chatId.startsWith("deepseek_ai_");

    // Stop any active recording when switching chats
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      const { data } = await supabase.from("chats").select("messages").eq("id", chatId).single();
      setMessages(data?.messages ?? []);
      setIsLoadingMessages(false);
    };
    fetchMessages();
    if (isAI) return;

    const channel = supabase
      .channel(`chat:${chatId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` },
        fetchMessages)
      .on("broadcast", { event: "new_message" }, fetchMessages)
      .subscribe();
    chatChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [chatId]);

  // UPDATE is permitted on any user's row; INSERT is only permitted on your own.
  // .update() on a missing row is a silent 0-row no-op, so verify via .select().
  const writeUserChats = async (userId, chats) => {
    const { data, error } = await supabase
      .from("user_chats")
      .update({ chats })
      .eq("user_id", userId)
      .select("user_id");
    if (error) {
      console.error("writeUserChats update:", userId, error.message);
      return;
    }
    if (data?.length) return;
    const { error: insertError } = await supabase
      .from("user_chats")
      .insert({ user_id: userId, chats });
    if (insertError) {
      console.error(
        `writeUserChats: no user_chats row for ${userId} and insert was rejected (${insertError.message}). ` +
        `Add an RLS policy allowing authenticated users to insert user_chats rows for others.`
      );
    }
  };

  const updateUserChats = useCallback(
    async (lastMessage) => {
      if (isGroupChat) {
        const memberIds = groupInfo?.member_ids ?? [];
        await Promise.all(
          memberIds.map(async (memberId) => {
            const { data: row } = await supabase.from("user_chats").select("*").eq("user_id", memberId).single();
            const updatedChats = (row?.chats ?? []).map((c) =>
              c.chatId === chatId
                ? { ...c, lastMessage, isSeen: memberId === currentUser.id, updatedAt: Date.now() }
                : c
            );
            await writeUserChats(memberId, updatedChats);
          })
        );
      } else {
        if (!user?.id) return;
        await Promise.all(
          [currentUser.id, user.id].map(async (id) => {
            const { data: row } = await supabase.from("user_chats").select("*").eq("user_id", id).single();
            const existing = (row?.chats ?? []).find((c) => c.chatId === chatId);
            let updatedChats;
            if (existing) {
              updatedChats = (row?.chats ?? []).map((c) =>
                c.chatId === chatId
                  ? { ...c, lastMessage, isSeen: id === currentUser.id, updatedAt: Date.now() }
                  : c
              );
            } else {
              updatedChats = [
                ...(row?.chats ?? []),
                {
                  chatId,
                  lastMessage,
                  receiverId: id === currentUser.id ? user.id : currentUser.id,
                  isSeen: id === currentUser.id,
                  updatedAt: Date.now(),
                },
              ];
            }
            await writeUserChats(id, updatedChats);
          })
        );
      }
      triggerChatListRefresh();

      // Broadcast to each receiver so their chat list updates in real time
      const receiverIds = isGroupChat
        ? (groupInfo?.member_ids ?? []).filter((id) => id !== currentUser.id)
        : user?.id ? [user.id] : [];
      receiverIds.forEach((userId) => {
        const bc = supabase.channel(`inbox:${userId}`);
        bc.subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          bc.send({ type: "broadcast", event: "chat_updated", payload: {} });
          setTimeout(() => supabase.removeChannel(bc), 2000);
        });
      });
    },
    [chatId, currentUser?.id, user?.id, isGroupChat, groupInfo, triggerChatListRefresh]
  );

  const broadcastNewMessage = () => {
    chatChannelRef.current?.send({ type: "broadcast", event: "new_message", payload: {} });
  };

  const handleEmoji = (e) => { setText((prev) => prev + e.emoji); setOpen(false); };

  const handleImg = (e) => {
    if (e.target.files[0]) {
      if (img.url) URL.revokeObjectURL(img.url);
      setImg({ file: e.target.files[0], url: URL.createObjectURL(e.target.files[0]) });
    }
  };

  const cancelImg = () => {
    if (img.url) URL.revokeObjectURL(img.url);
    setImg({ file: null, url: "" });
  };

  const handleCameraCapture = (file) => {
    if (img.url) URL.revokeObjectURL(img.url);
    setImg({ file, url: URL.createObjectURL(file) });
    setCameraOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMicToggle = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        setIsRecording(false);
        if (!chatId || chatId.startsWith("deepseek_ai_")) return;
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        try {
          const audioUrl = await upload(file);
          const { data: current } = await supabase.from("chats").select("messages").eq("id", chatId).single();
          const newMsg = {
            senderId: currentUser.id,
            senderName: currentUser.username,
            senderAvatar: currentUser.avatar,
            audio: audioUrl,
            createdAt: new Date().toISOString(),
          };
          const updated = [...(current?.messages ?? []), newMsg];
          const { error } = await supabase.from("chats").update({ messages: updated }).eq("id", chatId);
          if (!error) { setMessages(updated); await updateUserChats("🎤 Voice message"); broadcastNewMessage(); }
        } catch { toast.error("Failed to send voice message"); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };

  const initiateCall = async (callType) => {
    if (!user?.id || chatId?.startsWith("deepseek_ai_")) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      const remoteStream = new MediaStream();
      const peer = new RTCPeerConnection(ICE);
      localStream.getTracks().forEach((t) => peer.addTrack(t, localStream));
      peer.ontrack = (e) => e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));

      const ch = supabase.channel(`calls:${user.id}`, { config: { broadcast: { ack: false } } });
      const iceCandidateQueue = [];
      let chReady = false;

      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        const payload = { type: "ice-candidate", from: currentUser.id, candidate: e.candidate.toJSON() };
        chReady ? ch.send({ type: "broadcast", event: "signal", payload }) : iceCandidateQueue.push(payload);
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        chReady = true;
        await ch.send({ type: "broadcast", event: "signal", payload: { type: "offer", from: currentUser.id, fromUser: currentUser, callType, offer: { type: offer.type, sdp: offer.sdp }, chatId } });
        for (const p of iceCandidateQueue) ch.send({ type: "broadcast", event: "signal", payload: p });
        iceCandidateQueue.length = 0;
      });

      setSignalCh(ch);
      setPendingCall({ toUser: user, callType, peer, localStream, remoteStream, chatId });
    } catch (err) {
      console.error("initiateCall:", err);
      toast.error("Could not start call — check microphone/camera permissions");
    }
  };

  const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const toggleReaction = async (msgIndex, emoji) => {
    if (!chatId || chatId.startsWith("deepseek_ai_")) return;
    const updated = messages.map((msg, i) => {
      if (i !== msgIndex) return msg;
      const reactions = { ...(msg.reactions || {}) };
      const users = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUser.id);
      if (idx === -1) users.push(currentUser.id);
      else users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
      return { ...msg, reactions };
    });
    setMessages(updated);
    await supabase.from("chats").update({ messages: updated }).eq("id", chatId);
  };

  const handleSend = async () => {
    if (isSending) return;
    if (!text.trim() && !img.file) { toast.warning("Empty message"); return; }
    setIsSending(true);
    let imgUrl = null;
    try {
      if (img.file) imgUrl = await upload(img.file);
      const isAI = chatId.startsWith("deepseek_ai_");

      if (isAI) {
        const aiResponse = await fetchAIResponse(text);
        const { data: current } = await supabase.from("chats").select("messages").eq("id", chatId).single();
        const updated = [
          ...(current?.messages ?? []),
          { senderId: currentUser.id, text, createdAt: new Date().toISOString(), ...(imgUrl && { img: imgUrl }) },
          { senderId: "deepseek_ai", text: aiResponse, createdAt: new Date().toISOString() },
        ];
        const { error } = await supabase.from("chats").upsert({ id: chatId, messages: updated });
        if (error) throw error;
        setMessages(updated);
      } else {
        const { data: current } = await supabase.from("chats").select("messages").eq("id", chatId).single();
        const newMessage = {
          senderId: currentUser.id,
          senderName: currentUser.username,
          senderAvatar: currentUser.avatar,
          text,
          createdAt: new Date().toISOString(),
          ...(imgUrl && { img: imgUrl }),
        };
        const updated = [...(current?.messages ?? []), newMessage];
        const { error } = await supabase.from("chats").update({ messages: updated }).eq("id", chatId);
        if (error) throw error;
        setMessages(updated);
        await updateUserChats(text);
        broadcastNewMessage();
      }

      if (img.url) URL.revokeObjectURL(img.url);
      setImg({ file: null, url: "" });
      setText("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const fmtRecTime = () => {
    const m = Math.floor(recordingTime / 60).toString().padStart(2, "0");
    const s = (recordingTime % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isAIChat = chatId?.startsWith("deepseek_ai_");
  const inputDisabled = isCurrentUserBlocked || isRecieverBlocked;

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <button className="backBtn" onClick={resetChat} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          {isGroupChat ? (
            groupInfo?.avatar ? (
              <img src={groupInfo.avatar} alt="group" />
            ) : (
              <div className="groupHeaderAvatar">
                {groupInfo?.name?.charAt(0).toUpperCase() ?? "G"}
              </div>
            )
          ) : (
            <img src={user?.avatar || "./avatar.png"} alt="avatar" />
          )}
          <div className="texts">
            <span>{isGroupChat ? groupInfo?.name : user?.username}</span>
            {isGroupChat && (
              <p className="groupMembersHint">{groupInfo?.member_ids?.length} members</p>
            )}
          </div>
        </div>
        <div className="icons">
          {!isAIChat && !isGroupChat && (
            <>
              <img src="./phone.png" alt="Voice call" title="Voice call" onClick={() => initiateCall("audio")} />
              <img src="./video.png" alt="Video call" title="Video call" onClick={() => initiateCall("video")} />
            </>
          )}
          <img src="./info.png" alt="info" title="Info" onClick={toggleDetail} style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div className="center">
        {isLoadingMessages && (
          <div className="msgLoadingWrap">
            <span className="msgLoadingDot" /><span className="msgLoadingDot" /><span className="msgLoadingDot" />
          </div>
        )}
        {messages.map((message, index) => {
          const isOwn = message.senderId === currentUser?.id;
          const prevDate = messages[index - 1]?.createdAt;
          const showDateSep = !isSameDay(prevDate, message.createdAt);
          const msgKey = `${message.senderId ?? "ai"}_${message.createdAt ?? index}_${index}`;

          /* ── Call event bubble ────────────────── */
          if (message.type === "call_event") {
            const isVideo = message.callType === "video";
            const isMissed = message.status === "missed";
            const isDeclined = message.status === "declined";
            const isOutgoing = message.initiatorId === currentUser?.id;
            const statusIcon = isMissed || isDeclined ? "📵" : isVideo ? "📹" : "📞";
            const label = isOutgoing
              ? isMissed   ? "No answer"
              : isDeclined ? "Declined"
              :              `${isVideo ? "Video" : "Voice"} call`
              : isMissed   ? `Missed ${isVideo ? "video" : "voice"} call`
              : isDeclined ? "Declined call"
              :              `${isVideo ? "Video" : "Voice"} call`;
            return (
              <div key={msgKey} className="msgRow">
                {showDateSep && message.createdAt && (
                  <div className="dateSeparator"><span>{formatDateLabel(message.createdAt)}</span></div>
                )}
                <div className={`callEventMsg${isOutgoing ? " callEventOwn" : ""}${isMissed || isDeclined ? " callEventMissed" : ""}`}>
                  <span className="callEventIcon">{statusIcon}</span>
                  <div className="callEventBody">
                    <span className="callEventLabel">{label}</span>
                    {message.duration > 0 && (
                      <span className="callEventDuration">{fmtCallDuration(message.duration)}</span>
                    )}
                  </div>
                  <span className="callEventTime">{formatTime(message.createdAt)}</span>
                </div>
              </div>
            );
          }

          /* ── Regular message ──────────────────── */
          const reactionEntries = Object.entries(message.reactions || {});
          return (
            <div key={msgKey} className="msgRow">
              {showDateSep && message.createdAt && (
                <div className="dateSeparator"><span>{formatDateLabel(message.createdAt)}</span></div>
              )}
            <div
              className={isOwn ? "message own" : "message"}
              onMouseEnter={() => setHoveredMsg(index)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              {isGroupChat && !isOwn && (
                <img
                  src={message.senderAvatar || "./avatar.png"}
                  alt=""
                  className="msgSenderAvatar"
                />
              )}
              <div className="texts">
                {isGroupChat && !isOwn && (
                  <span className="senderName">{message.senderName}</span>
                )}
                {message.img && <img src={message.img} alt="attachment" />}
                {message.audio && <audio controls src={message.audio} className="voiceMessage" />}
                {message.text ? (
                  <p>{message.text}<span className="msgTime">{formatTime(message.createdAt)}</span></p>
                ) : (
                  <span className="msgTime">{formatTime(message.createdAt)}</span>
                )}
                {reactionEntries.length > 0 && (
                  <div className="reactionPills">
                    {reactionEntries.map(([emoji, users]) => (
                      <button
                        key={emoji}
                        className={`reactionPill${users.includes(currentUser?.id) ? " reactionPillOwn" : ""}`}
                        onClick={() => toggleReaction(index, emoji)}
                        title={`${users.length} reaction${users.length !== 1 ? "s" : ""}`}
                      >
                        {emoji} {users.length > 1 && <span>{users.length}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hoveredMsg === index && !isCurrentUserBlocked && !isRecieverBlocked && (
                <div className={`emojiBar${isOwn ? " emojiBarOwn" : ""}`}>
                  {REACTIONS.map((e) => (
                    <button key={e} className="emojiBarBtn" onClick={() => toggleReaction(index, e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
          );
        })}
        {img.url && (
          <div className="msgRow">
            <div className="message own">
              <div className="texts">
                <div className="imgPreviewWrap">
                  <img src={img.url} alt="preview" />
                  <button className="cancelImgBtn" onClick={cancelImg} title="Remove image">✕</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="bottom">
        <div className="icons">
          <label htmlFor="file" className={isAIChat ? "iconDisabled" : ""} title="Attach image">
            <img src="./img.png" alt="image" />
          </label>
          <input type="file" id="file" style={{ display: "none" }} onChange={isAIChat ? undefined : handleImg} accept="image/*" disabled={isAIChat} />
          <img src="./camera.png" alt="camera" title="Take photo"
            onClick={() => !isAIChat && setCameraOpen(true)}
            className={isAIChat ? "iconDisabled" : ""} />
          <img src="./mic.png" alt="mic" title={isRecording ? "Stop recording" : "Voice message"}
            onClick={() => !isAIChat && handleMicToggle()}
            className={`${isRecording ? "micActive" : ""} ${isAIChat ? "iconDisabled" : ""}`} />
        </div>

        {isRecording ? (
          <div className="recordingBar">
            <span className="recDot" />
            <span className="recTime">{fmtRecTime()}</span>
            <span className="recLabel">Tap mic to send</span>
          </div>
        ) : (
          <input
            type="text"
            placeholder={inputDisabled ? "You cannot send a message" : "Type a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={inputDisabled}
          />
        )}

        <div className="emoji" ref={emojiRef}>
          <img src="./emoji.png" alt="emoji" onClick={() => setOpen((prev) => !prev)} />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button className="sendButton" onClick={handleSend} disabled={inputDisabled || isRecording || isSending} title="Send">
          {isSending ? <span className="sendSpinner" /> : "➤"}
        </button>
      </div>

      {cameraOpen && <CameraModal onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}
    </div>
  );
};

export default Chat;
