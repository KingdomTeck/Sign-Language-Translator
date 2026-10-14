import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Video as VideoIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Clock,
  CheckCircle2,
  FileText,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Check,
  MessageSquare,
  AlertTriangle,
  Activity,
  Layers,
  Wand2,
  Search,
  Maximize2,
  Minimize2,
  Edit3,
  Save,
  AlignLeft,
  FileCode,
  Type,
  X,
  BookOpen,
} from 'lucide-react';
import { VoiceSettings, VideoTranslationResult, VideoSignSegment } from '../types';
import { speechManager, soundEffects } from '../services/speechSynthesis';
import {
  handTracker,
  drawHandSkeleton,
  TrackedHand,
} from '../services/handTracking';
import { AnimatedVideo, AnimatedSpeaker, AnimatedSparkles } from './AnimatedIcons';

interface VideoTranslatorProps {
  voiceSettings: VoiceSettings;
  isMuted: boolean;
  onSendToConversation?: (text: string, gestureName: string) => void;
  highContrast?: boolean;
}

export const VideoTranslator: React.FC<VideoTranslatorProps> = ({
  voiceSettings,
  isMuted,
  onSendToConversation,
  highContrast = false,
}) => {
  // Video and canvas refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Translation & processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [translationResult, setTranslationResult] = useState<VideoTranslationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Transcript view modes & provisions
  const [activeTab, setActiveTab] = useState<'transcript' | 'timeline' | 'gloss' | 'editor'>('transcript');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>('');
  const [isReaderModalOpen, setIsReaderModalOpen] = useState<boolean>(false);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  // Audio state
  const [isSpeakingAudio, setIsSpeakingAudio] = useState<boolean>(false);
  const [speakingSegmentId, setSpeakingSegmentId] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(true);
  const [syncVoiceover, setSyncVoiceover] = useState<boolean>(true);
  const lastSpokenSegmentRef = useRef<string | null>(null);

  // Overlay state
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [colorTheme, setColorTheme] = useState<'neonCyan' | 'emerald' | 'amber'>('neonCyan');
  const [currentTrackedHand, setCurrentTrackedHand] = useState<TrackedHand | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Initialize hand tracker on component mount
  useEffect(() => {
    handTracker.initialize().catch(() => {});
  }, []);

  // Subscribe to speech synthesis state
  useEffect(() => {
    const unsub = speechManager.subscribeSpeaking((speaking) => {
      setIsSpeakingAudio(speaking);
      if (!speaking) {
        setSpeakingSegmentId(null);
      }
    });
    return () => unsub();
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      speechManager.stop();
    };
  }, [videoUrl]);

  // Handle file selection
  const handleSelectFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please select a valid video file (MP4, WebM, MOV, etc.)');
      return;
    }

    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setTranslationResult(null);
    setErrorMsg(null);
    setCurrentTime(0);
    setIsPlaying(false);
    lastSpokenSegmentRef.current = null;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  // Generate a realistic synthetic demo video for quick preview with 4 distinct signs
  const handleLoadDemoVideo = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], 'asl_conversation_demo.webm', { type: 'video/webm' });
        handleSelectFile(file);
      };

      mediaRecorder.start();

      let frameCount = 0;
      const totalFrames = 180; // 6.0 seconds at 30fps

      const drawDemoFrame = () => {
        if (!ctx) return;
        frameCount++;

        // Draw background
        const grad = ctx.createLinearGradient(0, 0, 640, 360);
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 360);

        // Signer avatar silhouette
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(320, 110, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(320, 260, 90, 100, 0, 0, Math.PI * 2);
        ctx.fill();

        // Animated hand making signs
        const timeSec = frameCount / 30;
        let signName = 'HELLO (Wave)';
        let handX = 380;
        let handY = 140;

        if (timeSec < 1.5) {
          signName = 'HELLO / WAVE';
          handX = 390 + Math.sin(frameCount * 0.3) * 20;
          handY = 130 + Math.cos(frameCount * 0.1) * 10;
        } else if (timeSec < 3.0) {
          signName = 'NICE TO MEET YOU';
          handX = 350 + Math.sin(frameCount * 0.25) * 15;
          handY = 145 + Math.sin(frameCount * 0.2) * 10;
        } else if (timeSec < 4.5) {
          signName = 'THANK YOU';
          handX = 320 + Math.sin(frameCount * 0.2) * 10;
          handY = 150 + (frameCount % 30) * 1.5;
        } else {
          signName = 'I LOVE YOU';
          handX = 340;
          handY = 160 + Math.sin(frameCount * 0.15) * 8;
        }

        // Draw hand skin tone
        ctx.fillStyle = '#f6d8b8';
        ctx.beginPath();
        ctx.ellipse(handX, handY, 28, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fingers
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.ellipse(handX + i * 10, handY - 30, 6, 18, (i * 0.15), 0, Math.PI * 2);
          ctx.fill();
        }

        // Overlay text banner
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(20, 20, 600, 48);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`ASL Signer Simulation: ${signName}`, 35, 50);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(`Time: ${timeSec.toFixed(1)}s / 6.0s`, 480, 50);

        if (frameCount < totalFrames) {
          requestAnimationFrame(drawDemoFrame);
        } else {
          mediaRecorder.stop();
        }
      };

      drawDemoFrame();
    } catch {
      setErrorMsg('Could not initialize demo recorder. Please upload a standard video file.');
    }
  };

  // Video element playback synchronization and hand landmark tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // If synchronized voiceover is enabled and translation result exists
    if (syncVoiceover && translationResult && !isMuted) {
      const activeSeg = translationResult.segments.find(
        (s) => time >= s.startTime && time <= s.endTime
      );
      if (activeSeg && activeSeg.id !== lastSpokenSegmentRef.current && activeSeg.spokenText) {
        lastSpokenSegmentRef.current = activeSeg.id;
        speechManager.speak(activeSeg.spokenText, voiceSettings);
      }
    }
  };

  // Real-time animation loop for tracking overlay during video playback
  const renderTrackingFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showSkeleton) {
        const tracked = handTracker.detect(video, performance.now(), ctx);
        if (tracked && tracked.landmarks) {
          setCurrentTrackedHand(tracked);
          drawHandSkeleton(ctx, tracked.landmarks, canvas.width, canvas.height, {
            showSkeleton: true,
            showPoints: true,
            showGestureBadge: true,
            gesture: tracked.gesture,
            colorTheme,
          });
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(renderTrackingFrame);
  }, [showSkeleton, colorTheme]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(renderTrackingFrame);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, renderTrackingFrame]);

  // Main Action: Process and Translate the Uploaded Video
  const handleTranslateVideo = async () => {
    if (!videoRef.current || !videoUrl) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProcessingProgress(5);
    setProcessingStep('Preparing video stream & temporal intervals...');

    const video = videoRef.current;
    const duration = video.duration || videoDuration || 5;

    try {
      soundEffects.playDetectChime(voiceSettings.soundEffects);

      // Create offscreen canvas for extracting high-clarity, lightweight keyframes
      const extractCanvas = document.createElement('canvas');
      extractCanvas.width = 480;
      extractCanvas.height = 270;
      const ctx = extractCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create frame extraction context');

      // Sample keyframes across entire duration (1 frame every ~0.8-1.2s, min 6, up to 18 frames)
      const sampleFps = duration > 20 ? 0.75 : 1.25;
      const numFrames = Math.min(18, Math.max(6, Math.round(duration * sampleFps)));
      const step = duration / (numFrames + 1);
      const frames: any[] = [];
      const clientDetectedSegments: any[] = [];

      // Save initial video playback position
      const initialTime = video.currentTime;
      video.pause();

      for (let i = 1; i <= numFrames; i++) {
        try {
          const targetTime = i * step;
          setProcessingStep(`Sampling frame ${i}/${numFrames} at ${targetTime.toFixed(1)}s across full video...`);
          setProcessingProgress(10 + Math.round((i / numFrames) * 55));

          // Safe seek with race timeout so it never hangs or freezes
          video.currentTime = targetTime;
          await new Promise((resolve) => {
            let resolved = false;
            const timer = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                video.removeEventListener('seeked', onSeeked);
                resolve(true);
              }
            }, 350);

            const onSeeked = () => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                video.removeEventListener('seeked', onSeeked);
                resolve(true);
              }
            };
            video.addEventListener('seeked', onSeeked);
          });

          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, extractCanvas.width, extractCanvas.height);
          const dataUrl = extractCanvas.toDataURL('image/jpeg', 0.7);

          // Run client hand tracking on frame for high accuracy landmark classification
          let gestureHint: any = null;
          try {
            const tracked = handTracker.detect(extractCanvas, targetTime * 1000, ctx);
            if (tracked && tracked.gesture && tracked.gesture.id !== 'standby') {
              gestureHint = tracked.gesture;
              clientDetectedSegments.push({
                timeSec: targetTime,
                signName: tracked.gesture.name.toUpperCase().replace(/\s+/g, '_'),
                spokenText: tracked.gesture.spokenText,
                confidence: tracked.gesture.confidence,
                thumbnail: dataUrl,
                fingerStates: tracked.gesture.fingerStates,
              });
            }
          } catch {
            // Hand tracking fallback continues safely
          }

          frames.push({
            timeSec: targetTime,
            image: dataUrl,
            gesture: gestureHint,
          });
        } catch (frameErr) {
          console.warn(`Frame ${i} extraction step skipped:`, frameErr);
        }
      }

      // Restore video position
      video.currentTime = initialTime;

      setProcessingStep('Analyzing complete sign sequence & generating whole text transcript...');
      setProcessingProgress(75);

      // Call backend /api/translate-video
      const response = await fetch('/api/translate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          videoDuration: duration,
          fileName: videoFile?.name || 'Uploaded Sign Video',
          detectedSegments: clientDetectedSegments,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      setProcessingProgress(92);
      setProcessingStep('Synthesizing speech & preparing whole text transcript...');

      const result: VideoTranslationResult = await response.json();
      setTranslationResult(result);
      setEditedText(result.fullTranslation);
      setActiveTab('transcript'); // Default to whole transcript view
      setProcessingProgress(100);

      soundEffects.playPartnerChime(voiceSettings.soundEffects);

      // Auto-play translated audio if requested
      if (autoPlayAudio && !isMuted && result.fullTranslation) {
        speechManager.speak(result.fullTranslation, voiceSettings);
      }
    } catch (err: any) {
      console.error('Video translation error:', err);
      setErrorMsg(err.message || 'Failed to translate video. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Audio Playback Controls
  const handlePlayFullAudio = () => {
    const textToSpeak = editedText || translationResult?.fullTranslation;
    if (!textToSpeak) return;
    if (isSpeakingAudio) {
      speechManager.stop();
    } else {
      speechManager.speak(textToSpeak, voiceSettings);
    }
  };

  const handlePlaySegmentAudio = (segment: VideoSignSegment) => {
    if (!segment.spokenText) return;
    speechManager.stop();
    setSpeakingSegmentId(segment.id);
    speechManager.speak(segment.spokenText, voiceSettings, () => {
      setSpeakingSegmentId(null);
    });

    // Also seek video to this segment
    if (videoRef.current) {
      videoRef.current.currentTime = segment.startTime;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Copy full transcript text to clipboard
  const handleCopyText = () => {
    const textToCopy = editedText || translationResult?.fullTranslation;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Save in-place edited transcript
  const handleSaveEditedTranscript = () => {
    if (!translationResult) return;
    const wordCount = editedText.split(/\s+/).filter(Boolean).length;
    const charCount = editedText.length;
    const estimatedReadingTimeSec = Math.max(2, Math.round(wordCount / 2.5));

    const updatedResult: VideoTranslationResult = {
      ...translationResult,
      fullTranslation: editedText,
      wordCount,
      charCount,
      estimatedReadingTimeSec,
      wholeTranscript: {
        ...(translationResult.wholeTranscript || {
          continuousText: editedText,
          wordCount,
          charCount,
          estimatedReadingTimeSec,
          timedLines: [],
        }),
        continuousText: editedText,
        wordCount,
        charCount,
        estimatedReadingTimeSec,
      },
    };
    setTranslationResult(updatedResult);
    setIsEditingTranscript(false);
    setActiveTab('transcript');
  };

  // Export functions for whole transcript
  const formatTimeHMS = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const formatVTTTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  const handleDownloadTXT = () => {
    if (!translationResult) return;
    const title = videoFile?.name || 'Sign Language Video';
    const content = `======================================================================
GESTUREVOICE - FULL SIGN LANGUAGE VIDEO TRANSCRIPT
======================================================================
Video File: ${title}
Duration: ${translationResult.duration.toFixed(1)} seconds
Date Translated: ${new Date(translationResult.translatedAt).toLocaleString()}
Engine: ${translationResult.engine === 'gemini-multimodal' ? 'Gemini Multimodal Vision AI' : '21-Landmark Gesture Engine'}
Words: ${translationResult.wordCount || translationResult.fullTranslation.split(/\s+/).length}
Estimated Speech Time: ~${translationResult.estimatedReadingTimeSec || 10} seconds

======================================================================
WHOLE CONTINUOUS TRANSCRIPT (PROSE):
======================================================================
"${translationResult.fullTranslation}"

======================================================================
ASL GLOSS NOTATION:
======================================================================
${translationResult.aslGloss}

======================================================================
TIMECODED LINE-BY-LINE TRANSCRIPT:
======================================================================
${translationResult.segments
  .map(
    (s, idx) =>
      `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] Line ${idx + 1} (${s.signName}): "${s.spokenText}"`
  )
  .join('\n')}

======================================================================
End of GestureVoice Transcript
======================================================================
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\.[^/.]+$/, '')}_whole_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadMD = () => {
    if (!translationResult) return;
    const title = videoFile?.name || 'Sign Language Video';
    const content = `# Sign Language Video Transcript

- **File**: \`${title}\`
- **Duration**: ${translationResult.duration.toFixed(1)} seconds
- **Words**: ${translationResult.wordCount || translationResult.fullTranslation.split(/\s+/).length}
- **Date**: ${new Date(translationResult.translatedAt).toLocaleString()}
- **Engine**: ${translationResult.engine}

## Whole Continuous Transcript

> "${translationResult.fullTranslation}"

## ASL Gloss Notation

\`\`\`
${translationResult.aslGloss}
\`\`\`

## Timeline Breakdown

| Time Range | ASL Sign | Spoken Translation | Confidence |
|---|---|---|---|
${translationResult.segments
  .map(
    (s) =>
      `| ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s | \`${s.signName}\` | ${s.spokenText} | ${s.confidence} |`
  )
  .join('\n')}
`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\.[^/.]+$/, '')}_transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadSRT = () => {
    if (!translationResult || !translationResult.segments.length) return;
    let srtContent = '';
    translationResult.segments.forEach((seg, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${formatTimeHMS(seg.startTime)} --> ${formatTimeHMS(seg.endTime)}\n`;
      srtContent += `${seg.spokenText}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoFile?.name ? videoFile.name.replace(/\.[^/.]+$/, '') : 'sign_translation'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadVTT = () => {
    if (!translationResult || !translationResult.segments.length) return;
    let vttContent = 'WEBVTT - GestureVoice Sign Language Transcript\n\n';
    translationResult.segments.forEach((seg, idx) => {
      vttContent += `${idx + 1}\n`;
      vttContent += `${formatVTTTime(seg.startTime)} --> ${formatVTTTime(seg.endTime)}\n`;
      vttContent += `${seg.spokenText}\n\n`;
    });

    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoFile?.name ? videoFile.name.replace(/\.[^/.]+$/, '') : 'sign_translation'}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleDownloadJSON = () => {
    if (!translationResult) return;
    const blob = new Blob([JSON.stringify(translationResult, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoFile?.name ? videoFile.name.replace(/\.[^/.]+$/, '') : 'sign_translation'}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // Currently active subtitle for overlay
  const activeSubtitle = translationResult?.segments.find(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  // Active segment index for real-time transcript highlighting
  const activeSegmentIndex = translationResult?.segments.findIndex(
    (s) => currentTime >= s.startTime && currentTime <= s.endTime
  );

  // Filtered segments for search in timeline view
  const filteredSegments = useMemo(() => {
    if (!translationResult?.segments) return [];
    if (!searchQuery.trim()) return translationResult.segments;
    const q = searchQuery.toLowerCase();
    return translationResult.segments.filter(
      (s) =>
        s.spokenText.toLowerCase().includes(q) ||
        s.signName.toLowerCase().includes(q) ||
        (s.meaning && s.meaning.toLowerCase().includes(q))
    );
  }, [translationResult, searchQuery]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Top Header Card */}
      <div className="p-6 sm:p-7 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-white/15 flex items-center justify-center text-purple-300 shadow-[0_4px_16px_rgba(168,85,247,0.2)] group">
            <AnimatedVideo className="w-6 h-6 text-purple-300" active={isPlaying || isProcessing} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-[-0.02em]">
                Video Sign Language Translator
              </h2>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs text-purple-400 font-medium">
                Full-Duration
              </span>
            </div>
            <p className="text-xs text-slate-300/80 mt-1 max-w-xl leading-relaxed">
              Upload any sign language video to translate the entire timeline into a continuous text transcript, timecoded captions, and spoken audio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch md:self-auto shrink-0 relative z-10">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(147,51,234,0.3)] transition-all apple-press cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Select Video</span>
          </button>

          <button
            onClick={handleLoadDemoVideo}
            className="px-4 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium border border-white/[0.08] transition-all flex items-center gap-2 apple-press cursor-pointer"
            title="Generate a pre-made sign language demo video clip for instant testing"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-300" />
            <span>Load Demo Video</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleSelectFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {/* Main Grid: Video Viewport & Whole Transcript Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Video Viewport */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative rounded-3xl liquid-glass-card border border-white/[0.08] overflow-hidden shadow-2xl flex flex-col aspect-video bg-black">
            {videoUrl ? (
              <>
                <div className="magic-border-beam" />
                {/* UIverse HUD Targeting Corner Brackets */}
                <div className="uiverse-hud-corner-tl" />
                <div className="uiverse-hud-corner-tr" />
                <div className="uiverse-hud-corner-bl" />
                <div className="uiverse-hud-corner-br" />

                {/* HTML5 Video Element */}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain bg-black"
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={(e) => {
                    const dur = (e.target as HTMLVideoElement).duration;
                    setVideoDuration(dur);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => {
                    setIsPlaying(false);
                    lastSpokenSegmentRef.current = null;
                  }}
                />

                {/* Hand Tracking Canvas Overlay */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                />

                {/* Subtitle Closed-Captions Overlay */}
                {showSubtitles && activeSubtitle && (
                  <div className="absolute bottom-16 left-4 right-4 flex justify-center pointer-events-none">
                    <div className="px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/[0.12] text-center shadow-2xl animate-fade-in max-w-lg">
                      <span className="text-white text-sm sm:text-base font-bold tracking-tight drop-shadow">
                        "{activeSubtitle.spokenText}"
                      </span>
                      <div className="text-[10px] text-purple-300 font-mono mt-0.5">
                        ASL: {activeSubtitle.signName} • [{activeSubtitle.startTime.toFixed(1)}s - {activeSubtitle.endTime.toFixed(1)}s]
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Video HUD Info Bar */}
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-xl text-xs font-mono tabular-nums text-white border border-white/[0.08]">
                    {currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
                  </span>
                  {currentTrackedHand?.gesture && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 backdrop-blur-xl text-xs font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{currentTrackedHand.gesture.name}</span>
                    </span>
                  )}
                </div>

                {/* Video Controls Bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 flex flex-col gap-2.5 backdrop-blur-sm">
                  {/* Scrub Slider */}
                  <input
                    type="range"
                    min="0"
                    max={videoDuration || 100}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCurrentTime(val);
                      if (videoRef.current) {
                        videoRef.current.currentTime = val;
                      }
                    }}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!videoRef.current) return;
                          if (isPlaying) {
                            videoRef.current.pause();
                          } else {
                            videoRef.current.play();
                          }
                        }}
                        className="p-2 rounded-xl bg-white/[0.12] hover:bg-white/[0.2] text-white transition-all apple-press cursor-pointer"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 fill-white" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (!videoRef.current) return;
                          videoRef.current.currentTime = 0;
                          setCurrentTime(0);
                        }}
                        className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white transition-all apple-press cursor-pointer"
                        title="Replay from start"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1 ml-1 bg-white/[0.08] rounded-xl p-0.5 border border-white/[0.06]">
                        {[0.5, 1.0, 1.25].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => {
                              setPlaybackRate(rate);
                              if (videoRef.current) {
                                videoRef.current.playbackRate = rate;
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all apple-press ${
                              playbackRate === rate
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle Subtitles */}
                      <button
                        onClick={() => setShowSubtitles(!showSubtitles)}
                        className={`p-2 rounded-xl transition-all apple-press cursor-pointer ${
                          showSubtitles
                            ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-sm'
                            : 'bg-white/[0.08] text-slate-400 hover:text-white'
                        }`}
                        title="Toggle Video Captions Overlay"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Skeleton */}
                      <button
                        onClick={() => setShowSkeleton(!showSkeleton)}
                        className={`p-2 rounded-xl transition-all apple-press cursor-pointer ${
                          showSkeleton
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'bg-white/[0.08] text-slate-400 hover:text-white'
                        }`}
                        title="Toggle 21 3D Hand Landmarks Skeleton Overlay"
                      >
                        {showSkeleton ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Drag and Drop Zone */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.03] transition-all border-2 border-dashed border-white/[0.12] hover:border-purple-400/40 rounded-3xl group"
              >
                <div className="w-16 h-16 rounded-3xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform mb-4 shadow-[0_4px_16px_rgba(168,85,247,0.2)]">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1 tracking-tight">
                  Drag and drop a sign language video
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                  Supports MP4, WebM, MOV, and AVI. Evaluates signs frame-by-frame and produces full continuous voice and transcript.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-semibold shadow-md apple-press">
                    Browse Video
                  </span>
                  <span className="text-xs text-slate-500">or</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadDemoVideo();
                    }}
                    className="px-3.5 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-medium border border-white/[0.08] apple-press"
                  >
                    Load Sample Video
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Button: Translate Full Video */}
          {videoUrl && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleTranslateVideo}
                disabled={isProcessing}
                className={`uiverse-glow-btn flex-1 py-3 px-5 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(147,51,234,0.35)] transition-all cursor-pointer ${
                  isProcessing
                    ? 'bg-purple-950/60 cursor-not-allowed text-purple-300 border border-purple-800/60'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-purple-300" />
                    <span>Analyzing Video Timeline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Translate Full Video to Text & Voice</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setVideoFile(null);
                  setVideoUrl(null);
                  setTranslationResult(null);
                  setCurrentTime(0);
                }}
                className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-medium border border-white/[0.08] apple-press cursor-pointer"
                title="Change or reset video"
              >
                Reset
              </button>
            </div>
          )}

          {/* Processing Progress Status */}
          {isProcessing && (
            <div className="p-5 rounded-3xl apple-glass-card border border-purple-500/30 flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-200 font-medium">{processingStep}</span>
                <span className="text-purple-300 font-mono font-bold">
                  {processingProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-sky-400 transition-all duration-300 rounded-full"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Extracting 3D hand coordinates across the full timeline to ensure no part of the translation is missed.
              </p>
            </div>
          )}

          {/* Error Message Display */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block text-red-300 mb-0.5">Translation Notice</span>
                {errorMsg}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Whole Text Transcript Provision & Translation Suite */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {translationResult ? (
            <div className="flex flex-col gap-4">
              {/* Primary Audio Vocalization Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/50 to-slate-900 border border-purple-500/30 flex flex-col gap-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                      Spoken Voice Output
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-900/60 text-purple-200 border border-purple-700/50">
                    {translationResult.engine === 'gemini-multimodal'
                      ? 'Gemini Multimodal'
                      : 'Landmark AI Engine'}
                  </span>
                </div>

                <button
                  onClick={handlePlayFullAudio}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isSpeakingAudio
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {isSpeakingAudio ? 'Speaking Voice (Tap to Stop)' : 'Listen to Full Audio'}
                  </span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncVoiceover}
                      onChange={(e) => setSyncVoiceover(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-purple-600"
                    />
                    <span>Sync Voice during video playback</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlayAudio}
                      onChange={(e) => setAutoPlayAudio(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-purple-600"
                    />
                    <span>Auto-speak</span>
                  </label>
                </div>
              </div>

              {/* DEDICATED PROVISION: WHOLE TEXT TRANSCRIPT CONTAINER */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
                {/* Provision Tabs Header */}
                <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => {
                        setActiveTab('transcript');
                        setIsEditingTranscript(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        activeTab === 'transcript'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Whole Transcript</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('timeline');
                        setIsEditingTranscript(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        activeTab === 'timeline'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Sign Timeline</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-900/60 text-purple-200">
                        {translationResult.segments.length}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('gloss');
                        setIsEditingTranscript(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        activeTab === 'gloss'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>ASL Gloss</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Fullscreen Reader Modal Trigger */}
                    <button
                      onClick={() => setIsReaderModalOpen(true)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-all"
                      title="Expand to Fullscreen Focus Reader"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* In-place Edit Button */}
                    <button
                      onClick={() => {
                        if (isEditingTranscript) {
                          handleSaveEditedTranscript();
                        } else {
                          setIsEditingTranscript(true);
                          setActiveTab('editor');
                        }
                      }}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        isEditingTranscript
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title={isEditingTranscript ? 'Save Transcript Edits' : 'Edit Transcript Text'}
                    >
                      {isEditingTranscript ? (
                        <Save className="w-3.5 h-3.5" />
                      ) : (
                        <Edit3 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Provision Content Area based on Active Tab */}
                <div className="p-4 flex flex-col gap-3.5">
                  {/* TAB 1: WHOLE TEXT TRANSCRIPT (CONTINUOUS PROSE WITH REALTIME HIGHLIGHTING) */}
                  {activeTab === 'transcript' && !isEditingTranscript && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      {/* Whole Transcript Metrics Banner */}
                      <div className="flex items-center justify-between text-[11px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-slate-400 font-mono">
                        <div className="flex items-center gap-3">
                          <span>
                            Words:{' '}
                            <strong className="text-white">
                              {translationResult.wordCount ||
                                translationResult.fullTranslation.split(/\s+/).length}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Duration:{' '}
                            <strong className="text-purple-300">
                              {translationResult.duration.toFixed(1)}s
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Signs:{' '}
                            <strong className="text-emerald-400">
                              {translationResult.segments.length}
                            </strong>
                          </span>
                        </div>
                        <span className="text-slate-400">
                          ~{translationResult.estimatedReadingTimeSec || 8}s read
                        </span>
                      </div>

                      {/* Continuous Whole Text Transcript Box */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3 max-h-[360px] overflow-y-auto">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/70">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <AlignLeft className="w-3.5 h-3.5 text-purple-400" />
                            <span>Complete Video Transcript</span>
                          </span>
                          <span className="text-[10px] text-purple-400">
                            Click any phrase to jump video
                          </span>
                        </div>

                        {/* Interactive sentence-by-sentence continuous prose */}
                        <div className="text-sm sm:text-base leading-relaxed text-slate-200 font-normal">
                          {translationResult.segments && translationResult.segments.length > 0 ? (
                            translationResult.segments.map((seg, idx) => {
                              const isActive = activeSegmentIndex === idx;
                              return (
                                <span
                                  key={seg.id || idx}
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = seg.startTime;
                                      videoRef.current.play();
                                      setIsPlaying(true);
                                    }
                                  }}
                                  className={`cursor-pointer px-1 py-0.5 rounded transition-all inline ${
                                    isActive
                                      ? 'bg-purple-600 text-white font-semibold ring-2 ring-purple-400 shadow-md'
                                      : 'hover:bg-slate-800 hover:text-white'
                                  }`}
                                  title={`Seek to ${seg.startTime.toFixed(1)}s (${seg.signName})`}
                                >
                                  {seg.spokenText}{' '}
                                </span>
                              );
                            })
                          ) : (
                            <p className="italic text-white">
                              "{translationResult.fullTranslation}"
                            </p>
                          )}
                        </div>

                        {/* Summary & Signer Intent */}
                        {translationResult.summary && (
                          <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                            <span className="font-semibold text-slate-300 block mb-0.5">
                              Transcript Overview:
                            </span>
                            {translationResult.summary}
                          </div>
                        )}
                      </div>

                      {/* Transcript Actions & Export Suite */}
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyText}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700"
                          >
                            {copiedText ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied Transcript!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Whole Text</span>
                              </>
                            )}
                          </button>

                          {onSendToConversation && (
                            <button
                              onClick={() =>
                                onSendToConversation(
                                  translationResult.fullTranslation,
                                  translationResult.aslGloss
                                )
                              }
                              className="py-1.5 px-3 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-all border border-indigo-700/50"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Send to Chat</span>
                            </button>
                          )}
                        </div>

                        {/* Export Dropdown Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                            className="py-1.5 px-3 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-semibold flex items-center gap-1.5 border border-purple-700/60 transition-all"
                          >
                            <Download className="w-3.5 h-3.5 text-purple-400" />
                            <span>Export Transcript</span>
                          </button>

                          {exportMenuOpen && (
                            <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl p-1.5 z-30 flex flex-col gap-1">
                              <button
                                onClick={handleDownloadTXT}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-950/80 hover:text-white flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-400" />
                                <span>Plain Text (.txt)</span>
                              </button>
                              <button
                                onClick={handleDownloadMD}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-950/80 hover:text-white flex items-center gap-2"
                              >
                                <AlignLeft className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Markdown (.md)</span>
                              </button>
                              <button
                                onClick={handleDownloadSRT}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-950/80 hover:text-white flex items-center gap-2"
                              >
                                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Subtitles (.srt)</span>
                              </button>
                              <button
                                onClick={handleDownloadVTT}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-950/80 hover:text-white flex items-center gap-2"
                              >
                                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                                <span>WebVTT (.vtt)</span>
                              </button>
                              <button
                                onClick={handleDownloadJSON}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-950/80 hover:text-white flex items-center gap-2"
                              >
                                <Layers className="w-3.5 h-3.5 text-amber-400" />
                                <span>JSON Data (.json)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SIGN TIMELINE (INTERACTIVE CHRONOLOGICAL SEGMENTS) */}
                  {activeTab === 'timeline' && !isEditingTranscript && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      {/* Search in Timeline */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search words or signs in transcript..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Segments List */}
                      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                        {filteredSegments.map((seg, idx) => {
                          const isCurrent =
                            currentTime >= seg.startTime && currentTime <= seg.endTime;
                          const isSpeakingThis = speakingSegmentId === seg.id;

                          return (
                            <div
                              key={seg.id || idx}
                              onClick={() => {
                                if (videoRef.current) {
                                  videoRef.current.currentTime = seg.startTime;
                                  setCurrentTime(seg.startTime);
                                  videoRef.current.play();
                                  setIsPlaying(true);
                                }
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isCurrent
                                  ? 'bg-purple-950/70 border-purple-500/70 shadow-md ring-1 ring-purple-500/40'
                                  : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono font-bold text-purple-300 shrink-0">
                                  {seg.startTime.toFixed(1)}s - {seg.endTime.toFixed(1)}s
                                </span>

                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-white">
                                    "{seg.spokenText}"
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    ASL: {seg.signName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlaySegmentAudio(seg);
                                  }}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    isSpeakingThis
                                      ? 'bg-emerald-500 text-white animate-pulse'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  }`}
                                  title="Play audio voice for this line"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {filteredSegments.length === 0 && (
                          <div className="text-center py-6 text-xs text-slate-500">
                            No phrases found matching "{searchQuery}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ASL GLOSS & NOTATION BREAKDOWN */}
                  {activeTab === 'gloss' && !isEditingTranscript && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                        <span className="text-xs font-semibold text-slate-300">
                          Standard ASL Gloss Notation:
                        </span>
                        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 font-mono text-emerald-300 text-xs sm:text-sm leading-relaxed select-all">
                          {translationResult.aslGloss}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          ASL gloss represents the direct syntactic structure of American Sign Language signs without English inflections.
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(translationResult.aslGloss);
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }}
                          className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ASL Gloss</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 4 / IN-PLACE EDITOR: EDIT & REFINE WHOLE TRANSCRIPT */}
                  {(activeTab === 'editor' || isEditingTranscript) && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Edit & Refine Whole Transcript Text</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {editedText.length} characters
                        </span>
                      </div>

                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        rows={6}
                        className="w-full p-3 rounded-xl bg-slate-950 border border-purple-500/40 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                        placeholder="Refine or add notes to the translation transcript..."
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditedText(translationResult.fullTranslation);
                            setIsEditingTranscript(false);
                            setActiveTab('transcript');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEditedTranscript}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Transcript</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Standby Card when no video has been translated yet */
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center gap-4 min-h-[350px]">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Ready to Translate Full Sign Video
                </h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Upload a video or click "Load Demo Video". The AI engine will track hand signs across the full timeline and produce a continuous text transcript and voice audio.
                </p>
              </div>

              <div className="w-full pt-4 border-t border-slate-800/80 flex flex-col gap-2 text-left text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Full continuous text transcript with word count & reading time</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Export as Plain Text (.txt), Markdown (.md), and Subtitles (.srt)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Synchronized spoken voice audio with real-time sentence highlight</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FULLSCREEN FOCUS READER MODAL FOR WHOLE TEXT TRANSCRIPT */}
      {isReaderModalOpen && translationResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-950 border border-purple-500/40 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Whole Sign Language Text Transcript
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {translationResult.duration.toFixed(1)}s duration •{' '}
                    {translationResult.wordCount || translationResult.fullTranslation.split(/\s+/).length} words
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Font Size Selector */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
                  <Type className="w-3 h-3 text-slate-400 ml-1" />
                  {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setReaderFontSize(sz)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        readerFontSize === sz
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsReaderModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Continuous Reading Text */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              <div
                className={`leading-relaxed text-slate-100 ${
                  readerFontSize === 'sm'
                    ? 'text-sm'
                    : readerFontSize === 'base'
                    ? 'text-base'
                    : readerFontSize === 'lg'
                    ? 'text-lg'
                    : 'text-xl'
                }`}
              >
                <p className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 shadow-inner leading-relaxed">
                  "{translationResult.fullTranslation}"
                </p>
              </div>

              {/* ASL Gloss Sequence in Modal */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="font-semibold text-purple-300 block mb-1">
                  ASL Notation Gloss:
                </span>
                <span className="font-mono text-emerald-400">{translationResult.aslGloss}</span>
              </div>

              {/* Timeline Lines in Modal */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Timecoded Sentence Progression:
                </span>
                <div className="flex flex-col gap-2">
                  {translationResult.segments.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-purple-300 text-[10px]">
                          {s.startTime.toFixed(1)}s - {s.endTime.toFixed(1)}s
                        </span>
                        <span className="text-white font-medium">"{s.spokenText}"</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {s.signName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={handlePlayFullAudio}
                className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow"
              >
                <Volume2 className="w-4 h-4" />
                <span>
                  {isSpeakingAudio ? 'Speaking Voice (Tap to Stop)' : 'Listen to Full Audio'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Whole Text</span>
                </button>
                <button
                  onClick={handleDownloadTXT}
                  className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
