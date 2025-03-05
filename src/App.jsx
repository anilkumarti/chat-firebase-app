import { useEffect } from "react";
import Chat from "./component/chat/Chat";
import Detail from "./component/detail/Detail";
import List from "./component/list/List";
import Login from "./component/login/Login";
import Notification from "./component/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/Firebase";
import { useUserStore } from "./lib/UserStore";
import { useChatStore } from "./lib/chatStore";
import AddUser from "./component/list/ChatList/addUser/AddUser";

const App = () => {
  const { currentUser, isLoading, fetchUserinfo,clearUser } = useUserStore();
  const {chatId}=useChatStore();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      console.log('user in App', user)
      if (user) {
        fetchUserinfo(user.uid);
      } else {
        clearUser();
        console.log("user not found");
      }
    });

    return () => {
      unsub();
    };
  }, [fetchUserinfo,clearUser]);
   console.log("chat Id in app", chatId);
  if (isLoading) return <div className="loading">Loading....</div>;
  return (
    <div className="container">
   
      {currentUser ? (
        <>
           <List />
       
           {/* <Chat/>*/}
           
          { chatId  && <Chat />}
           {chatId && <Detail />}
        </>
      ) : (
        <Login />
      )}
      <Notification />
    </div>
  );
};

export default App;
