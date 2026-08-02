import { useEffect, useRef } from "react";
import "./CameraModal.css";

const CameraModal = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(onClose);
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) =>
        onCapture(
          new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" })
        ),
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="cameraOverlay" onClick={onClose}>
      <div className="cameraModal" onClick={(e) => e.stopPropagation()}>
        <video ref={videoRef} autoPlay playsInline />
        <div className="cameraControls">
          <button className="cam-cancel" onClick={onClose}>Cancel</button>
          <button className="cam-capture" onClick={capture}>📷 Capture</button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
