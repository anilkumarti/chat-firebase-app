import React from 'react'
import './AddUser.css'
const AddUser = () => {
  return (
    <div className='addUser'>
        <form action="">
            <input type="text" placeholder='User Name' name='username' />
            <button>Search</button>
        </form>
      <div className="user">
        <div className="detail">
            <img src="./avatar.png" alt="avatar logo" />
            <span> Anil Kumar</span>
        </div>
        <button> Add User</button>
      </div>
    </div>
  )
}

export default AddUser
