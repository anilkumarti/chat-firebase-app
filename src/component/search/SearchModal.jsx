import { useEffect, useRef, useState } from "react";
import "./SearchModal.css";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import { useChatStore } from "../../lib/chatStore";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const Highlight = ({ text, query }) => {
  if (!text) return null;
  if (!query) return <span>{text.slice(0, 80)}{text.length > 80 ? "…" : ""}</span>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <span>{text.slice(0, 80)}{text.length > 80 ? "…" : ""}</span>;
  const start = Math.max(0, i - 28);
  const end = Math.min(text.length, i + query.length + 48);
  return (
    <span>
      {start > 0 && "…"}
      {text.slice(start, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length, end)}
      {end < text.length && "…"}
    </span>
  );
};

const SearchModal = ({ onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatMeta, setChatMeta] = useState({});
  const { currentUser } = useUserStore();
  const { changeChat, changeGroup } = useChatStore();
  const inputRef = useRef(null);

  // Load chat metadata once (names + avatars for result display)
  useEffect(() => {
    inputRef.current?.focus();
    const loadMeta = async () => {
      const { data: ucRow } = await supabase
        .from("user_chats").select("*").eq("user_id", currentUser.id).single();
      const entries = ucRow?.chats ?? [];
      const meta = {};
      await Promise.all(
        entries.map(async (entry) => {
          if (entry.isGroup) {
            const { data: g } = await supabase
              .from("groups").select("*").eq("id", entry.groupId).single();
            meta[entry.chatId] = { name: g?.name ?? "Group", avatar: g?.avatar, isGroup: true, groupData: g };
          } else if (entry.receiverId) {
            const { data: u } = await supabase
              .from("users").select("*").eq("id", entry.receiverId).single();
            meta[entry.chatId] = { name: u?.username ?? "Unknown", avatar: u?.avatar, isGroup: false, user: u };
          }
        })
      );
      setChatMeta(meta);
    };
    loadMeta();
  }, [currentUser.id]);

  // Escape closes
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Debounced search via Postgres RPC
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("search_messages", {
          query_text: query.trim(),
          searcher_id: currentUser.id,
        });
        setResults(data ?? []);
      } catch (e) {
        console.error("search:", e);
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, currentUser.id]);

  const openResult = (result) => {
    const meta = chatMeta[result.chat_id];
    if (!meta) return;
    if (meta.isGroup) {
      changeGroup(result.chat_id, meta.groupData);
    } else {
      changeChat(result.chat_id, meta.user || {
        id: result.chat_entry?.receiverId,
        username: meta.name,
        avatar: meta.avatar,
        blocked: [],
      });
    }
    onClose();
  };

  const trimmedQuery = query.trim();

  return (
    <div className="searchOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="searchModal">
        <div className="searchInputRow">
          <img src="./search.png" alt="" className="searchIcon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="searchInput"
          />
          {query ? (
            <button className="searchClear" onClick={() => setQuery("")}>✕</button>
          ) : (
            <span className="searchKbd">⌘K</span>
          )}
        </div>

        <div className="searchResults">
          {trimmedQuery.length < 2 && (
            <div className="searchEmpty">
              <div className="searchEmptyIcon">🔍</div>
              <p>Search across all your conversations</p>
            </div>
          )}

          {loading && trimmedQuery.length >= 2 && (
            <p className="searchHint">Searching…</p>
          )}

          {!loading && trimmedQuery.length >= 2 && results.length === 0 && (
            <div className="searchEmpty">
              <div className="searchEmptyIcon">💬</div>
              <p>No messages found for <strong>"{trimmedQuery}"</strong></p>
            </div>
          )}

          {results.map((r, i) => {
            const meta = chatMeta[r.chat_id];
            const msg = r.message;
            const isOwn = msg?.senderId === currentUser.id;
            return (
              <div key={i} className="searchResult" onClick={() => openResult(r)}>
                <div className="searchResultAvatar">
                  {meta?.isGroup && !meta.avatar ? (
                    <div className="searchGroupInitial">
                      {meta.name?.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <img src={meta?.avatar || "./avatar.png"} alt="" />
                  )}
                </div>
                <div className="searchResultBody">
                  <div className="searchResultHeader">
                    <span className="searchResultName">{meta?.name ?? "Chat"}</span>
                    <span className="searchResultTime">{formatTime(msg?.createdAt)}</span>
                  </div>
                  <p className="searchResultExcerpt">
                    {isOwn && <span className="searchResultYou">You: </span>}
                    {msg?.senderName && !isOwn && (
                      <span className="searchResultSender">{msg.senderName}: </span>
                    )}
                    <Highlight text={msg?.text} query={trimmedQuery} />
                  </p>
                </div>
              </div>
            );
          })}

          {!loading && results.length > 0 && (
            <p className="searchCount">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
