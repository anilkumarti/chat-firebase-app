import { useEffect, useState } from "react";
import { useChatStore } from "../../lib/chatStore";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";
import "./Detail.css";

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isRecieverBlocked, changeBlock } =
    useChatStore();
  const isAIChat = chatId?.startsWith("deepseek_ai_");
  const { currentUser, updateBlocked } = useUserStore();
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!chatId) return;

    const extractFiles = (row) => {
      const msgs = row?.messages ?? [];
      setFiles(msgs.filter((m) => m.img).map((m) => m.img));
    };

    supabase
      .from("chats")
      .select("messages")
      .eq("id", chatId)
      .single()
      .then(({ data }) => extractFiles(data));

    const isAI = chatId.startsWith("deepseek_ai_");
    if (isAI) return;

    const channel = supabase
      .channel(`detail:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=eq.${chatId}`,
        },
        (payload) => extractFiles(payload.new)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [chatId]);

  const handleBlock = async () => {
    if (!user) return;
    try {
      const blocked = isRecieverBlocked
        ? (currentUser.blocked || []).filter((id) => id !== user.id)
        : [...(currentUser.blocked || []), user.id];

      await supabase
        .from("users")
        .update({ blocked })
        .eq("id", currentUser.id);

      updateBlocked(blocked);
      changeBlock();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="detail">
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="avatar" />
        <h2>{user?.username}</h2>
      </div>
      <div className="info">
        <div className="option">
          <div className="title">
            <span>Shared Photos</span>
            <img src="./arrowDown.png" alt="expand" />
          </div>
          <div className="photos">
            {files.length > 0 ? (
              files.map((file, index) => (
                <div className="photoItem" key={index}>
                  <div className="photoDetail">
                    <img src={file} alt={`shared ${index + 1}`} />
                    <span>{`photo_${index + 1}.png`}</span>
                  </div>
                  <a href={file} download>
                    <img src="./download.png" alt="download" className="icon" />
                  </a>
                </div>
              ))
            ) : (
              <p>No shared photos yet.</p>
            )}
          </div>
        </div>
        {!isAIChat && (
          <button onClick={handleBlock}>
            {isCurrentUserBlocked
              ? "You are blocked!"
              : isRecieverBlocked
              ? "User blocked"
              : "Block user"}
          </button>
        )}
        <button className="logout" onClick={() => supabase.auth.signOut()}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Detail;
