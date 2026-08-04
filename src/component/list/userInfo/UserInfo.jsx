import { useEffect, useRef, useState } from "react";
import "./UserInfo.css";
import { useUserStore } from "../../../lib/UserStore";
import { useChatStore } from "../../../lib/chatStore";
import { supabase } from "../../../lib/Supabase";
import ContactsModal from "../../contacts/ContactsModal";
import CreateGroupModal from "../../groups/CreateGroupModal";
import PhoneContactsModal from "../../contacts/PhoneContactsModal";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const { setShowSearch } = useChatStore();
  const [showContacts, setShowContacts] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPhoneContacts, setShowPhoneContacts] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => { if (!moreRef.current?.contains(e.target)) setShowMore(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  const handleLogout = async () => {
    setShowMore(false);
    await supabase.auth.signOut();
  };

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
          {/* Desktop-only icon buttons */}
          <button className="iconBtn desktopOnly" onClick={() => setShowSearch(true)} title="Search (⌘K)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button className="iconBtn desktopOnly" onClick={() => setShowContacts(true)} title="Contacts">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button className="iconBtn desktopOnly" onClick={() => setShowPhoneContacts(true)} title="Phone contacts">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.97 6.32 14.4A19.79 19.79 0 0 1 3.25 5.77 2 2 0 0 1 5.23 3.58h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.91 11.4a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18.92z"/>
            </svg>
          </button>
          <button className="iconBtn desktopOnly" onClick={() => setShowCreateGroup(true)} title="New Group">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </button>

          {/* More / three-dots — always visible */}
          <div className="moreWrap" ref={moreRef}>
            <img src="./more.png" alt="more" title="More options"
              style={{ cursor: "pointer" }}
              onClick={() => setShowMore((p) => !p)} />
            {showMore && (
              <div className="moreDropdown">
                {/* Mobile-only actions inside dropdown */}
                <button className="moreItem mobileOnly" onClick={() => { setShowMore(false); setShowSearch(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  Search
                </button>
                <button className="moreItem mobileOnly" onClick={() => { setShowMore(false); setShowContacts(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Add contact
                </button>
                <button className="moreItem mobileOnly" onClick={() => { setShowMore(false); setShowPhoneContacts(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.97 6.32 14.4A19.79 19.79 0 0 1 3.25 5.77 2 2 0 0 1 5.23 3.58h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.91 11.4a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18.92z"/>
                  </svg>
                  Phone contacts
                </button>
                <button className="moreItem mobileOnly" onClick={() => { setShowMore(false); setShowCreateGroup(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  New group
                </button>
                <button className="moreItem moreItemDanger" onClick={handleLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
          {/* New chat compose — desktop only */}
          <img src="./edit.png" alt="new chat" title="New chat" className="desktopOnly"
            style={{ cursor: "pointer" }}
            onClick={() => setShowContacts(true)} />
        </div>
      </div>

      {showContacts && <ContactsModal onClose={() => setShowContacts(false)} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
      {showPhoneContacts && <PhoneContactsModal onClose={() => setShowPhoneContacts(false)} />}
    </>
  );
};

export default UserInfo;
