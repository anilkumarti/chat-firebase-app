import { useEffect, useRef, useState } from "react";
import { useCallStore } from "../../lib/callStore";
import { useUserStore } from "../../lib/UserStore";
import { supabase } from "../../lib/Supabase";
import "./CallModal.css";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const CallModal = () => {
  const { incomingCall, pendingCall, activeCall, setSignalCh, setActiveCall, clearCall } =
    useCallStore();
  const { currentUser } = useUserStore();
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  useEffect(() => {
    if (activeCall?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.remoteStream]);

  useEffect(() => {
    const stream = (activeCall || pendingCall)?.localStream;
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [activeCall?.localStream, pendingCall?.localStream]);

  const sendTo = (userId, payload) => {
    const ch = supabase.channel(`calls:${userId}`, {
      config: { broadcast: { ack: false } },
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "signal", payload });
        setTimeout(() => supabase.removeChannel(ch), 2000);
      }
    });
  };

  const hangUp = () => {
    const targetId =
      pendingCall?.toUser?.id || activeCall?.withUser?.id || incomingCall?.fromUser?.id;
    if (targetId) sendTo(targetId, { type: "call-end", from: currentUser.id });
    clearCall();
  };

  const rejectCall = () => {
    if (incomingCall?.fromUser?.id)
      sendTo(incomingCall.fromUser.id, { type: "call-reject", from: currentUser.id });
    clearCall();
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const { fromUser, callType, offer } = incomingCall;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
      const remoteStream = new MediaStream();
      const peer = new RTCPeerConnection(ICE);
      localStream.getTracks().forEach((t) => peer.addTrack(t, localStream));
      peer.ontrack = (e) =>
        e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));

      const ch = supabase.channel(`calls:${fromUser.id}`, {
        config: { broadcast: { ack: false } },
      });
      const iceCandidateQueue = [];
      let chReady = false;

      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        const payload = { type: "ice-candidate", from: currentUser.id, candidate: e.candidate.toJSON() };
        if (chReady) {
          ch.send({ type: "broadcast", event: "signal", payload });
        } else {
          iceCandidateQueue.push(payload);
        }
      };

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        chReady = true;
        await ch.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "answer", from: currentUser.id, answer: { type: answer.type, sdp: answer.sdp } },
        });
        for (const p of iceCandidateQueue) {
          ch.send({ type: "broadcast", event: "signal", payload: p });
        }
        iceCandidateQueue.length = 0;
      });

      setSignalCh(ch);
      setActiveCall({ withUser: fromUser, callType, peer, localStream, remoteStream });
    } catch (err) {
      console.error("acceptCall:", err);
      clearCall();
    }
  };

  const toggleMute = () => {
    activeCall?.localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((v) => !v);
  };

  const toggleCamera = () => {
    activeCall?.localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsCamOff((v) => !v);
  };

  if (!incomingCall && !pendingCall && !activeCall) return null;

  const callType = (activeCall || pendingCall || incomingCall)?.callType;
  const isVideo = callType === "video";
  const withUser = activeCall?.withUser || pendingCall?.toUser || incomingCall?.fromUser;

  return (
    <div className="callOverlay">
      <div className={`callModal ${activeCall ? "callActive" : ""}`}>
        {activeCall ? (
          <>
            {isVideo ? (
              <div className="videoWrap">
                <video ref={remoteVideoRef} autoPlay playsInline className="remoteVid" />
                <video ref={localVideoRef} autoPlay playsInline muted className="localVid" />
              </div>
            ) : (
              <div className="audioCallInfo">
                <img src={withUser?.avatar || "./avatar.png"} alt="" className="callAvatar" />
                <h2>{withUser?.username}</h2>
                <span className="callStatusLabel">On call</span>
              </div>
            )}
            <div className="callControls">
              <button onClick={toggleMute} className={`callBtn ${isMuted ? "off" : ""}`} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? "🔇" : "🎤"}
              </button>
              {isVideo && (
                <button onClick={toggleCamera} className={`callBtn ${isCamOff ? "off" : ""}`} title="Toggle camera">
                  {isCamOff ? "📷" : "📹"}
                </button>
              )}
              <button onClick={hangUp} className="callBtn hangup" title="Hang up">📵</button>
            </div>
          </>
        ) : pendingCall ? (
          <div className="callStatus">
            <img src={withUser?.avatar || "./avatar.png"} alt="" className="callAvatar" />
            <h2>{withUser?.username}</h2>
            <span className="callStatusLabel">Calling… {isVideo ? "📹" : "📞"}</span>
            <button onClick={hangUp} className="callBtn hangup wide">📵 Hang Up</button>
          </div>
        ) : (
          <div className="callStatus">
            <img src={withUser?.avatar || "./avatar.png"} alt="" className="callAvatar" />
            <h2>{withUser?.username}</h2>
            <span className="callStatusLabel">
              Incoming {isVideo ? "video" : "voice"} call
            </span>
            <div className="incomingActions">
              <button onClick={rejectCall} className="callBtn decline wide">📵 Decline</button>
              <button onClick={acceptCall} className="callBtn accept wide">📞 Accept</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
