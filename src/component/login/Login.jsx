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

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
  </svg>
);

const Login = () => {
  const [mode, setMode] = useState("login");
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);
  const [showLoginPw,   setShowLoginPw]   = useState(false);
  const [showSignupPw,  setShowSignupPw]  = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Controlled field values used for button enable/disable
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regConfirmPw, setRegConfirmPw] = useState("");

  const loginReady = !loading && loginEmail.trim() !== "" && loginPw !== "";
  const signupReady = !loading && regUsername.trim() !== "" && regEmail.trim() !== "" && regPw !== "" && regConfirmPw !== "";

  const switchMode = (next) => {
    if (avatar.url) URL.revokeObjectURL(avatar.url);
    setAvatar({ file: null, url: "" });
    setLoginEmail(""); setLoginPw("");
    setRegUsername(""); setRegEmail(""); setRegPw(""); setRegConfirmPw("");
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
    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);

    if (!email.trim())  { toast.error("Email is required"); return; }
    if (!password)      { toast.error("Password is required"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Logged in successfully");
    } catch (error) {
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        toast.error("Please confirm your email address before signing in.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const { username, email, password, confirmPassword } = Object.fromEntries(formData);

    if (!username.trim())             { toast.error("Username is required"); return; }
    if (!email.trim())                { toast.error("Email is required"); return; }
    if (!password)                    { toast.error("Password is required"); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }

    setLoading(true);
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
      });
      if (profileError) throw profileError;

      const { error: chatError } = await supabase.from("user_chats").insert({
        user_id: data.user.id,
        chats: [],
      });
      if (chatError) throw chatError;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message?.toLowerCase().includes("email not confirmed")) {
          toast.info("Account created! Check your email to confirm before signing in.");
        } else {
          throw signInError;
        }
        return;
      }

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
            <input type="email" name="email" placeholder="Email address" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <div className="pw-wrap">
              <input type={showLoginPw ? "text" : "password"} name="password" placeholder="Password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowLoginPw((v) => !v)}>
                <EyeIcon open={showLoginPw} />
              </button>
            </div>
            <button disabled={!loginReady}>{loading ? "Signing in…" : "Sign in"}</button>
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
              {avatar.url ? (
                <img src={avatar.url} alt="avatar" />
              ) : (
                <span className="avatar-placeholder"><UploadIcon /></span>
              )}
              <span>{avatar.file ? avatar.file.name : "Upload a profile photo"}</span>
            </label>
            <input
              type="file"
              id="file"
              style={{ display: "none" }}
              onChange={handleAvatar}
              accept="image/*"
            />
            <input type="text" name="username" placeholder="Username" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
            <input type="email" name="email" placeholder="Email address" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
            <div className="pw-wrap">
              <input type={showSignupPw ? "text" : "password"} name="password" placeholder="Password" value={regPw} onChange={(e) => setRegPw(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowSignupPw((v) => !v)}>
                <EyeIcon open={showSignupPw} />
              </button>
            </div>
            <div className="pw-wrap">
              <input type={showConfirmPw ? "text" : "password"} name="confirmPassword" placeholder="Confirm password" value={regConfirmPw} onChange={(e) => setRegConfirmPw(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowConfirmPw((v) => !v)}>
                <EyeIcon open={showConfirmPw} />
              </button>
            </div>
            <button disabled={!signupReady}>{loading ? "Creating account…" : "Create account"}</button>
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
