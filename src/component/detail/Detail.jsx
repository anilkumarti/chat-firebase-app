import { useEffect, useState } from "react";
import { useChatStore } from "../../lib/chatStore";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import { toast } from "react-toastify";
import "./Detail.css";

const Detail = () => {
  const { chatId, user, isGroupChat, groupInfo, isCurrentUserBlocked, isRecieverBlocked, changeBlock, resetChat, triggerChatListRefresh } =
    useChatStore();
  const isAIChat = chatId?.startsWith("deepseek_ai_");
  const { currentUser, updateBlocked } = useUserStore();
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [photosOpen, setPhotosOpen] = useState(true);

  // Shared photos
  useEffect(() => {
    if (!chatId) return;
    const extractFiles = (row) =>
      setFiles((row?.messages ?? []).filter((m) => m.img).map((m) => m.img));

    supabase.from("chats").select("messages").eq("id", chatId).single()
      .then(({ data }) => extractFiles(data));

    if (chatId.startsWith("deepseek_ai_")) return;

    const channel = supabase
      .channel(`detail:${chatId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` },
        (payload) => extractFiles(payload.new))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [chatId]);

  // Group member profiles
  useEffect(() => {
    if (!isGroupChat || !groupInfo?.member_ids?.length) { setMembers([]); return; }
    supabase
      .from("users")
      .select("id, username, avatar")
      .in("id", groupInfo.member_ids)
      .then(({ data }) => setMembers(data ?? []));
  }, [isGroupChat, groupInfo]);

  const handleBlock = async () => {
    if (!user) return;
    try {
      const blocked = isRecieverBlocked
        ? (currentUser.blocked || []).filter((id) => id !== user.id)
        : [...(currentUser.blocked || []), user.id];
      await supabase.from("users").update({ blocked }).eq("id", currentUser.id);
      updateBlocked(blocked);
      changeBlock();
    } catch (err) {
      console.log(err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupInfo) return;
    try {
      const newMemberIds = groupInfo.member_ids.filter((id) => id !== currentUser.id);
      await supabase.from("groups").update({ member_ids: newMemberIds }).eq("id", groupInfo.id);

      const { data: myRow } = await supabase.from("user_chats").select("*").eq("user_id", currentUser.id).single();
      const updatedChats = (myRow?.chats ?? []).filter((c) => c.chatId !== chatId);
      await supabase.from("user_chats").update({ chats: updatedChats }).eq("user_id", currentUser.id);

      resetChat();
      triggerChatListRefresh();
      toast.success("Left the group");
    } catch (err) {
      toast.error("Failed to leave group");
    }
  };

  if (isGroupChat) {
    return (
      <div className="detail">
        <div className="user">
          {groupInfo?.avatar ? (
            <img src={groupInfo.avatar} alt="group" />
          ) : (
            <div className="groupAvatarLarge">
              {groupInfo?.name?.charAt(0).toUpperCase() ?? "G"}
            </div>
          )}
          <h2>{groupInfo?.name}</h2>
          <p>{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="info">
          <div className="option">
            <div className="title">
              <span>Members</span>
            </div>
            <div className="membersList">
              {members.map((m) => (
                <div key={m.id} className="memberItem">
                  <img src={m.avatar || "./avatar.png"} alt={m.username} />
                  <span className="memberName">{m.username}</span>
                  {groupInfo?.created_by === m.id && (
                    <span className="adminBadge">Admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button className="danger" onClick={handleLeaveGroup}>Leave Group</button>
          <button className="logout" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail">
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="avatar" />
        <h2>{user?.username}</h2>
      </div>
      <div className="info">
        <div className="option">
          <div className="title" onClick={() => setPhotosOpen((p) => !p)} style={{ cursor: "pointer" }}>
            <span>Shared Photos</span>
            <img src="./arrowDown.png" alt="expand"
              style={{ transition: "transform 0.2s", transform: photosOpen ? "rotate(0deg)" : "rotate(-90deg)" }} />
          </div>
          {photosOpen && (
            <div className="photos">
              {files.length > 0 ? (
                files.map((file, index) => (
                  <div className="photoItem" key={index}>
                    <div className="photoDetail">
                      <img src={file} alt={`shared ${index + 1}`} />
                    </div>
                    <a href={file} download className="photoOverlay">
                      <img src="./download.png" alt="download" />
                    </a>
                  </div>
                ))
              ) : (
                <p>No shared photos yet.</p>
              )}
            </div>
          )}
        </div>
        {!isAIChat && (
          <button onClick={handleBlock}>
            {isCurrentUserBlocked ? "You are blocked!" : isRecieverBlocked ? "User blocked" : "Block user"}
          </button>
        )}
        <button className="logout" onClick={() => supabase.auth.signOut()}>Logout</button>
      </div>
    </div>
  );
};

export default Detail;
