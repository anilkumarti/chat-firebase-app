import React, { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import "./Chat.css";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/UserStore";
import { toast } from "react-toastify";
const Chat = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState();
  const { chatId, user } = useChatStore();
  const { currentUser } = useUserStore();

  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behaviour: "smooth" }), []);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "chats", chatId), (res) => {
      setChat(res.data());
      return () => {
        unsub();
      };
    });
  }, [chatId]);
  const handleSend = async () => {
    if (text ==="") {
      console.log("empty text in chat entered");
      toast.warning("Empty chat")
      return;
    }

    try {
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
        }),
      });

      const userIDs = [currentUser.id, user.id];
      userIDs.forEach(async (id) => {
        const userChatsRef =  doc(db, "userchats", id);
        
        const userChatsSnapshot = await getDoc(userChatsRef);
        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();
          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );
          userChatsData.chats[chatIndex].lastMessage = text;
          userChatsData.chats[chatIndex].isSeen =
            id === currentUser.id ? true : false;
          userChatsData.chats[chatIndex].updatedAt = Date.now();
          await updateDoc(userChatsRef, {
            chats: userChatsData.chats,
          });
        }
      });
    } catch (error) {
      console.log(error);
    }
  };
  console.log("text will be ",)
  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img src="./avatar.png" alt="avatar logo" />
          <div className="texts">
            <span> ANil Kumar</span>
            <p>Lorem ipsum dolor sit amet consectetur adipisicing elit.</p>
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="icon logo" />
          <img src="./video.png" alt="icon logo" />
          <img src="./info.png" alt="icon logo" />
        </div>
      </div>
      <div className="center">
        {chat?.messages?.map((message) => (
          <div className="message own" key={message?.createdAt}>
           
            <div className="texts">
              {message.img && <img src={message.img} alt="image" />}
              <p>{message.text}</p>
              {/* <span>{message.createdAt}</span> */}
            </div>
          </div>
        ))}
        <div ref={endRef}> </div>
      </div>
      <div className="bottom">
        <div className="icons">
          <img src="./img.png" alt="image logo" />
          <img src="./camera.png" alt="camera logo" />
          <img src="./mic.png" alt="mic logo" />
        </div>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt="emoji icon"
            onClick={() => setOpen((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button className="sendButton" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
