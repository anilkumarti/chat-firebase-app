import { useState } from "react";
import { toast } from "react-toastify";
import "./Login.css";
import { supabase } from "../../lib/Supabase";
import upload from "../../lib/Upload";

const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const Login = () => {
  const [mode, setMode] = useState("login");
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);

  const switchMode = (next) => {
    if (avatar.url) URL.revokeObjectURL(avatar.url);
    setAvatar({ file: null, url: "" });
    setMode(next);
  };

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      if (avatar.url) URL.revokeObjectURL(avatar.url);
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const { username, email, password, phone } = Object.fromEntries(formData);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      let imgUrl = "";
      if (avatar.file) imgUrl = await upload(avatar.file);

      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        username,
        email,
        avatar: imgUrl,
        blocked: [],
        phone: phone?.trim() || null,
      });
      if (profileError) throw profileError;

      const { error: chatError } = await supabase.from("user_chats").insert({
        user_id: data.user.id,
        chats: [],
      });
      if (chatError) throw chatError;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      sessionStorage.setItem("chatapp_just_signed_up", "1");
      toast.success("Welcome! You're now signed in.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      {mode === "login" ? (
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to continue chatting</p>
          <form onSubmit={handleLogin}>
            <input type="email" name="email" placeholder="Email address" />
            <div className="pw-wrap">
              <input type={showLoginPw ? "text" : "password"} name="password" placeholder="Password" />
              <button type="button" className="pw-toggle" onClick={() => setShowLoginPw((v) => !v)}>
                <EyeIcon open={showLoginPw} />
              </button>
            </div>
            <button disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="switch-hint">
            Don't have an account?{" "}
            <button className="link-btn" onClick={() => switchMode("signup")}>
              Create account
            </button>
          </p>
        </div>
      ) : (
        <div className="auth-card">
          <h2>Create account</h2>
          <p className="subtitle">Join and start chatting</p>
          <form onSubmit={handleRegister}>
            <label htmlFor="file" className="avatar-label">
              <img src={avatar.url || "./avatar.png"} alt="avatar" />
              <span>{avatar.file ? avatar.file.name : "Upload a profile photo"}</span>
            </label>
            <input
              type="file"
              id="file"
              style={{ display: "none" }}
              onChange={handleAvatar}
              accept="image/*"
            />
            <input type="text" name="username" placeholder="Username" />
            <input type="email" name="email" placeholder="Email address" />
            <input type="tel" name="phone" placeholder="Phone number (optional)" />
            <div className="pw-wrap">
              <input type={showSignupPw ? "text" : "password"} name="password" placeholder="Password" />
              <button type="button" className="pw-toggle" onClick={() => setShowSignupPw((v) => !v)}>
                <EyeIcon open={showSignupPw} />
              </button>
            </div>
            <button disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
          </form>
          <p className="switch-hint">
            Already have an account?{" "}
            <button className="link-btn" onClick={() => switchMode("login")}>
              Log in
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

export default Login;
