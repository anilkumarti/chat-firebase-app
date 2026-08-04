import { useEffect, useRef, useState } from "react";
import Chat from "./component/chat/Chat";
import Detail from "./component/detail/Detail";
import List from "./component/list/List";
import Login from "./component/login/Login";
import Notification from "./component/notification/Notification";
import SearchModal from "./component/search/SearchModal";
import { supabase } from "./lib/Supabase";
import { useUserStore } from "./lib/UserStore";
import { useChatStore } from "./lib/chatStore";
import { useCallStore } from "./lib/callStore";
import { saveCallEvent } from "./lib/callUtils";
import CallModal from "./component/call/CallModal";
import ContactsPermissionModal from "./component/contacts/ContactsPermissionModal";

const App = () => {
  const { currentUser, isLoading, fetchUserinfo, clearUser } = useUserStore();
  const { chatId, resetChat, showSearch, setShowSearch, showDetail } = useChatStore();

  const [listW, setListW]     = useState(280);
  const [detailW, setDetailW] = useState(240);
  const [showContactsPerm, setShowContactsPerm] = useState(false);

  const startResize = (panel, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panel === "list" ? listW : detailW;
    const onMove = (me) => {
      const delta = me.clientX - startX;
      if (panel === "list") {
        setListW(Math.max(200, Math.min(420, startW + delta)));
      } else {
        setDetailW(Math.max(180, Math.min(420, startW - delta)));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserinfo(session.user.id);
      } else {
        clearUser();
        resetChat();
        useCallStore.getState().clearCall();
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUserinfo, clearUser]);

  // Show contacts permission modal once for new signups
  useEffect(() => {
    if (currentUser && sessionStorage.getItem("chatapp_just_signed_up")) {
      sessionStorage.removeItem("chatapp_just_signed_up");
      setShowContactsPerm(true);
    }
  }, [currentUser]);

  // Cmd+K / Ctrl+K opens message search
  useEffect(() => {
    if (!currentUser) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentUser, setShowSearch]);

  // Global WebRTC signaling listener
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`calls:${currentUser.id}`, { config: { broadcast: { ack: false } } })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const store = useCallStore.getState();

        switch (payload.type) {
          case "offer":
            // Ignore if already in a call
            if (store.activeCall || store.pendingCall) break;
            store.setIncomingCall({
              fromUser: payload.fromUser,
              callType: payload.callType,
              offer: payload.offer,
              chatId: payload.chatId,
            });
            break;

          case "answer": {
            const peer = store.pendingCall?.peer;
            if (peer) {
              await peer.setRemoteDescription(payload.answer).catch(console.error);
              store.setActiveCall({
                ...store.pendingCall,
                withUser: store.pendingCall.toUser,
              });
            }
            break;
          }

          case "ice-candidate": {
            const peer = store.pendingCall?.peer || store.activeCall?.peer;
            if (peer) {
              await peer.addIceCandidate(payload.candidate).catch(console.error);
            }
            break;
          }

          case "call-end": {
            const { incomingCall: ic, activeCall: ac } = store;
            if (ac?.chatId) {
              // other side hung up during an active call — save history
              await saveCallEvent(ac.chatId, {
                callType: ac.callType,
                status: "ended",
                duration: payload.duration || 0,
                initiatorId: payload.from,
              });
            } else if (ic?.chatId) {
              // caller hung up before we answered — missed call
              await saveCallEvent(ic.chatId, {
                callType: ic.callType,
                status: "missed",
                duration: 0,
                initiatorId: ic.fromUser.id,
              });
            }
            store.clearCall();
            break;
          }

          case "call-reject": {
            const { pendingCall: pc } = store;
            if (pc?.chatId) {
              await saveCallEvent(pc.chatId, {
                callType: pc.callType,
                status: "declined",
                duration: 0,
                initiatorId: pc.toUser?.id,
              });
            }
            store.clearCall();
            break;
          }
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  if (isLoading) return <div className="loading">Loading…</div>;

  return (
    <div className={`container${chatId ? " hasChatOpen" : ""}`} style={{ "--list-w": `${listW}px`, "--detail-w": `${detailW}px` }}>
      {currentUser ? (
        <>
          <List />
          <div className="resizeHandle" onMouseDown={(e) => startResize("list", e)} />
          {chatId ? (
            <>
              <Chat />
              {showDetail && (
                <>
                  <div className="resizeHandle" onMouseDown={(e) => startResize("detail", e)} />
                  <Detail />
                </>
              )}
            </>
          ) : (
            <div className="noChat">
              <div className="noChatInner">
                <span className="noChatIcon">💬</span>
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <Login />
      )}
      <Notification />
      <CallModal />
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showContactsPerm && <ContactsPermissionModal onClose={() => setShowContactsPerm(false)} />}
    </div>
  );
};

export default App;
