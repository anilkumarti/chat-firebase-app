import { useState } from "react";
import { toast } from "react-toastify";
import "./ContactsPermissionModal.css";

const ContactsPermissionModal = ({ onClose }) => {
  const [contacts, setContacts] = useState(null); // null = not fetched yet
  const [loading, setLoading] = useState(false);

  const fetchContacts = async () => {
    if (!("contacts" in navigator && "ContactsManager" in window)) {
      toast.info("Contacts access is not supported on this browser. Try on a mobile device.");
      onClose();
      return;
    }
    setLoading(true);
    try {
      const results = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const serializable = results.map((c) => ({ name: c.name ?? [], tel: c.tel ?? [] }));
      localStorage.setItem("chatapp_phone_contacts", JSON.stringify(serializable));
      setContacts(serializable);
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Could not access contacts.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cpOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cpModal">
        {contacts === null ? (
          <>
            <div className="cpIcon">📇</div>
            <h3>Find people you know</h3>
            <p>Allow access to your contacts so we can help you connect with friends already on the app.</p>
            <div className="cpActions">
              <button className="cpSkip" onClick={onClose}>Skip</button>
              <button className="cpAllow" onClick={fetchContacts} disabled={loading}>
                {loading ? "Accessing…" : "Allow access"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Your contacts ({contacts.length})</h3>
            <div className="cpList">
              {contacts.length === 0 && (
                <p className="cpEmpty">No contacts found.</p>
              )}
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
            <button className="cpAllow" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ContactsPermissionModal;
