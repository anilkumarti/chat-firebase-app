import { useEffect, useState } from "react";
import "./ContactsPermissionModal.css";
import { supabase } from "../../lib/Supabase";
import { useUserStore } from "../../lib/UserStore";

const PhoneContactsModal = ({ onClose }) => {
  const { currentUser } = useUserStore();
  const [contacts, setContacts] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase
      .from("users")
      .select("phone_contacts")
      .eq("id", currentUser.id)
      .single()
      .then(({ data }) => setContacts(data?.phone_contacts ?? null));
  }, [currentUser.id]);

  return (
    <div className="cpOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cpModal">
        <h3>Phone contacts {contacts?.length != null ? `(${contacts.length})` : ""}</h3>

        {contacts === undefined && <p className="cpEmpty">Loading…</p>}

        {contacts === null && (
          <p>No contacts synced yet. They appear here after you allow access.</p>
        )}

        {contacts?.length === 0 && (
          <p className="cpEmpty">No contacts were selected.</p>
        )}

        {contacts?.length > 0 && (
          <div className="cpList">
            {contacts.map((c, i) => (
              <div key={i} className="cpItem">
                <div className="cpAvatar">{(c.name?.[0] || "?")[0].toUpperCase()}</div>
                <div className="cpInfo">
                  <span className="cpName">{c.name?.[0] || "Unknown"}</span>
                  <span className="cpTel">{c.tel?.[0] || "No number"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="cpAllow" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default PhoneContactsModal;
