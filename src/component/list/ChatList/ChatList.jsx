import React, { useState } from "react";
import "./ChatList.css";
import AddUser from "./addUser/AddUser";
const ChatList = () => {
  const [addMode, setAddMode] = useState(false);
  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="search logo" />
          <input type="text" placeholder="Search" />
        </div>
        <img
          src={addMode ? "./minus.png" : "./plus.png"}
          alt="plus logo"
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>
      <div className="item">
        <img src="./avatar.png" alt="avatar logo" />
        <div className="texts">
          <span> Anil Kumar</span>
          <p>hello</p>
        </div>
      </div>
      <div className="item">
        <img src="./avatar.png" alt="avatar logo" />
        <div className="texts">
          <span> Anil Kumar</span>
          <p>hello</p>
        </div>
      </div>
      <div className="item">
        <img src="./avatar.png" alt="avatar logo" />
        <div className="texts">
          <span> Anil Kumar</span>
          <p>hello</p>
        </div>
      </div>
       {addMode && <AddUser/>}
    </div>
  );
};

export default ChatList;
