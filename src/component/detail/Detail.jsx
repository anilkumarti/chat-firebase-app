import { arrayRemove, arrayUnion, doc,getDoc, updateDoc } from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { useEffect, useState ,useCallback} from "react";
import { auth, db } from "../../lib/Firebase";
import { useUserStore } from "../../lib/UserStore";

import "./Detail.css";
const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isRecieverBlocked, changeBlock } =
    useChatStore();
  const { currentUser } = useUserStore();

const [files, setFiles]=useState([])
  const handleBlock = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", currentUser.id);
      updateDoc(userDocRef, {
        blocked: isRecieverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
      changeBlock();
    } catch (error) {
      console.log(error);
    }
  };
  const fetchFiles = useCallback(async () => {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      const messages = chatSnap.data().messages || [];
      const uploadedFiles = messages
        .filter((msg) => msg.img) // Check if message contains a file
        .map((msg) => msg.img); // Extract file details

      setFiles(uploadedFiles);
    }
  },[chatId])
  useEffect(() => {
    
    

    fetchFiles();
  }, [fetchFiles]);

  return (
    <div className="detail">
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="avatar png" />
        <h2>{user?.username}</h2>
        <p>Busy</p>
      </div>
      <div className="info">
   
       
        <div className="option">
          <div className="title">
            <span> Shared Photos</span>
            <img src="./arrowDown.png" alt="arrow logo" />
          </div>
          <div className="photos">
       
           
          {files.length > 0 ? (
              files.map((file, index) => (
                <div className="photoItem" key={index}>
                  <div className="photoDetail">
                    <img src={file} alt={`Shared file ${index}`} />
                    <span>{`photo_${index + 1}.png`}</span>
                  </div>
                  <a href={file} download>
                    <img src="./download.png" alt="Download icon" className="icon" />
                  </a>
                </div>
              ))
            ) : (
              <p >No shared photos yet.</p>
            )}
        
          
          </div>
        </div>
      
        <button onClick={handleBlock}>
          {isCurrentUserBlocked
            ? "You are blocked!"
            : isRecieverBlocked
            ? "User blocked"
            : "Block user"}
        </button>
        <button className="logout" onClick={() => auth.signOut()}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Detail;
