import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import "./ContactsModal.css";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import { useChatStore } from "../../lib/chatStore";

const ContactsModal = ({ onClose }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const { currentUser } = useUserStore();
  const { changeChat, triggerChatListRefresh } = useChatStore();
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const load = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .neq("id", currentUser.id)
        .order("username");
      if (!error) setAllUsers(data ?? []);
      setLoading(false);
    };
    load();
  }, [currentUser.id]);

  // close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = query.trim()
    ? allUsers.filter((u) =>
        u.username.toLowerCase().includes(query.trim().toLowerCase())
      )
    : allUsers;

  const handleStartChat = async (user) => {
    if (pending === user.id) return;
    setPending(user.id);
    try {
      const { data: myRow } = await supabase
        .from("user_chats")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      const myChats = myRow?.chats ?? [];
      const existing = myChats.find((c) => !c.isGroup && c.receiverId === user.id);

      if (existing) {
        // Chat exists — just open it
        changeChat(existing.chatId, user);
        triggerChatListRefresh();
        onClose();
        return;
      }

      // Create new chat
      const newChatId = crypto.randomUUID();
      const now = Date.now();

      const { error: chatError } = await supabase
        .from("chats")
        .insert({ id: newChatId, messages: [] });
      if (chatError) throw chatError;

      const { data: receiverRow } = await supabase
        .from("user_chats")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const { data: rxRows, error: rxError } = await supabase
        .from("user_chats")
        .update({
          chats: [
            ...(receiverRow?.chats ?? []),
            { chatId: newChatId, lastMessage: "", receiverId: currentUser.id, updatedAt: now, isSeen: false, unreadCount: 1 },
          ],
        })
        .eq("user_id", user.id)
        .select("user_id");
      if (rxError) throw rxError;
      if (!rxRows?.length) throw new Error("Could not add chat to that user — their account has no chat list yet.");

      const { error: myError } = await supabase
        .from("user_chats")
        .update({
          chats: [
            ...myChats,
            { chatId: newChatId, lastMessage: "", receiverId: user.id, updatedAt: now, isSeen: true, unreadCount: 0 },
          ],
        })
        .eq("user_id", currentUser.id);
      if (myError) throw myError;

      changeChat(newChatId, user);
      triggerChatListRefresh();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to start chat");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="contactsOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="contactsModal">
        <div className="contactsHeader">
          <span>Contacts</span>
          <button className="contactsClose" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="contactsSearch">
          <img src="./search.png" alt="" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="contactsList">
          {loading && <p className="contactsEmpty">Loading…</p>}
          {!loading && filtered.length === 0 && !query.trim() && (
            <p className="contactsEmpty">No users found</p>
          )}
          {!loading && !query.trim() && (
            <div key={currentUser.id} className="contactItem">
              <img src={currentUser.avatar || "./avatar.png"} alt="You" />
              <span className="contactName">You</span>
              <button
                className="contactAddBtn"
                onClick={() => handleStartChat(currentUser)}
                disabled={pending === currentUser.id}
                title="Message yourself"
              >
                {pending === currentUser.id ? "…" : "+"}
              </button>
            </div>
          )}
          {filtered.map((user) => (
            <div key={user.id} className="contactItem">
              <img src={user.avatar || "./avatar.png"} alt={user.username} />
              <span className="contactName">{user.username}</span>
              <button
                className="contactAddBtn"
                onClick={() => handleStartChat(user)}
                disabled={pending === user.id}
                title="Start chat"
              >
                {pending === user.id ? "…" : "+"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContactsModal;
