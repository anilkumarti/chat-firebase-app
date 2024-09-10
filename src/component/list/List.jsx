import React from 'react'
import './List.css'
import UserInfo from './userInfo/UserInfo';
import ChatList from './ChatList/ChatList';
const List = () => {
  return (
    <div className='list'>
     <UserInfo/>
     <ChatList/>
      
    </div>
  )
}

export default List;
