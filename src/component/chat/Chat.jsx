import React, { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import "./Chat.css";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { useChatStore } from "../../lib/chatStore";
const Chat = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState();
  const { chatId } = useChatStore();
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behaviour: "smooth" }), []);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (res) => {
      setChat(res.data());
      return () => {
        unsub();
      };
    });
  }, [chatId]);
  console.log("this is chat", chat);
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
        <div className="message">
          <img src="./avatar.png" alt="avatar logo" />
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quaerat,
              eum.
            </p>
            <span> 1 min ago</span>
          </div>
        </div>
        <div className="message own">
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quaerat,
              eum.
            </p>
            <span> 1 min ago</span>
          </div>
        </div>
        <div className="message">
          <img src="./avatar.png" alt="avatar logo" />
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quaerat,
              eum.
            </p>
            <span> 1 min ago</span>
          </div>
        </div>
        <div className="message own">
          <div className="texts">
            <img src="https://picsum.photos/300" alt="" />
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quaerat,
              eum.
            </p>
            <span> 1 min ago</span>
          </div>
        </div>
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
        <button className="sendButton"> Send</button>
      </div>
    </div>
  );
};

export default Chat;
