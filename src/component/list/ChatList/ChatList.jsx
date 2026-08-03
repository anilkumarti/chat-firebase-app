import { useCallback, useEffect, useState } from "react";
import "./ChatList.css";
import AddUser from "./addUser/AddUser";
import { useUserStore } from "../../../lib/UserStore";
import { supabase } from "../../../lib/Supabase";
import { useChatStore } from "../../../lib/chatStore";

const formatListTime = (ts) => {
  if (!ts || ts === Infinity) return "";
  const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
  if (isNaN(d)) return "";
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [input, setInput] = useState("");
  const { currentUser } = useUserStore();
  const { changeChat, changeGroup, chatListRefresh } = useChatStore();

  const buildChatList = useCallback(
    async (row) => {
      const items = row?.chats ?? [];
      const enriched = await Promise.all(
        items.map(async (item) => {
          if (item.isGroup) {
            const { data: groupData } = await supabase
              .from("groups")
              .select("*")
              .eq("id", item.groupId)
              .single();
            return { ...item, group: groupData };
          }
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", item.receiverId)
            .single();
          return { ...item, user: userData };
        })
      );
      const sorted = enriched.sort((a, b) => b.updatedAt - a.updatedAt);
      const aiChat = {
        chatId: `deepseek_ai_${currentUser.id}`,
        user: { username: "AI Chatbot", avatar: "./meta_ai.png", blocked: [] },
        lastMessage: "",
        isSeen: true,
        updatedAt: Infinity,
      };
      setChats([aiChat, ...sorted]);
    },
    [currentUser?.id]
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase
      .from("user_chats")
      .select("*")
      .eq("user_id", currentUser.id)
      .single()
      .then(({ data }) => buildChatList(data));
  }, [currentUser?.id, chatListRefresh, buildChatList]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const refetch = () =>
      supabase
        .from("user_chats")
        .select("*")
        .eq("user_id", currentUser.id)
        .single()
        .then(({ data }) => buildChatList(data));

    const channel = supabase
      .channel(`user_chats:${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_chats", filter: `user_id=eq.${currentUser.id}` },
        refetch
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, buildChatList]);

  const filteredChats = input.trim()
    ? chats.filter((c) => {
        const name = c.isGroup ? c.group?.name : c.user?.username;
        return name?.toLowerCase().includes(input.toLowerCase());
      })
    : chats;

  const handleSelect = async (chat) => {
    const isAI = chat.chatId.startsWith("deepseek_ai_");
    if (isAI) {
      changeChat(chat.chatId, chat.user);
      return;
    }

    if (chat.isGroup) {
      try {
        const { data } = await supabase
          .from("user_chats")
          .select("*")
          .eq("user_id", currentUser.id)
          .single();
        const updatedChats = (data?.chats ?? []).map((c) =>
          c.chatId === chat.chatId ? { ...c, isSeen: true } : c
        );
        await supabase
          .from("user_chats")
          .update({ chats: updatedChats })
          .eq("user_id", currentUser.id);
        changeGroup(chat.chatId, chat.group);
      } catch (err) {
        console.log(err);
      }
      return;
    }

    try {
      const { data } = await supabase
        .from("user_chats")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();
      const updatedChats = (data?.chats ?? []).map((c) =>
        c.chatId === chat.chatId ? { ...c, isSeen: true } : c
      );
      await supabase
        .from("user_chats")
        .update({ chats: updatedChats })
        .eq("user_id", currentUser.id);
      changeChat(chat.chatId, chat.user);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="search" />
          <input
            type="text"
            placeholder="Search"
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <img
          src={addMode ? "./minus.png" : "./plus.png"}
          alt="toggle add"
          className="addBtn"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>

      {filteredChats.map((chat) => {
        const isGroup = !!chat.isGroup;
        const isBlocked = !isGroup && chat.user?.blocked?.includes(currentUser.id);
        const displayName = isGroup
          ? (chat.group?.name ?? "Group")
          : isBlocked ? "User" : (chat.user?.username ?? "Unknown");
        const avatar = isGroup
          ? chat.group?.avatar
          : isBlocked ? "./avatar.png" : (chat.user?.avatar || "./avatar.png");
        const unseen = !chat.isSeen;

        return (
          <div
            key={chat.chatId}
            className={`item${unseen ? " unseen" : ""}`}
            onClick={() => handleSelect(chat)}
          >
            <div className="avatarWrap">
              {isGroup && !avatar ? (
                <div className="groupInitial">{displayName.charAt(0).toUpperCase()}</div>
              ) : (
                <img src={avatar || "./avatar.png"} alt={displayName} />
              )}
              {isGroup && <span className="groupBadge">👥</span>}
            </div>
            <div className="itemTexts">
              <div className="itemHeader">
                <span className="itemName">{displayName}</span>
                <span className="itemTime">{formatListTime(chat.updatedAt)}</span>
              </div>
              <div className="itemBottom">
                <span className="itemPreview">{chat.lastMessage || "Start a conversation"}</span>
                {unseen && <span className="unreadBadge" />}
              </div>
            </div>
          </div>
        );
      })}

      {addMode && <AddUser />}
    </div>
  );
};

export default ChatList;
