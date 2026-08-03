import "./ContactsPermissionModal.css";

const PhoneContactsModal = ({ onClose }) => {
  const raw = localStorage.getItem("chatapp_phone_contacts");
  const contacts = raw ? JSON.parse(raw) : null;

  return (
    <div className="cpOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cpModal">
        <h3>Phone contacts {contacts ? `(${contacts.length})` : ""}</h3>

        {!contacts ? (
          <p>No contacts saved yet. They appear here after you allow access during signup.</p>
        ) : contacts.length === 0 ? (
          <p className="cpEmpty">No contacts were selected.</p>
        ) : (
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
