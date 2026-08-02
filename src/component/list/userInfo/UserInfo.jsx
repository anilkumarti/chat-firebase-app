import { useState } from "react";
import "./UserInfo.css";
import { useUserStore } from "../../../lib/UserStore";
import { useChatStore } from "../../../lib/chatStore";
import ContactsModal from "../../contacts/ContactsModal";
import CreateGroupModal from "../../groups/CreateGroupModal";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const { setShowSearch } = useChatStore();
  const [showContacts, setShowContacts] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

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
          {/* Search */}
          <button className="iconBtn" onClick={() => setShowSearch(true)} title="Search (⌘K)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          {/* Contacts */}
          <button className="iconBtn" onClick={() => setShowContacts(true)} title="Contacts">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          {/* New Group */}
          <button className="iconBtn" onClick={() => setShowCreateGroup(true)} title="New Group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </button>
          <img src="./more.png" alt="more" />
          <img src="./edit.png" alt="edit" />
        </div>
      </div>

      {showContacts && <ContactsModal onClose={() => setShowContacts(false)} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </>
  );
};

export default UserInfo;
