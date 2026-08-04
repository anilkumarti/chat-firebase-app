import React from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const Notification = () => {
  return (
    <div className=''>
       <ToastContainer theme="dark" position="top-center" />
    </div>
  )
}

export default Notification
