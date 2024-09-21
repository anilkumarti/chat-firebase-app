import { useEffect } from "react";
import Chat from "./component/chat/Chat";
import Detail from "./component/detail/Detail";
import List from "./component/list/List";
import Login from "./component/login/Login";
import Notification from "./component/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/Firebase";
import { useUserStore } from "./lib/UserStore";

const App = () => {
  const { currentUser, isLoading, fetchUserinfo} = useUserStore();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if(user) {
        fetchUserinfo(user.uid)
      }
      else {
        console.log("user not found")
      }
    });
   
    return () => {
      unsub();
    };
  }, [fetchUserinfo]);
console.log("current user", currentUser);
if (isLoading) return <div className="loading">Loading....</div>;
  return (
    <div className="container">
      {currentUser ? (
        <>
          <List />
          <Chat />
          <Detail />
        </>
      ) : (
        <Login />
      )}
      <Notification />
    </div>
  );
};

export default App;
