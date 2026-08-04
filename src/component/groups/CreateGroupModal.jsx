import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import "./CreateGroupModal.css";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import { useChatStore } from "../../lib/chatStore";

const CreateGroupModal = ({ onClose }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const { currentUser } = useUserStore();
  const { changeGroup, triggerChatListRefresh } = useChatStore();
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    supabase
      .from("users")
      .select("id, username, avatar")
      .neq("id", currentUser.id)
      .order("username")
      .then(({ data }) => setAllUsers(data ?? []));
  }, [currentUser.id]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleUser = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const filtered = query.trim()
    ? allUsers.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()))
    : allUsers;

  const handleCreate = async () => {
    if (!groupName.trim()) { toast.warning("Enter a group name"); return; }
    if (selected.size === 0) { toast.warning("Select at least 1 member"); return; }
    setCreating(true);
    try {
      const memberIds = [currentUser.id, ...Array.from(selected)];
      const newChatId = crypto.randomUUID();
      const now = Date.now();

      const { data: group, error: groupErr } = await supabase
        .from("groups")
        .insert({ name: groupName.trim(), created_by: currentUser.id, member_ids: memberIds })
        .select()
        .single();
      if (groupErr) throw groupErr;

      const { error: chatErr } = await supabase
        .from("chats")
        .insert({ id: newChatId, messages: [] });
      if (chatErr) throw chatErr;

      const baseEntry = { chatId: newChatId, isGroup: true, groupId: group.id, lastMessage: "", updatedAt: now };

      await Promise.all(
        memberIds.map(async (memberId) => {
          const { data: row } = await supabase
            .from("user_chats")
            .select("*")
            .eq("user_id", memberId)
            .single();
          await supabase
            .from("user_chats")
            .update({
              chats: [
                ...(row?.chats ?? []),
                {
                  ...baseEntry,
                  isSeen: memberId === currentUser.id,
                  unreadCount: memberId === currentUser.id ? 0 : 1,
                },
              ],
            })
            .eq("user_id", memberId);
        })
      );

      changeGroup(newChatId, group);
      triggerChatListRefresh();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="cgOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cgModal">
        <div className="cgHeader">
          <span>New Group</span>
          <button className="cgClose" onClick={onClose}>✕</button>
        </div>

        <div className="cgNameRow">
          <div className="cgNameWrap">
            <span className="cgNameIcon">👥</span>
            <input
              ref={nameRef}
              type="text"
              placeholder="Group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="cgNameInput"
              maxLength={60}
            />
          </div>
        </div>

        <div className="cgSearchRow">
          <img src="./search.png" alt="" />
          <input
            type="text"
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {selected.size > 0 && (
            <span className="cgCount">{selected.size} selected</span>
          )}
        </div>

        <div className="cgList">
          {filtered.length === 0 && <p className="cgEmpty">No users found</p>}
          {filtered.map((u) => {
            const isSelected = selected.has(u.id);
            return (
              <div
                key={u.id}
                className={`cgUser${isSelected ? " cgSelected" : ""}`}
                onClick={() => toggleUser(u.id)}
              >
                <img src={u.avatar || "./avatar.png"} alt={u.username} />
                <span className="cgUserName">{u.username}</span>
                <div className={`cgCheck${isSelected ? " cgCheckOn" : ""}`}>
                  {isSelected && "✓"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cgFooter">
          <button
            className="cgCreateBtn"
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selected.size === 0}
          >
            {creating ? "Creating…" : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
