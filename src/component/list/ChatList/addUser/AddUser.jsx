import React, { useState } from "react";
import "./AddUser.css";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  getDoc,
  setDoc,
  where,
  updateDoc
} from "firebase/firestore";
import { db } from "../../../../lib/Firebase";
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
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", username));
      const querySnapShot = await getDocs(q);
      if (!querySnapShot.empty) {
        setUser(querySnapShot.docs[0].data());
      }
    } catch (error) {
      console.log(error);
    }
  };
  const handleAdd = async () => {
    const chatRef = collection(db, "chats");
    const userChatsRef = collection(db, "userchats");
    try {
      const currentUserDoc = await getDoc(doc(userChatsRef, currentUser.id));
      const existingChat = currentUserDoc.data()?.chats.find(chat => chat.receiverId === user.id);

      if (existingChat) {
        console.log("Chat already exists");
        toast.warning("Chat already exists")
        return;
      }
      const newChatRef = doc(chatRef);
      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });

      await updateDoc(doc(userChatsRef, user.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: currentUser.id,
          updatedAt: Date.now(),
        }),
      });
      await updateDoc(doc(userChatsRef, currentUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: user.id,
          updatedAt: Date.now(),
        }),
      });

      console.log("newchatref" + newChatRef.id);
    } catch (error) {
      console.log(error);
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
            <img src={user.avatar.png || "./avatar.png"} alt="avatar logo" />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}> Add User</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;
