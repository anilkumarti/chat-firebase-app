import { useState } from "react";
import "./AddUser.css";
import { supabase } from "../../../../lib/Supabase";
import { useUserStore } from "../../../../lib/UserStore";
import { toast } from "react-toastify";

const AddUser = () => {
  const [user, setUser] = useState(null);
  const { currentUser } = useUserStore();

  const handleSearch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get("username");
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();
      if (error) throw error;
      setUser(data);
    } catch {
      toast.error("User not found");
    }
  };

  const handleAdd = async () => {
    try {
      const { data: myChatsRow } = await supabase
        .from("user_chats")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      const existing = (myChatsRow?.chats ?? []).find(
        (c) => c.receiverId === user.id
      );
      if (existing) {
        toast.warning("Chat already exists");
        return;
      }

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

      await supabase
        .from("user_chats")
        .update({
          chats: [
            ...(receiverRow?.chats ?? []),
            {
              chatId: newChatId,
              lastMessage: "",
              receiverId: currentUser.id,
              updatedAt: now,
              isSeen: false,
            },
          ],
        })
        .eq("user_id", user.id);

      await supabase
        .from("user_chats")
        .update({
          chats: [
            ...(myChatsRow?.chats ?? []),
            {
              chatId: newChatId,
              lastMessage: "",
              receiverId: user.id,
              updatedAt: now,
              isSeen: true,
            },
          ],
        })
        .eq("user_id", currentUser.id);

      toast.success("User added!");
      setUser(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="addUser">
      <form onSubmit={handleSearch}>
        <input type="text" placeholder="User Name" name="username" />
        <button>Search</button>
      </form>
      {user && (
        <div className="user">
          <div className="detail">
            <img src={user.avatar || "./avatar.png"} alt="avatar" />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}>Add User</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;
