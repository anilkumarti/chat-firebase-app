import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useCallStore } from "../../lib/callStore";
import { useUserStore } from "../../lib/UserStore";
import { supabase } from "../../lib/Supabase";
import { saveCallEvent } from "../../lib/callUtils";
import "./CallModal.css";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const fmt = (s) => {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

/* ─── SVG Icons ─────────────────────────────────────────── */
const MicIcon = ({ off }) =>
  off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .38-.04.75-.1 1.1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );

const CamIcon = ({ off }) =>
  off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
      <path d="M23 7l-7 5 7 5V7z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );

const FlipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
  </svg>
);

const ScreenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <polyline points="8 10 12 6 16 10" />
    <line x1="12" y1="6" x2="12" y2="13" />
  </svg>
);

const PhoneOffIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.97 6.32 14.4" />
    <path d="M6.32 14.4C4.76 12.97 3.44 11.29 2.56 9.45 1.68 7.61 1.14 5.68 1 3.73A2 2 0 0 1 2.9 1.56h3.05a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L6.93 9.47" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const PhoneIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.97 6.32 14.4A19.79 19.79 0 0 1 3.25 5.77 2 2 0 0 1 5.23 3.58h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.91 11.4a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18.92z" />
  </svg>
);

/* ─── CallModal Component ───────────────────────────────── */
const CallModal = () => {
  const { incomingCall, pendingCall, activeCall, setSignalCh, setActiveCall, clearCall } = useCallStore();
  const { currentUser } = useUserStore();

  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef  = useRef(null);
  const callTimerRef   = useRef(null);
  const ringTimerRef   = useRef(null);

  const [isMuted,        setIsMuted]        = useState(false);
  const [isCamOff,       setIsCamOff]       = useState(false);
  const [isScreenShare,  setIsScreenShare]  = useState(false);
  const [callDuration,   setCallDuration]   = useState(0);
  const [ringDuration,   setRingDuration]   = useState(0);
  const [facingMode,     setFacingMode]     = useState("user");

  /* Wire remote stream — audio calls use <audio>, video calls use <video> */
  useEffect(() => {
    if (!activeCall?.remoteStream) return;
    if (activeCall.callType === "video") {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = activeCall.remoteStream;
    } else {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.remoteStream, activeCall?.callType]);

  useEffect(() => {
    const stream = (activeCall || pendingCall)?.localStream;
    if (stream && localVideoRef.current) localVideoRef.current.srcObject = stream;
  }, [activeCall, pendingCall]);

  /* Active call timer */
  useEffect(() => {
    if (activeCall) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
    }
    return () => clearInterval(callTimerRef.current);
  }, [!!activeCall]);

  /* Outgoing ringing timer */
  useEffect(() => {
    if (pendingCall && !activeCall) {
      setRingDuration(0);
      ringTimerRef.current = setInterval(() => setRingDuration((d) => d + 1), 1000);
    } else {
      clearInterval(ringTimerRef.current);
      setRingDuration(0);
    }
    return () => clearInterval(ringTimerRef.current);
  }, [!!pendingCall, !!activeCall]);

  /* Reset UI when all calls end */
  useEffect(() => {
    if (!activeCall && !pendingCall && !incomingCall) {
      setIsMuted(false);
      setIsCamOff(false);
      setIsScreenShare(false);
      setFacingMode("user");
    }
  }, [activeCall, pendingCall, incomingCall]);

  /* Auto-cut outgoing call after 60 s with no answer */
  useEffect(() => {
    if (pendingCall && !activeCall && ringDuration >= 60) {
      hangUp();
      toast.info("No answer — call ended automatically");
    }
  }, [ringDuration]);

  /* ── Signal helper ──────────────────────────────────────── */
  const sendSignal = (userId, payload) => {
    const ch = supabase.channel(`calls:${userId}`, { config: { broadcast: { ack: false } } });
    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      ch.send({ type: "broadcast", event: "signal", payload });
      setTimeout(() => supabase.removeChannel(ch), 2000);
    });
  };

  /* ── Hang up ────────────────────────────────────────────── */
  const hangUp = async () => {
    const call     = activeCall || pendingCall;
    const targetId = pendingCall?.toUser?.id || activeCall?.withUser?.id;
    const chatId   = call?.chatId;
    const callType = call?.callType;
    const duration = callDuration;

    if (targetId) sendSignal(targetId, { type: "call-end", from: currentUser.id, duration, callType });

    if (activeCall && chatId) {
      await saveCallEvent(chatId, { callType, status: "ended", duration, initiatorId: currentUser.id });
    }
    clearCall();
  };

  /* ── Reject incoming ────────────────────────────────────── */
  const rejectCall = () => {
    if (incomingCall?.fromUser?.id)
      sendSignal(incomingCall.fromUser.id, { type: "call-reject", from: currentUser.id });
    clearCall();
  };

  /* ── Accept incoming ────────────────────────────────────── */
  const acceptCall = async () => {
    if (!incomingCall) return;
    const { fromUser, callType, offer, chatId } = incomingCall;
    try {
      const localStream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      const remoteStream = new MediaStream();
      const peer         = new RTCPeerConnection(ICE);

      localStream.getTracks().forEach((t) => peer.addTrack(t, localStream));
      peer.ontrack = (e) => e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));

      const ch    = supabase.channel(`calls:${fromUser.id}`, { config: { broadcast: { ack: false } } });
      const queue = [];
      let ready   = false;

      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        const p = { type: "ice-candidate", from: currentUser.id, candidate: e.candidate.toJSON() };
        ready ? ch.send({ type: "broadcast", event: "signal", payload: p }) : queue.push(p);
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        ready = true;
        await ch.send({
          type: "broadcast", event: "signal",
          payload: { type: "answer", from: currentUser.id, answer: { type: answer.type, sdp: answer.sdp } },
        });
        for (const p of queue) ch.send({ type: "broadcast", event: "signal", payload: p });
        queue.length = 0;
      });

      setSignalCh(ch);
      setActiveCall({ withUser: fromUser, callType, peer, localStream, remoteStream, chatId });
    } catch (err) {
      console.error("acceptCall:", err);
      clearCall();
    }
  };

  /* ── Controls ───────────────────────────────────────────── */
  const toggleMute = () => {
    activeCall?.localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((v) => !v);
  };

  const toggleCamera = () => {
    activeCall?.localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsCamOff((v) => !v);
  };

  const flipCamera = async () => {
    const peer = activeCall?.peer;
    if (!peer) return;
    const newFacing = facingMode === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
        audio: false,
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false })
      );
      const track = stream.getVideoTracks()[0];
      const sndr  = peer.getSenders().find((s) => s.track?.kind === "video");
      if (sndr) await sndr.replaceTrack(track);
      if (localVideoRef.current)
        localVideoRef.current.srcObject = new MediaStream([track, ...activeCall.localStream.getAudioTracks()]);
      setFacingMode(newFacing);
    } catch {
      toast.error("Could not flip camera");
    }
  };

  const toggleScreenShare = async () => {
    const peer = activeCall?.peer;
    if (!peer) return;
    try {
      if (isScreenShare) {
        const cam   = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        const track = cam.getVideoTracks()[0];
        const sndr  = peer.getSenders().find((s) => s.track?.kind === "video");
        if (sndr) {
          await sndr.replaceTrack(track);
          if (localVideoRef.current)
            localVideoRef.current.srcObject = new MediaStream([track, ...activeCall.localStream.getAudioTracks()]);
        }
        setIsScreenShare(false);
      } else {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
        const track  = screen.getVideoTracks()[0];
        const sndr   = peer.getSenders().find((s) => s.track?.kind === "video");
        if (sndr) {
          await sndr.replaceTrack(track);
          if (localVideoRef.current)
            localVideoRef.current.srcObject = new MediaStream([track, ...activeCall.localStream.getAudioTracks()]);
        }
        track.onended = async () => {
          try {
            const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
            const ct  = cam.getVideoTracks()[0];
            const snd = peer.getSenders().find((s) => s.track?.kind === "video");
            if (snd) await snd.replaceTrack(ct);
            if (localVideoRef.current)
              localVideoRef.current.srcObject = new MediaStream([ct, ...activeCall.localStream.getAudioTracks()]);
          } catch (e) { console.error("restoreCamera:", e); }
          setIsScreenShare(false);
        };
        setIsScreenShare(true);
      }
    } catch (e) {
      console.error("screenShare:", e);
    }
  };

  /* ── Guard ──────────────────────────────────────────────── */
  if (!incomingCall && !pendingCall && !activeCall) return null;

  const callType = (activeCall || pendingCall || incomingCall)?.callType;
  const isVideo  = callType === "video";
  const withUser = activeCall?.withUser || pendingCall?.toUser || incomingCall?.fromUser;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="callOverlay">
      {/* Always-mounted audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />
      <div className={`callModal${isVideo && activeCall ? " callVideoActive" : ""}`}>

        {/* ── ACTIVE CALL ────────────────────────────────── */}
        {activeCall ? (
          <>
            {isVideo ? (
              <div className="videoArea">
                <video ref={remoteVideoRef} autoPlay playsInline className="remoteVid" />
                <video ref={localVideoRef}  autoPlay playsInline muted className="localPip" />
                <div className="vidOverlayInfo">
                  <span className="cName">{withUser?.username}</span>
                  <span className="cTimer">{fmt(callDuration)}</span>
                </div>
              </div>
            ) : (
              <div className="audioArea">
                <div className="cAvatarWrap">
                  <img src={withUser?.avatar || "./avatar.png"} className="cAvatar cAvatarActive" alt="" />
                </div>
                <h3 className="cName">{withUser?.username}</h3>
                <span className="cTimer">{fmt(callDuration)}</span>
              </div>
            )}

            <div className="callControls">
              <button className={`ctrlBtn${isMuted ? " ctrlOff" : ""}`} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                <MicIcon off={isMuted} />
                <span>{isMuted ? "Unmute" : "Mute"}</span>
              </button>

              {isVideo && (
                <>
                  <button className={`ctrlBtn${isCamOff ? " ctrlOff" : ""}`} onClick={toggleCamera} title="Toggle camera">
                    <CamIcon off={isCamOff} />
                    <span>{isCamOff ? "Start cam" : "Stop cam"}</span>
                  </button>
                  <button className="ctrlBtn" onClick={flipCamera} title="Flip camera">
                    <FlipIcon />
                    <span>Flip</span>
                  </button>
                  <button className={`ctrlBtn${isScreenShare ? " ctrlActive" : ""}`} onClick={toggleScreenShare} title="Share screen">
                    <ScreenIcon />
                    <span>{isScreenShare ? "Stop share" : "Share"}</span>
                  </button>
                </>
              )}

              <button className="ctrlBtn ctrlEnd" onClick={hangUp} title="End call">
                <PhoneOffIcon />
                <span>End</span>
              </button>
            </div>
          </>

        ) : pendingCall ? (
          /* ── OUTGOING (RINGING) ──────────────────────── */
          <div className="callStatus">
            <p className="callTypeLabel">{isVideo ? "Video call" : "Voice call"}</p>
            <div className="cAvatarWrap cAvatarPulse">
              <img src={withUser?.avatar || "./avatar.png"} className="cAvatar" alt="" />
            </div>
            <h3 className="cName">{withUser?.username}</h3>
            <p className="cStatusText">
              Ringing… <span className="cTimer">{fmt(ringDuration)}</span>
            </p>
            <button className="endRoundBtn" onClick={hangUp} title="Cancel call">
              <PhoneOffIcon size={24} />
            </button>
            <span className="endBtnLabel">Cancel</span>
          </div>

        ) : (
          /* ── INCOMING ────────────────────────────────── */
          <div className="callStatus">
            <p className="callTypeLabel">
              Incoming {isVideo ? "video" : "voice"} call
            </p>
            <div className="cAvatarWrap cAvatarRing">
              <img src={withUser?.avatar || "./avatar.png"} className="cAvatar" alt="" />
            </div>
            <h3 className="cName">{withUser?.username}</h3>
            <div className="incomingBtns">
              <div className="incomingBtnWrap">
                <button className="roundBtn roundBtnRed" onClick={rejectCall} title="Decline">
                  <PhoneOffIcon size={26} />
                </button>
                <span>Decline</span>
              </div>
              <div className="incomingBtnWrap">
                <button className="roundBtn roundBtnGreen" onClick={acceptCall} title="Accept">
                  <PhoneIcon size={26} />
                </button>
                <span>Accept</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
