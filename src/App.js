import logo from './images/gluefactory_logo_RGB_black.png'; 
import React, { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isMono, setIsMono] = useState(false);
  const [renderHack, setRenderHack] = useState(0); // 👈 used to trigger re-render
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoRef = useRef();
  const audioRef = useRef();
  const audioContextRef = useRef();
  const sourceNodeRef = useRef();
  const stereoGainRef = useRef();
  const monoGainRef = useRef();
  const analyzerRef = useRef();

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;

    // Reset analysis state
    setAnalysisResult(null);
    setIsAnalyzing(false);

    // Clean up old audio nodes first
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (stereoGainRef.current) {
      stereoGainRef.current.disconnect();
      stereoGainRef.current = null;
    }
    if (monoGainRef.current) {
      monoGainRef.current.disconnect();
      monoGainRef.current = null;
    }
    if (analyzerRef.current) {
      analyzerRef.current.disconnect();
      analyzerRef.current = null;
    }

    // Pause and reset old media elements
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    // Force media elements to be recreated by setting refs to null
    // This will cause React to create new DOM elements
    videoRef.current = null;
    audioRef.current = null;

    // Revoke previous URL to free memory
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }

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

    // Create audio context once if it doesn't exist
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    let mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
    if (!mediaElement) return;

    // Don't mute the media element by default — let user control it
    // mediaElement.muted = true; // removed to allow audio playback

    // Disconnect previous sourceNode if it exists
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Create new source node
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

    // Connect sourceNode to stereoGain by default
    sourceNode.connect(stereoGain);
    stereoGain.connect(audioContext.destination);
    setIsMono(false);

    mediaElement.play();

    // Cleanup: disconnect nodes but DO NOT close audio context
    return () => {
      if (mediaElement) {
        mediaElement.pause();
        mediaElement.src = "";
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (stereoGainRef.current) {
        stereoGainRef.current.disconnect();
        stereoGainRef.current = null;
      }
      if (monoGainRef.current) {
        monoGainRef.current.disconnect();
        monoGainRef.current = null;
      }
      if (analyzerRef.current) {
        analyzerRef.current.disconnect();
        analyzerRef.current = null;
      }
    };
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

  const analyzeStereo = async () => {
    if (!audioContextRef.current || !sourceNodeRef.current) {
      alert("Please load an audio/video file first");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Resume audio context if suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const audioContext = audioContextRef.current;
      const sourceNode = sourceNodeRef.current;

      // Create analyzer node for measuring signal
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzer.smoothingTimeConstant = 0.8;
      analyzerRef.current = analyzer;

      // Create channel splitter to separate left and right
      const splitter = audioContext.createChannelSplitter(2);
      
      // Create gain nodes for left and right channels
      const leftGain = audioContext.createGain();
      const rightGain = audioContext.createGain();
      
      // Invert the right channel (phase cancellation)
      rightGain.gain.value = -1;
      leftGain.gain.value = 1;
      
      // Create merger to sum the channels
      const merger = audioContext.createChannelMerger(1);
      
      // Connect the chain: source -> splitter -> gains -> merger -> analyzer
      sourceNode.disconnect();
      sourceNode.connect(splitter);
      splitter.connect(leftGain, 0);
      splitter.connect(rightGain, 1);
      leftGain.connect(merger, 0, 0);
      rightGain.connect(merger, 0, 0);
      merger.connect(analyzer);
      
      // Don't connect to destination - we just want to analyze
      
      // Get the media element and restart it for analysis
      let mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
      const currentTime = mediaElement.currentTime;
      mediaElement.currentTime = 0;
      mediaElement.play();

      // Analyze the signal for a few seconds
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let totalEnergy = 0;
      let sampleCount = 0;
      const analysisDuration = 3000; // 3 seconds
      const startTime = Date.now();

      const analyzeFrame = () => {
        if (Date.now() - startTime > analysisDuration) {
          // Analysis complete
          const averageEnergy = totalEnergy / sampleCount;
          const threshold = 5; // Lowered threshold for more sensitive detection
          
          // Improved confidence calculation
          let confidence;
          if (averageEnergy > threshold) {
            // Stereo detected - confidence based on how much above threshold
            const stereoStrength = Math.min(averageEnergy / 20, 1); // Normalize to 0-1
            confidence = Math.round(80 + (stereoStrength * 20)); // 80-100% range
          } else {
            // Mono detected - confidence based on how close to zero
            const monoStrength = Math.max(0, 1 - (averageEnergy / threshold));
            confidence = Math.round(80 + (monoStrength * 20)); // 80-100% range
          }
          
          const result = {
            isStereo: averageEnergy > threshold,
            averageEnergy: averageEnergy,
            threshold: threshold,
            confidence: confidence
          };
          
          setAnalysisResult(result);
          setIsAnalyzing(false);
          
          // Restore original playback
          mediaElement.pause();
          mediaElement.currentTime = currentTime;
          
          // Restore original connections
          sourceNode.disconnect();
          if (isMono) {
            sourceNode.connect(monoGainRef.current);
            monoGainRef.current.connect(audioContext.destination);
          } else {
            sourceNode.connect(stereoGainRef.current);
            stereoGainRef.current.connect(audioContext.destination);
          }
          
          return;
        }

        analyzer.getByteFrequencyData(dataArray);
        
        // Calculate RMS (Root Mean Square) of the signal
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        totalEnergy += rms;
        sampleCount++;

        requestAnimationFrame(analyzeFrame);
      };

      analyzeFrame();

    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisResult({ error: "Analysis failed" });
      setIsAnalyzing(false);
    }
  };

  const toggleMono = async () => {
    if (!audioContextRef.current) return;

    // Resume audio context if suspended (for autoplay policies)
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (!sourceNodeRef.current) return;

    // Disconnect existing connections
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
          key={fileUrl} // Force recreation of element
          ref={videoRef}
          src={fileUrl}
          controls
          style={{ maxWidth: "100%" }}
        />
      )}

      {fileUrl && fileType === "audio" && (
        <audio
          key={fileUrl} // Force recreation of element
          ref={audioRef}
          src={fileUrl}
          controls
          style={{ width: "100%" }}
        />
      )}

      {fileUrl && (
        <button
          onClick={toggleMono}
          style={{ 
            marginTop: "20px", 
            padding: "10px",
            backgroundColor: "#000000",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            width: "200px"
          }}
        >
          {isMono ? "Switch to Stereo" : "Switch to Mono"}
        </button>
      )}

      {/* Analyze button */}
      {fileUrl && (
        <button
          onClick={analyzeStereo}
          disabled={isAnalyzing}
          style={{ 
            marginTop: "10px", 
            padding: "10px",
            backgroundColor: isAnalyzing ? "#ccc" : "#000000",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isAnalyzing ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            width: "200px"
          }}
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Stereo Content"}
        </button>
      )}

      {/* Analysis progress */}
      {isAnalyzing && (
        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <p>Analyzing stereo content...</p>
          <div style={{ 
            width: "100%", 
            height: "4px", 
            backgroundColor: "#f0f0f0", 
            borderRadius: "2px",
            overflow: "hidden"
          }}>
            <div style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#0070f3",
              animation: "pulse 1.5s ease-in-out infinite"
            }}></div>
          </div>
        </div>
      )}

      {/* Analysis results */}
      {analysisResult && !analysisResult.error && (
        <div style={{ 
          marginTop: "20px", 
          padding: "15px", 
          backgroundColor: analysisResult.isStereo ? "#e8f5e8" : "#fff3cd",
          border: `2px solid ${analysisResult.isStereo ? "#28a745" : "#ffc107"}`,
          borderRadius: "8px",
          textAlign: "left"
        }}>
          <h3 style={{ 
            margin: "0 0 10px 0", 
            color: analysisResult.isStereo ? "#155724" : "#856404"
          }}>
            {analysisResult.isStereo ? "✅ Stereo Content Detected" : "🔍 Effectively Mono"}
          </h3>
          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            <strong>Result:</strong> {analysisResult.isStereo ? 
              "This audio contains true stereo information" : 
              "This audio is effectively mono (phase cancellation successful)"
            }
          </p>
          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            <strong>Confidence:</strong> {analysisResult.confidence}%
          </p>
          <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>
            <strong>Technical:</strong> Average energy: {analysisResult.averageEnergy.toFixed(2)} 
            (threshold: {analysisResult.threshold})
          </p>
        </div>
      )}

      {analysisResult && analysisResult.error && (
        <div style={{ 
          marginTop: "20px", 
          padding: "15px", 
          backgroundColor: "#f8d7da",
          border: "2px solid #dc3545",
          borderRadius: "8px",
          color: "#721c24"
        }}>
          <h3 style={{ margin: "0 0 10px 0" }}>❌ Analysis Failed</h3>
          <p>{analysisResult.error}</p>
        </div>
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
