import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Pause,
  Volume2,
  Download,
  Copy,
  Check,
  MessageSquare,
  Search,
  Edit3,
} from 'lucide-react';
import { VoiceSettings, VideoTranslationResult, VideoSignSegment } from '../types';
import { speechManager, soundEffects } from '../services/speechSynthesis';
import { Mascot } from './Mascot';
import {
  handTracker,
  drawHandSkeleton,
  TrackedHand,
} from '../services/handTracking';

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
  const [colorTheme, setColorTheme] = useState<'neonCyan' | 'emerald' | 'amber'>('emerald');
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
        grad.addColorStop(0, '#131f24');
        grad.addColorStop(1, '#1a2a31');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 360);

        // Signer avatar silhouette
        ctx.fillStyle = '#37464f';
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(20, 20, 600, 48);
        ctx.fillStyle = '#b4c1c8';
        ctx.font = '800 16px Nunito, sans-serif';
        ctx.fillText(`Demo signer · ${signName}`, 35, 50);

        ctx.fillStyle = '#6f8590';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(`${timeSec.toFixed(1)}s`, 480, 50);

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

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const transcriptText = editedText || translationResult?.fullTranslation || '';
  const words = translationResult?.wordCount ?? transcriptText.split(/\s+/).filter(Boolean).length;
  const confidenceWord: Record<string, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
  const resetVideo = () => {
    speechManager.stop();
    setVideoFile(null);
    setVideoUrl(null);
    setTranslationResult(null);
    setEditedText('');
    setIsEditingTranscript(false);
    setCurrentTime(0);
  };
  const exports: [string, () => void][] = [
    ['Plain text (.txt)', handleDownloadTXT],
    ['Markdown (.md)', handleDownloadMD],
    ['Subtitles (.srt)', handleDownloadSRT],
    ['Web captions (.vtt)', handleDownloadVTT],
    ['Data (.json)', handleDownloadJSON],
  ];

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSelectFile(f);
          e.target.value = '';
        }}
      />

      <header className="max-w-2xl">
        <h1 className="text-[2.25rem] sm:text-[2.75rem] font-black leading-[1.05]">Video</h1>
        <p className="mt-2 text-ink-2 font-bold text-[1.0625rem]">
          Translate a recording of someone signing into a written transcript, captions, and a spoken voiceover.
        </p>
      </header>

      {errorMsg && (
        <p role="alert" className="mt-6 rounded-2xl px-5 py-4 font-extrabold text-alert bg-[#ffdfe0] dark:bg-[#3a1d1f]">
          {errorMsg}
        </p>
      )}

      {!videoUrl ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="lg:col-span-8 rounded-[20px] border-2 border-dashed border-rule-strong bg-sunk min-h-[360px] flex flex-col items-center justify-center text-center px-6 py-12"
          >
            <span className="w-20 h-20 rounded-[22px] bg-[#f3e1ff] dark:bg-[#3a2a4a] inline-flex items-center justify-center mb-5">
              <Upload className="w-10 h-10 text-[#ce82ff]" strokeWidth={2.5} />
            </span>
            <p className="text-[1.5rem] font-black">Drop a video here</p>
            <p className="mt-1 text-ink-3 font-bold text-[0.9375rem]">MP4, WebM or MOV. Shorter clips translate faster.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="btn btn-signer">
                Choose a video
              </button>
              <button onClick={handleLoadDemoVideo} className="btn btn-line">
                Use a demo clip
              </button>
            </div>
          </div>
          <dl className="lg:col-span-4 flex flex-col gap-3">
            {[
              ['A transcript', 'The whole video as readable text, which you can correct before sharing.'],
              ['Captions', 'Timed subtitles you can export as .srt or .vtt.'],
              ['A voiceover', 'Each sign spoken aloud in time with the video.'],
            ].map(([t, d], i) => (
              <div key={t} className="tile flex gap-4 p-4">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-sun text-white font-black inline-flex items-center justify-center">{i + 1}</span>
                <div>
                  <dt className="font-black text-ink">{t}</dt>
                  <dd className="text-ink-2 font-bold text-[0.9375rem] mt-0.5">{d}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Player */}
          <div className="lg:col-span-6 min-w-0 flex flex-col gap-4">
            <figure className="relative m-0 w-full aspect-video rounded-[20px] overflow-hidden bg-[var(--stage)] text-white border-2 border-b-4 border-[var(--stage)]">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  lastSpokenSegmentRef.current = null;
                }}
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none object-contain" />
              {showSubtitles && activeSubtitle && (
                <figcaption className="absolute bottom-14 inset-x-0 text-center px-6 pointer-events-none">
                  <span className="text-[1.25rem] sm:text-[1.5rem] font-extrabold leading-snug px-3 py-1 rounded-lg bg-black/70 [box-decoration-break:clone]">
                    {activeSubtitle.spokenText}
                  </span>
                </figcaption>
              )}
              {isProcessing && <div className="reading-line" aria-hidden="true" />}
            </figure>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink-3 truncate min-w-0">
                {videoFile?.name ?? 'Demo clip'}
                {videoDuration > 0 && <span className="tnum"> · {fmt(videoDuration)}</span>}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 font-bold text-ink-2">
                  <button role="switch" aria-checked={showSubtitles} onClick={() => setShowSubtitles(!showSubtitles)} className="switch scale-[0.8] origin-right" />
                  Captions
                </label>
                <label className="flex items-center gap-2 font-bold text-ink-2">
                  <button role="switch" aria-checked={showSkeleton} onClick={() => setShowSkeleton(!showSkeleton)} className="switch scale-[0.8] origin-right" />
                  Hand outline
                </label>
              </div>
            </div>

            {!translationResult && (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleTranslateVideo} disabled={isProcessing} className="btn btn-signer !min-h-[3.25rem] !px-7 !text-base">
                  {isProcessing ? 'Translating…' : 'Translate video'}
                </button>
                <button onClick={resetVideo} disabled={isProcessing} className="btn btn-quiet">
                  Choose a different video
                </button>
              </div>
            )}

            {isProcessing && (
              <div aria-live="polite">
                <div className="progress">
                  <span style={{ width: `${Math.max(6, processingProgress)}%` }} />
                </div>
                <p className="mt-2 text-sm font-bold text-ink-2 flex justify-between gap-4">
                  <span>{processingStep}</span>
                  <span className="tnum text-ink-3">{Math.round(processingProgress)}%</span>
                </p>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="lg:col-span-6 min-w-0">
            {!translationResult ? (
              <div className="sheet p-7 text-ink-2">
                <div className="flex items-center gap-4">
                  <Mascot size={64} mood={isProcessing ? 'thinking' : 'happy'} className="bob shrink-0" />
                  <div className="bubble font-extrabold text-ink">
                    {isProcessing ? 'Watching closely…' : 'Ready when you are! Tap Translate video.'}
                  </div>
                </div>
                <p className="mt-5 font-bold text-[0.9375rem]">
                  GestureVoice samples the video, reads each sign in order, and stitches them into sentences.
                  This usually takes under a minute.
                </p>
              </div>
            ) : (
              <div className="sheet overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-3 border-b-2 border-rule">
                  <nav aria-label="Result views" className="flex gap-2 overflow-x-auto">
                    {([
                      ['transcript', 'Transcript'],
                      ['timeline', 'By sign'],
                      ['gloss', 'ASL gloss'],
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id);
                          setIsEditingTranscript(false);
                        }}
                        aria-current={activeTab === id || (id === 'transcript' && activeTab === 'editor') ? 'page' : undefined}
                        className="chip"
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  <div className="relative flex items-center">
                    <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="btn btn-sm btn-quiet" aria-expanded={exportMenuOpen}>
                      <Download className="w-4 h-4" /> Export
                    </button>
                    {exportMenuOpen && (
                      <ul className="absolute right-0 top-12 z-20 w-56 sheet border-b-4 py-2">
                        {exports.map(([label, fn]) => (
                          <li key={label}>
                            <button
                              onClick={() => {
                                fn();
                                setExportMenuOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-sunk"
                            >
                              {label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {(activeTab === 'transcript' || activeTab === 'editor') && (
                  <div className="p-5 sm:p-6">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-ink-3 tnum">
                      {words} words ·{' '}
                      {translationResult.engine === 'gemini-multimodal'
                        ? confidenceWord[translationResult.confidence] ?? translationResult.confidence
                        : 'Offline guess'}
                    </p>
                    {translationResult.engine !== 'gemini-multimodal' && (
                      <p className="mt-3 rounded-xl bg-sunk px-4 py-3 text-sm font-bold text-ink-2">
                        The AI didn’t finish in time, so this transcript comes from hand-shape tracking alone. Check it before you share it.
                      </p>
                    )}
                    {isEditingTranscript ? (
                      <>
                        <label htmlFor="transcript-edit" className="sr-only">
                          Edit transcript
                        </label>
                        <textarea
                          id="transcript-edit"
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          rows={8}
                          className="field !py-3 mt-3 said !text-[1.25rem] leading-snug resize-y"
                        />
                        <div className="mt-3 flex gap-2">
                          <button onClick={handleSaveEditedTranscript} className="btn btn-sm btn-ink">
                            Save changes
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingTranscript(false);
                              setEditedText(translationResult.fullTranslation);
                            }}
                            className="btn btn-sm btn-quiet"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="said text-[1.5rem] sm:text-[1.75rem] leading-[1.3] mt-3 text-ink">{transcriptText}</p>
                    )}
                    {translationResult.summary && !isEditingTranscript && (
                      <p className="mt-5 text-[0.9375rem] font-bold text-ink-2 rounded-xl bg-sunk px-4 py-3">{translationResult.summary}</p>
                    )}
                    {!isEditingTranscript && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        <button onClick={handlePlayFullAudio} className="btn btn-sm btn-signer">
                          {isSpeakingAudio ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          {isSpeakingAudio ? 'Stop' : 'Speak transcript'}
                        </button>
                        <button
                          onClick={() => {
                            setEditedText(transcriptText);
                            setIsEditingTranscript(true);
                          }}
                          className="btn btn-sm btn-line"
                        >
                          <Edit3 className="w-4 h-4" /> Correct
                        </button>
                        <button onClick={handleCopyText} className="btn btn-sm btn-line">
                          {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedText ? 'Copied' : 'Copy'}
                        </button>
                        {onSendToConversation && (
                          <button
                            onClick={() => onSendToConversation(transcriptText, translationResult.aslGloss)}
                            className="btn btn-sm btn-line"
                          >
                            <MessageSquare className="w-4 h-4" /> Add to conversation
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div>
                    <div className="p-4 border-b-2 border-rule">
                      <div className="relative">
                        <Search className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Find a word or sign"
                          aria-label="Find a word or sign"
                          className="field !pl-10 !min-h-11 text-sm"
                        />
                      </div>
                    </div>
                    <ol className="max-h-[460px] overflow-y-auto scroll-quiet">
                      {filteredSegments.map((seg) => {
                        const active = translationResult.segments[activeSegmentIndex ?? -1]?.id === seg.id;
                        return (
                          <li key={seg.id} className="border-b-2 border-rule last:border-0">
                            <button
                              onClick={() => handlePlaySegmentAudio(seg)}
                              className={`w-full text-left grid grid-cols-[3.5rem_1fr] gap-3 px-5 py-3.5 transition-colors ${
                                active ? 'bg-partner-soft' : 'hover:bg-sunk'
                              }`}
                            >
                              <span className="tnum text-sm font-extrabold text-partner-ink pt-1">{fmt(seg.startTime)}</span>
                              <span>
                                <span className="said block text-[1.1875rem] text-ink">
                                  {seg.spokenText}
                                  {speakingSegmentId === seg.id && (
                                    <span className="speak-bars ml-2 text-signer align-middle" aria-label="speaking">
                                      <i />
                                      <i />
                                      <i />
                                    </span>
                                  )}
                                </span>
                                <span className="block text-sm font-bold text-ink-3 mt-0.5">
                                  {seg.signName.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                                  {seg.meaning && !/^ASL sign\b/i.test(seg.meaning) ? ` — ${seg.meaning}` : ''}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {filteredSegments.length === 0 && (
                        <li className="px-5 py-10 text-center text-ink-3 text-sm">Nothing matches “{searchQuery}”.</li>
                      )}
                    </ol>
                  </div>
                )}

                {activeTab === 'gloss' && (
                  <div className="p-5 sm:p-6">
                    <p className="text-sm text-ink-2">
                      Gloss writes each sign as an English word in capitals, in signing order. It shows what was signed, not how it translates.
                    </p>
                    <p className="mt-4 rounded-xl bg-sunk px-4 py-3 font-mono text-[1.0625rem] leading-relaxed tracking-wide text-ink">{translationResult.aslGloss}</p>
                    <button onClick={() => navigator.clipboard.writeText(translationResult.aslGloss)} className="btn btn-sm btn-line mt-5">
                      <Copy className="w-4 h-4" /> Copy gloss
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t-2 border-rule">
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    <button role="switch" aria-checked={syncVoiceover} onClick={() => setSyncVoiceover(!syncVoiceover)} className="switch scale-[0.8] origin-left" />
                    Speak along with the video
                  </label>
                  <button onClick={resetVideo} className="btn btn-sm btn-quiet -mr-2">
                    Start over
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
