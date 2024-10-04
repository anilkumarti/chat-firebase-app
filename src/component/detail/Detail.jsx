import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/Firebase";
import { useUserStore } from "../../lib/UserStore";
import "./Detail.css";
const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isRecieverBlocked, changeBlock } =
    useChatStore();
  const { currentUser } = useUserStore();
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

  return (
    <div className="detail">
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="avatar png" />
        <h2>{user?.username}</h2>
        <p>Lorem ipsum dolor sit amet</p>
      </div>
      <div className="info">
        <div className="option">
          <div className="title">
            <span> Chat settings</span>
            <img src="./arrowUp.png" alt="arrow logo" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Privacy & help</span>
            <img src="./arrowUp.png" alt="arrow logo" />
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Shared Photos</span>
            <img src="./arrowDown.png" alt="arrow logo" />
          </div>
          <div className="photos">
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img
                  src="https://picsum.photos/200/200?grayscale"
                  alt="image"
                />
                <span> photo_455.png</span>
              </div>
              <img src="./download.png" alt="download logo" className="icon" />
            </div>
          </div>
        </div>
        <div className="option">
          <div className="title">
            <span> Shared Files</span>
            <img src="./arrowUp.png" alt="arrow logo" />
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
