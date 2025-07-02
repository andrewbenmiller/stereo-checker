import logo from './images/gluefactory_logo_RGB_black.png'; 
import React, { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isMono, setIsMono] = useState(false);
  const [renderHack, setRenderHack] = useState(0); // 👈 used to trigger re-render

  const videoRef = useRef();
  const audioRef = useRef();
  const audioContextRef = useRef();
  const sourceNodeRef = useRef();
  const stereoGainRef = useRef();
  const monoGainRef = useRef();

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setFileUrl(url);

    if (file.type.startsWith("video")) {
      setFileType("video");
    } else if (file.type.startsWith("audio")) {
      setFileType("audio");
    } else {
      alert("Unsupported file type");
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  useEffect(() => {
    if (!fileUrl) return;

    // Clean up old context if switching files
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = audioContext;

    let mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
    if (!mediaElement) return;

    mediaElement.muted = true;

    const sourceNode = audioContext.createMediaElementSource(mediaElement);
    sourceNodeRef.current = sourceNode;

    const stereoGain = audioContext.createGain();
    stereoGain.gain.value = 1;
    stereoGainRef.current = stereoGain;

    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(1);
    const leftGain = audioContext.createGain();
    const rightGain = audioContext.createGain();

    leftGain.gain.value = 0.5;
    rightGain.gain.value = 0.5;

    splitter.connect(leftGain, 0);
    splitter.connect(rightGain, 1);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 0);

    monoGainRef.current = merger;

    sourceNode.connect(stereoGain);
    stereoGain.connect(audioContext.destination);
    setIsMono(false);

    mediaElement.play();
  }, [fileUrl, fileType]);

  const resumeAudioContext = async () => {
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      await audioContextRef.current.resume();
      setRenderHack((v) => v + 1); // force re-render
    }
  };

  const toggleMono = async () => {
  // Resume audio context if suspended (for autoplay policies)
  if (audioContextRef.current.state === "suspended") {
    await audioContextRef.current.resume();
  }

  if (!sourceNodeRef.current) return;

  // Disconnect any existing connections to destination
  sourceNodeRef.current.disconnect();

  if (isMono) {
    // Switch to Stereo
    sourceNodeRef.current.connect(stereoGainRef.current);
    stereoGainRef.current.connect(audioContextRef.current.destination);
    setIsMono(false);
  } else {
    // Switch to Mono
    sourceNodeRef.current.connect(monoGainRef.current);
    monoGainRef.current.connect(audioContextRef.current.destination);
    setIsMono(true);
  }
};



  return (
    <div className="App">
     <img src={logo} alt="Logo" className="app-logo" />
  <h1>Stereo Checker</h1>

      <div
  className="drag-drop-area"
  onDrop={handleDrop}
  onDragOver={handleDragOver}
>
  <p>Drag & drop audio or video file here</p>
</div>

      {fileUrl && fileType === "video" && (
        <video
          ref={videoRef}
          src={fileUrl}
          controls
          style={{ maxWidth: "100%" }}
        />
      )}

      {fileUrl && fileType === "audio" && (
        <audio
          ref={audioRef}
          src={fileUrl}
          controls
          style={{ width: "100%" }}
        />
      )}

      {fileUrl && (
        <button
          onClick={toggleMono}
          style={{ marginTop: "20px", padding: "10px" }}
        >
          {isMono ? "Switch to Stereo" : "Switch to Mono"}
        </button>
      )}

      {fileUrl &&
        audioContextRef.current &&
        audioContextRef.current.state === "suspended" && (
          <button
            onClick={resumeAudioContext}
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Start Audio
          </button>
        )}
    </div>
  );
}

export default App;
