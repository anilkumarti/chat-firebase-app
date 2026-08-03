import { useState } from "react";
import { toast } from "react-toastify";
import "./ContactsPermissionModal.css";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import { useChatStore } from "../../lib/chatStore";

const normalizePhone = (p) => p.replace(/\D/g, "").slice(-10);

const ContactsPermissionModal = ({ onClose }) => {
  const { currentUser } = useUserStore();
  const { changeChat, triggerChatListRefresh } = useChatStore();

  const [contacts, setContacts]   = useState(null);
  const [matched, setMatched]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [pending, setPending]     = useState(null);

  const fetchContacts = async () => {
    if (!("contacts" in navigator && "ContactsManager" in window)) {
      toast.info("Contacts access is not supported on this browser. Try on a mobile device.");
      onClose();
      return;
    }
    setLoading(true);
    try {
      const results = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const serializable = results.map((c) => ({ name: c.name ?? [], tel: c.tel ?? [] }));

      // 1. Persist to localStorage
      localStorage.setItem("chatapp_phone_contacts", JSON.stringify(serializable));

      // 2. Save to Supabase on the user's row
      await supabase
        .from("users")
        .update({ phone_contacts: serializable })
        .eq("id", currentUser.id);

      // 3. Find app users whose phone matches any contact number
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, username, avatar, phone")
        .neq("id", currentUser.id)
        .not("phone", "is", null);

      const contactNums = new Set(
        serializable.flatMap((c) => (c.tel ?? []).map(normalizePhone)).filter(Boolean)
      );
      const matches = (allUsers ?? []).filter(
        (u) => u.phone && contactNums.has(normalizePhone(u.phone))
      );

      setContacts(serializable);
      setMatched(matches);
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Could not access contacts.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (user) => {
    if (pending === user.id) return;
    setPending(user.id);
    try {
      const { data: myRow } = await supabase
        .from("user_chats").select("*").eq("user_id", currentUser.id).single();
      const myChats = myRow?.chats ?? [];
      const existing = myChats.find((c) => !c.isGroup && c.receiverId === user.id);
      if (existing) { changeChat(existing.chatId, user); triggerChatListRefresh(); onClose(); return; }

      const newChatId = crypto.randomUUID();
      const now = Date.now();
      await supabase.from("chats").insert({ id: newChatId, messages: [] });

      const { data: receiverRow } = await supabase
        .from("user_chats").select("*").eq("user_id", user.id).single();
      await supabase.from("user_chats")
        .update({ chats: [...(receiverRow?.chats ?? []), { chatId: newChatId, lastMessage: "", receiverId: currentUser.id, updatedAt: now, isSeen: false }] })
        .eq("user_id", user.id);
      await supabase.from("user_chats")
        .update({ chats: [...myChats, { chatId: newChatId, lastMessage: "", receiverId: user.id, updatedAt: now, isSeen: true }] })
        .eq("user_id", currentUser.id);

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
    <div className="cpOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cpModal">
        {contacts === null ? (
          <>
            <div className="cpIcon">📇</div>
            <h3>Find people you know</h3>
            <p>Allow access to your contacts so we can show which of your friends are already on the app.</p>
            <div className="cpActions">
              <button className="cpSkip" onClick={onClose}>Skip</button>
              <button className="cpAllow" onClick={fetchContacts} disabled={loading}>
                {loading ? "Syncing…" : "Allow access"}
              </button>
            </div>
          </>
        ) : (
          <>
            {matched.length > 0 && (
              <>
                <h3 className="cpSectionTitle">On this app ({matched.length})</h3>
                <div className="cpList">
                  {matched.map((u) => (
                    <div key={u.id} className="cpItem">
                      <img
                        src={u.avatar || "./avatar.png"}
                        alt={u.username}
                        className="cpAvatarImg"
                      />
                      <div className="cpInfo">
                        <span className="cpName">{u.username}</span>
                        <span className="cpTel">{u.phone}</span>
                      </div>
                      <button
                        className="cpChatBtn"
                        onClick={() => handleStartChat(u)}
                        disabled={pending === u.id}
                      >
                        {pending === u.id ? "…" : "Chat"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h3 className="cpSectionTitle">
              All contacts ({contacts.length})
            </h3>
            <div className="cpList">
              {contacts.length === 0 && <p className="cpEmpty">No contacts selected.</p>}
              {contacts.map((c, i) => (
                <div key={i} className="cpItem">
                  <div className="cpAvatar">{(c.name?.[0] || "?")[0].toUpperCase()}</div>
                  <div className="cpInfo">
                    <span className="cpName">{c.name?.[0] || "Unknown"}</span>
                    <span className="cpTel">{c.tel?.[0] || "No number"}</span>
                  </div>
                </div>
              ))}
            </div>

            <button className="cpAllow" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactsPermissionModal;
