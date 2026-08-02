import { useState } from "react";
import "./UserInfo.css";
import { useUserStore } from "../../../lib/UserStore";
import ContactsModal from "../../contacts/ContactsModal";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const [showContacts, setShowContacts] = useState(false);

  return (
    <>
      <div className="userInfo">
        <div className="userBlock">
          <div className="avatarWrap">
            <img src={currentUser?.avatar || "./avatar.png"} alt="avatar" />
            <span className="onlineDot" />
          </div>
          <h2>{currentUser?.username ?? "Guest"}</h2>
        </div>
        <div className="icons">
          <button
            className="contactsBtn"
            onClick={() => setShowContacts(true)}
            title="Contacts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <img src="./more.png" alt="more" />
          <img src="./video.png" alt="video" />
          <img src="./edit.png" alt="edit" />
        </div>
      </div>

      {showContacts && (
        <ContactsModal onClose={() => setShowContacts(false)} />
      )}
    </>
  );
};

export default UserInfo;
