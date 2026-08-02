import { useEffect } from "react";
import Chat from "./component/chat/Chat";
import Detail from "./component/detail/Detail";
import List from "./component/list/List";
import Login from "./component/login/Login";
import Notification from "./component/notification/Notification";
import { supabase } from "./lib/Supabase";
import { useUserStore } from "./lib/UserStore";
import { useChatStore } from "./lib/chatStore";
import { useCallStore } from "./lib/callStore";
import CallModal from "./component/call/CallModal";

const App = () => {
  const { currentUser, isLoading, fetchUserinfo, clearUser } = useUserStore();
  const { chatId, resetChat } = useChatStore();

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

  // Global WebRTC signaling listener
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`calls:${currentUser.id}`, { config: { broadcast: { ack: false } } })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const store = useCallStore.getState();

        switch (payload.type) {
          case "offer":
            store.setIncomingCall({
              fromUser: payload.fromUser,
              callType: payload.callType,
              offer: payload.offer,
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

          case "call-end":
          case "call-reject":
            store.clearCall();
            break;
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  if (isLoading) return <div className="loading">Loading…</div>;

  return (
    <div className="container">
      {currentUser ? (
        <>
          <List />
          {chatId ? (
            <>
              <Chat />
              <Detail />
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
    </div>
  );
};

export default App;
