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
  const [analyzingSection, setAnalyzingSection] = useState(null);
  const [showLearnMore, setShowLearnMore] = useState(false);

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

  const handleTimeUpdate = () => {
    const mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
    if (mediaElement) {
      // This function can be used for custom time tracking if needed
    }
  };

  const handleLoadedMetadata = () => {
    const mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
    if (mediaElement) {
      // This function can be used for custom metadata handling if needed
    }
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
      let mediaElement = fileType === "video" ? videoRef.current : audioRef.current;
      
      // Get file duration
      const duration = mediaElement.duration;
      if (!duration || duration < 3) {
        alert("File is too short for comprehensive analysis. Need at least 3 seconds.");
        setIsAnalyzing(false);
        return;
      }

      // Define analysis points: beginning, middle, end
      const analysisPoints = [
        { name: "Beginning", time: 1 }, // 1 second in
        { name: "Middle", time: duration / 2 }, // Middle of file
        { name: "End", time: duration - 2 } // 2 seconds before end
      ];

      let totalEnergy = 0;
      let sampleCount = 0;
      const analysisDuration = 1000; // 1 second per sample
      const threshold = 5;

      // Analyze each section
      for (let i = 0; i < analysisPoints.length; i++) {
        const point = analysisPoints[i];
        setAnalyzingSection(point.name);
        
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
        
        // Seek to analysis point and play
        mediaElement.currentTime = point.time;
        mediaElement.play();

        // Analyze this section
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        let sectionEnergy = 0;
        let sectionSamples = 0;
        const startTime = Date.now();

        const analyzeSection = () => {
          if (Date.now() - startTime > analysisDuration) {
            // Section analysis complete
            const averageSectionEnergy = sectionEnergy / sectionSamples;
            totalEnergy += averageSectionEnergy;
            sampleCount++;
            
            // Clean up this section's nodes
            analyzer.disconnect();
            splitter.disconnect();
            leftGain.disconnect();
            rightGain.disconnect();
            merger.disconnect();
            
            // Move to next section or finish
            if (i < analysisPoints.length - 1) {
              // Continue to next section
              setTimeout(() => {
                // This will continue the loop
              }, 100);
            } else {
              // All sections analyzed
              const averageEnergy = totalEnergy / sampleCount;
              
              // Improved confidence calculation
              let confidence;
              if (averageEnergy > threshold) {
                // Stereo detected - confidence based on how much above threshold
                const stereoStrength = Math.min(averageEnergy / 20, 1);
                confidence = Math.round(80 + (stereoStrength * 20));
              } else {
                // Mono detected - confidence based on how close to zero
                const monoStrength = Math.max(0, 1 - (averageEnergy / threshold));
                confidence = Math.round(80 + (monoStrength * 20));
              }
              
              const result = {
                isStereo: averageEnergy > threshold,
                averageEnergy: averageEnergy,
                threshold: threshold,
                confidence: confidence,
                sectionsAnalyzed: analysisPoints.length
              };
              
              setAnalysisResult(result);
              setIsAnalyzing(false);
              
              // Restore original playback
              mediaElement.pause();
              mediaElement.currentTime = 0;
              
              // Restore original connections
              sourceNode.disconnect();
              if (isMono) {
                sourceNode.connect(monoGainRef.current);
                monoGainRef.current.connect(audioContext.destination);
              } else {
                sourceNode.connect(stereoGainRef.current);
                stereoGainRef.current.connect(audioContext.destination);
              }
            }
            return;
          }

          analyzer.getByteFrequencyData(dataArray);
          
          // Calculate RMS (Root Mean Square) of the signal
          let sum = 0;
          for (let j = 0; j < bufferLength; j++) {
            sum += dataArray[j] * dataArray[j];
          }
          const rms = Math.sqrt(sum / bufferLength);
          sectionEnergy += rms;
          sectionSamples++;

          requestAnimationFrame(analyzeSection);
        };

        analyzeSection();
        
        // Wait for this section to complete before moving to next
        await new Promise(resolve => setTimeout(resolve, analysisDuration + 200));
      }

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
      <div 
        onClick={() => window.location.reload()} 
        style={{ cursor: "pointer" }}
        title="Click to refresh page"
      >
        <img src={logo} alt="Logo" className="app-logo" />
      </div>
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
        <div style={{ 
          marginTop: "20px", 
          padding: "20px", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px",
          border: "2px solid #e9ecef"
        }}>
          <h3 style={{ margin: "0 0 15px 0", textAlign: "center" }}>Audio Player</h3>
          <audio
            key={fileUrl} // Force recreation of element
            ref={audioRef}
            src={fileUrl}
            controls
            style={{ 
              width: "100%", 
              height: "40px",
              borderRadius: "4px"
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
        </div>
      )}

      {/* Button container */}
      {fileUrl && (
        <div style={{ 
          marginTop: "20px", 
          display: "flex", 
          gap: "10px", 
          justifyContent: "center",
          flexWrap: "wrap"
        }}>
          {/* Analyze button */}
          <button
            onClick={analyzeStereo}
            disabled={isAnalyzing}
            style={{ 
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

          {/* Listen in Mono/Stereo button */}
          <button
            onClick={toggleMono}
            style={{ 
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
            {isMono ? "Listen in Stereo" : "Listen in Mono"}
          </button>
        </div>
      )}

      {/* Analysis progress */}
      {isAnalyzing && (
        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <p>Analyzing stereo content...</p>
          {analyzingSection && (
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
              Currently analyzing: <strong>{analyzingSection}</strong>
            </p>
          )}
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
          <p style={{ margin: "5px 0", fontSize: "12px", color: "#666" }}>
            <strong>Analysis:</strong> {analysisResult.sectionsAnalyzed} sections sampled (beginning, middle, end)
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

      {/* Learn more link */}
      <div style={{ 
        marginTop: "40px", 
        paddingTop: "20px", 
        borderTop: "1px solid #eee",
        textAlign: "center"
      }}>
        <button
          onClick={() => setShowLearnMore(!showLearnMore)}
          style={{
            background: "none",
            border: "none",
            color: "#000000",
            cursor: "pointer",
            fontSize: "14px",
            textDecoration: "underline"
          }}
        >
          {showLearnMore ? "Hide details" : "Learn more about stereo analysis →"}
        </button>
        
        {showLearnMore && (
          <div style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            textAlign: "left",
            fontSize: "14px",
            lineHeight: "1.6"
          }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>
              Understanding Stereo Analysis
            </h3>
            
            <p style={{ margin: "0 0 15px 0" }}>
              <strong>Phase Cancellation Technique:</strong> This tool uses a classic audio engineering method 
              to detect true stereo content. By inverting one channel and summing it with the other, we can 
              determine if audio is effectively mono or contains genuine stereo information.
            </p>
            
            <p style={{ margin: "0 0 15px 0" }}>
              <strong>Why This Matters:</strong> Many audio files appear stereo but are actually mono content 
              duplicated to both channels. True stereo content has different information in the left and right 
              channels, which creates spatial depth and width.
            </p>
            
            <p style={{ margin: "0 0 15px 0" }}>
              <strong>Multi-Section Analysis:</strong> Our tool samples from the beginning, middle, and end 
              of your audio file to provide comprehensive analysis. This catches stereo content that might only 
              appear in certain sections of your track.
            </p>
            
            <p style={{ margin: "0 0 0 0" }}>
              <strong>Preventing Mono-ization:</strong> There isn't a single point of failure, but here are some common issues to watch for:
            </p>
            
            <p style={{ margin: "10px 0 0 0", paddingLeft: "20px" }}>
              <strong>– Importing a Stereo Mix Incorrectly</strong><br/>
              If stereo audio is accidentally placed on two separate mono tracks, each channel (left and right) will default to center pan. This causes them to be summed at the master bus, collapsing the stereo image into mono and sending an identical signal through both sides of the stereo output.
            </p>
            
            <p style={{ margin: "10px 0 0 0", paddingLeft: "20px" }}>
              <strong>– Mismatched Output Settings</strong><br/>
              At the export or conform stage, avoid selecting "Dual Mono" or any output setting other than "Stereo." Always ensure the final output format matches the source media's channel configuration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
