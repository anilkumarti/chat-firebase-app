import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";

import { toast } from "react-toastify";
import "./Login.css";
import { auth, db } from "../../lib/Firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import upload from "../../lib/Upload";
const Login = () => {
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      setAvatar({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);
    try { 
       signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.log("Error occured in sigining in", error);
      toast.error(error);
    } finally {
      setLoading(false);
    }
  };
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const { username, email, password } = Object.fromEntries(formData);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const imgUrl = await upload(avatar.file);

      await setDoc(doc(db, "users", res.user.uid), {
        username,
        email,
        avatar: imgUrl,
        id: res.user.uid,
        blocked: [],
      });
      await setDoc(doc(db, "userchats", res.user.uid), {
        chats: [],
      });
      toast.success("Account created.You can login now");
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login">
      <div className="item">
        <h2>Welcome back</h2>
        <form action="" onSubmit={handleLogin}>
          <input type="email" name="email" placeholder="Enter email" />
          <input type="password" name="password" placeholder="Enter password" />
          <button disabled={loading}>{loading ? "loading" : "Sign in"} </button>
        </form>
      </div>
      <div className="separator"></div>
      <div className="item">
        <h2>Create an account</h2>
        <form onSubmit={handleRegister}>
          <label htmlFor="file">
            <img src={avatar.url || "./avatar.png"} alt="avatar logo" />
            Upload an image
          </label>

          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onClick={handleAvatar}
          />
          <input type="text" name="username" placeholder="Enter username" />
          <input type="email" name="email" placeholder="Enter email" />
          <input type="password" name="password" placeholder="Enter password" />
          <button disabled={loading}> {loading ? "loading" : "Signup"} </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
