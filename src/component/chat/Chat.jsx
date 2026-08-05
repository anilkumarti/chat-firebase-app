import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { fetchAIResponse, fetchReplySuggestions, summarizeConversation, rewriteMessage, transcribeAudio, translateMessage } from "../../lib/ai";
import "./Chat.css";
import { supabase } from "../../lib/Supabase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/UserStore";
import { useCallStore } from "../../lib/callStore";
import { toast } from "react-toastify";
import upload from "../../lib/Upload";
import CameraModal from "./CameraModal";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/* ── Seeded waveform bars (deterministic from key) ─────────── */
const seededBars = (key, count = 30) => {
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) & 0xffff;
  return Array.from({ length: count }, () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return 18 + (seed % 58);
  });
};

/* ── Custom voice message player ───────────────────────────── */
const VoicePlayer = ({ src, msgKey, isOwn }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const bars = useMemo(() => seededBars(msgKey || src, 30), [msgKey, src]);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => { setPlaying(false); setCurrentTime(0); };
    return () => { audio.pause(); audio.src = ""; };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * duration;
  };

  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={`voicePlayer${isOwn ? " voicePlayerOwn" : ""}`}>
      <button className="vpPlay" onClick={toggle}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
      </button>
      <div className="vpBody">
        <div className="vpWave" onClick={seek}>
          {bars.map((h, i) => (
            <div
              key={i}
              className="vpBar"
              style={{
                height: `${playing ? h : Math.max(18, h * 0.6)}%`,
                background: i / bars.length <= progress
                  ? (isOwn ? "rgba(255,255,255,0.9)" : "var(--accent)")
                  : (isOwn ? "rgba(255,255,255,0.35)" : "rgba(124,106,245,0.3)"),
              }}
            />
          ))}
        </div>
        <span className="vpTime">{fmtT(playing ? currentTime : duration)}</span>
      </div>
    </div>
  );
};

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
  const [isLocked, setIsLocked] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingSugg, setIsFetchingSugg] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [transcripts, setTranscripts] = useState({});
  const [translations, setTranslations] = useState({});

  const {
    chatId, user, isGroupChat, groupInfo,
    isCurrentUserBlocked, isRecieverBlocked, triggerChatListRefresh, toggleDetail, resetChat,
  } = useChatStore();
  const { currentUser } = useUserStore();
  const { setPendingCall, setSignalCh } = useCallStore();

  const endRef = useRef(null);
  const emojiRef = useRef(null);
  const suggPopupRef = useRef(null);
  const suggBtnRef = useRef(null);
  const toneMenuRef = useRef(null);
  const toneMenuBtnRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const chatChannelRef = useRef(null);
  const pointerStartRef = useRef(null);
  const cancelledRef = useRef(false);
  const lockedRef = useRef(false);
  const pendingStopRef = useRef(null); // { cancel } queued when stop fires before recorder is ready

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

  // Close suggestions popup on outside click
  useEffect(() => {
    if (!showSugg) return;
    const handler = (e) => {
      if (!suggPopupRef.current?.contains(e.target) && !suggBtnRef.current?.contains(e.target))
        setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSugg]);

  // Close tone menu on outside click
  useEffect(() => {
    if (!showToneMenu) return;
    const handler = (e) => {
      if (!toneMenuRef.current?.contains(e.target) && !toneMenuBtnRef.current?.contains(e.target))
        setShowToneMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showToneMenu]);

  // Reset all AI UI state when switching chats
  useEffect(() => {
    setShowSugg(false);
    setSuggestions([]);
    setShowSummary(false);
    setSummary("");
    setShowToneMenu(false);
    setTranscripts({});
    setTranslations({});
  }, [chatId]);

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
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (payload?.message) {
          setMessages((prev) => {
            const key = `${payload.message.senderId}_${payload.message.createdAt}`;
            if (prev.some((m) => `${m.senderId}_${m.createdAt}` === key)) return prev;
            return [...prev, payload.message];
          });
        } else {
          fetchMessages();
        }
      })
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
                ? {
                    ...c,
                    lastMessage,
                    updatedAt: Date.now(),
                    isSeen: memberId === currentUser.id,
                    unreadCount: memberId === currentUser.id ? 0 : (c.unreadCount ?? 0) + 1,
                  }
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
                  ? {
                      ...c,
                      lastMessage,
                      updatedAt: Date.now(),
                      isSeen: id === currentUser.id,
                      unreadCount: id === currentUser.id ? 0 : (c.unreadCount ?? 0) + 1,
                    }
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
                  unreadCount: id === currentUser.id ? 0 : 1,
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

  const broadcastNewMessage = (message) => {
    chatChannelRef.current?.send({ type: "broadcast", event: "new_message", payload: { message } });
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

  const startRecording = async () => {
    if (isRecording || isAIChat) return;
    cancelledRef.current = false;
    pendingStopRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        setIsRecording(false);
        setIsLocked(false);
        setSlideX(0);
        if (cancelledRef.current || !chatId || chatId.startsWith("deepseek_ai_")) return;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
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
          if (!error) { setMessages(updated); await updateUserChats("🎤 Voice message"); broadcastNewMessage(newMsg); }
        } catch (err) { toast.error(err?.message ? `Voice send failed: ${err.message}` : "Failed to send voice message"); }
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      // Drain any stop request that arrived while getUserMedia was pending
      if (pendingStopRef.current !== null) {
        const { cancel } = pendingStopRef.current;
        pendingStopRef.current = null;
        cancelledRef.current = cancel;
        recorder.stop();
      }
    } catch { toast.error("Microphone access denied"); }
  };

  const stopAndSend = (cancel = false) => {
    cancelledRef.current = cancel;
    lockedRef.current = false;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    } else {
      // Recorder not ready yet (getUserMedia still pending) — queue the stop
      pendingStopRef.current = { cancel };
    }
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

  const handleSuggestReplies = async () => {
    if (isFetchingSugg) return;
    setShowToneMenu(false);
    if (showSugg) { setShowSugg(false); return; }
    setShowSugg(true);
    setIsFetchingSugg(true);
    setSuggestions([]);
    const result = await fetchReplySuggestions(messages, currentUser.id);
    setSuggestions(result);
    setIsFetchingSugg(false);
  };

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setShowSummary(true);
    setSummary("");
    setIsSummarizing(true);
    const result = await summarizeConversation(messages, currentUser.id);
    setSummary(result);
    setIsSummarizing(false);
  };

  const handleToneMenuToggle = () => {
    if (isRewriting) return;
    setShowSugg(false);
    setShowToneMenu((v) => !v);
  };

  const handleRewrite = async (tone) => {
    if (!text.trim() || isRewriting) return;
    setShowToneMenu(false);
    setIsRewriting(true);
    const result = await rewriteMessage(text, tone);
    setText(result);
    setIsRewriting(false);
  };

  const handleTranscribe = async (stableKey, audioUrl) => {
    setTranscripts((prev) => ({ ...prev, [stableKey]: "__loading__" }));
    const result = await transcribeAudio(audioUrl);
    setTranscripts((prev) => ({ ...prev, [stableKey]: result || "Could not transcribe." }));
  };

  const handleTranslate = async (stableKey, msgText) => {
    setTranslations((prev) => ({ ...prev, [stableKey]: "__loading__" }));
    const result = await translateMessage(msgText);
    setTranslations((prev) => ({ ...prev, [stableKey]: result }));
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
        const { data: current } = await supabase.from("chats").select("messages").eq("id", chatId).single();
        const history = current?.messages ?? [];
        const aiResponse = await fetchAIResponse(text, history, currentUser.id);
        const updated = [
          ...history,
          { senderId: currentUser.id, text, createdAt: new Date().toISOString(), ...(imgUrl && { img: imgUrl }) },
          { senderId: "ai", text: aiResponse, createdAt: new Date().toISOString() },
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
        broadcastNewMessage(newMessage);
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
          {!isAIChat && messages.filter((m) => m.text).length >= 3 && (
            <button className="headerAiBtn" onClick={handleSummarize} disabled={isSummarizing} title="Summarize conversation">
              {isSummarizing ? <span className="suggestSpinner" /> : "📋"}
            </button>
          )}
          <img src="./info.png" alt="info" title="Info" onClick={toggleDetail} style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div className="center">
        {showSummary && (
          <div className="summaryPanel">
            <div className="summaryPanelHeader">
              <span>📋 Conversation Summary</span>
              <button className="summaryCloseBtn" onClick={() => { setShowSummary(false); setSummary(""); }}>✕</button>
            </div>
            {isSummarizing
              ? <div className="summaryLoading"><span className="suggestSpinner" /> Summarizing…</div>
              : <div className="summaryContent">{summary}</div>}
          </div>
        )}
        {isLoadingMessages && (
          <div className="msgSkeleton">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`skeletonMsg${i % 3 === 0 ? ' skeletonMsgOwn' : ''}`}>
                <div className="skeletonBubble skeleton" style={{ width: `${60 + (i * 17) % 40}%` }} />
              </div>
            ))}
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
          const stableKey = `${message.senderId ?? "ai"}_${message.createdAt ?? index}`;
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
                {message.audio && (
                  <>
                    <VoicePlayer src={message.audio} msgKey={stableKey} isOwn={isOwn} />
                    {(() => {
                      const tr = transcripts[stableKey];
                      if (tr === "__loading__") return <span className="transcribingText"><span className="suggestSpinner" /> Transcribing…</span>;
                      if (tr) return <p className="transcriptText">"{tr}"</p>;
                      return <button className="transcribeBtn" onClick={() => handleTranscribe(stableKey, message.audio)}>🔤 Transcribe</button>;
                    })()}
                  </>
                )}
                {message.text ? (
                  <>
                    <p>{message.text}<span className="msgTime">{formatTime(message.createdAt)}</span></p>
                    {!isOwn && !isAIChat && (() => {
                      const tl = translations[stableKey];
                      if (tl === "__loading__") return <span className="translatingText"><span className="suggestSpinner" /> Translating…</span>;
                      if (tl) return <p className="translatedText">{tl}</p>;
                      if (hoveredMsg === index) return <button className="translateBtn" onClick={() => handleTranslate(stableKey, message.text)}>🌐 Translate</button>;
                      return null;
                    })()}
                  </>
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
        {showSugg && !isAIChat && (
          <div className="suggestionsPopup" ref={suggPopupRef}>
            <div className="suggestionsHeader">
              <span>✨ Reply suggestions</span>
              <button className="suggClose" onClick={() => setShowSugg(false)}>✕</button>
            </div>
            {isFetchingSugg ? (
              <div className="suggestionsLoading">
                <span className="suggestSpinner" /> Generating…
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestionPill"
                  onClick={() => { setText(s); setShowSugg(false); }}
                >
                  {s}
                </button>
              ))
            ) : (
              <p className="suggestionsEmpty">Could not generate suggestions. Try again.</p>
            )}
          </div>
        )}
        <div className="icons">
          <label htmlFor="file" className={isAIChat ? "iconDisabled" : ""} title="Attach image">
            <img src="./img.png" alt="image" />
          </label>
          <input type="file" id="file" style={{ display: "none" }} onChange={isAIChat ? undefined : handleImg} accept="image/*" disabled={isAIChat} />
          <img src="./camera.png" alt="camera" title="Take photo"
            onClick={() => !isAIChat && setCameraOpen(true)}
            className={isAIChat ? "iconDisabled" : ""} />
          <button
            className={`micBtn${isRecording ? " micBtnActive" : ""}${isAIChat ? " iconDisabled" : ""}`}
            title="Hold to record"
            disabled={isAIChat}
            onPointerDown={(e) => {
              if (isAIChat) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              pointerStartRef.current = { x: e.clientX, y: e.clientY };
              lockedRef.current = false;
              setSlideX(0);
              startRecording();
            }}
            onPointerMove={(e) => {
              if (!isRecording || lockedRef.current) return;
              const dx = e.clientX - (pointerStartRef.current?.x ?? e.clientX);
              const dy = e.clientY - (pointerStartRef.current?.y ?? e.clientY);
              setSlideX(dx);
              if (dy < -40) { lockedRef.current = true; setIsLocked(true); }
            }}
            onPointerUp={(e) => {
              if (lockedRef.current) return;
              const dx = e.clientX - (pointerStartRef.current?.x ?? e.clientX);
              stopAndSend(dx < -60);
            }}
            onPointerCancel={() => { if (!lockedRef.current) stopAndSend(true); }}
          >
            <img src="./mic.png" alt="mic" />
          </button>
          {!isAIChat && !inputDisabled && (
            <button
              ref={suggBtnRef}
              className={`aiReplyBtn${showSugg ? " aiReplyBtnActive" : ""}`}
              onClick={handleSuggestReplies}
              disabled={isFetchingSugg}
              title="AI reply suggestions"
            >
              {isFetchingSugg ? <span className="suggestSpinner" /> : "✨"}
            </button>
          )}
          {!isAIChat && !inputDisabled && text.trim() && (
            <button
              ref={toneMenuBtnRef}
              className={`aiReplyBtn${showToneMenu ? " aiReplyBtnActive" : ""}`}
              onClick={handleToneMenuToggle}
              disabled={isRewriting}
              title="Rewrite tone"
            >
              {isRewriting ? <span className="suggestSpinner" /> : "✏️"}
            </button>
          )}
          {showToneMenu && (
            <div ref={toneMenuRef} className="toneMenu">
              <div className="toneMenuHeader">Rewrite as…</div>
              {["casual", "formal", "friendlier", "shorter"].map((tone) => (
                <button key={tone} className="tonePill" onClick={() => handleRewrite(tone)}>
                  {tone === "casual" ? "😎 Casual" : tone === "formal" ? "👔 Formal" : tone === "friendlier" ? "😊 Friendlier" : "✂️ Shorter"}
                </button>
              ))}
            </div>
          )}
        </div>

        {isRecording ? (
          isLocked ? (
            <div className="recordingBar recordingLocked">
              <button className="recCancelBtn" onClick={() => stopAndSend(true)} title="Cancel">✕</button>
              <span className="recDot" />
              <span className="recTime">{fmtRecTime()}</span>
              <div className="recWave">
                {Array.from({ length: 20 }, (_, i) => <div key={i} className="recBar" />)}
              </div>
              <button className="recSendBtn" onClick={() => stopAndSend(false)} title="Send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
            </div>
          ) : (
            <div className="recordingBar" style={{ transform: `translateX(${Math.min(0, slideX * 0.25)}px)` }}>
              <span className="recDot" />
              <span className="recTime">{fmtRecTime()}</span>
              <div className="recWave">
                {Array.from({ length: 20 }, (_, i) => <div key={i} className="recBar" />)}
              </div>
              <span className="recSlideHint" style={{ opacity: Math.max(0.2, 1 + slideX / 80) }}>
                ← slide to cancel
              </span>
            </div>
          )
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
        <button className="sendButton" onClick={handleSend} disabled={inputDisabled || isRecording || isSending || (!text.trim() && !img.file)} title="Send">
          {isSending ? <span className="sendSpinner" /> : "➤"}
        </button>
      </div>

      {cameraOpen && <CameraModal onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />}
    </div>
  );
};

export default Chat;
