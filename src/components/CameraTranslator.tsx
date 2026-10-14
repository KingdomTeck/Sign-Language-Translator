import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Play,
  Square,
  Sparkles,
  Volume2,
  Upload,
  HelpCircle,
  FlipHorizontal,
  Image as ImageIcon,
  MonitorPlay,
  CheckCircle2,
  Activity,
  Layers,
  Eye,
  EyeOff,
  Sliders,
} from 'lucide-react';
import { GestureTranslation, VoiceSettings } from '../types';
import { speechManager, soundEffects } from '../services/speechSynthesis';
import { QUICK_EMERGENCY_PHRASES } from '../data/aslDictionary';
import { SAMPLE_GESTURES, SampleGesture } from '../data/sampleGestures';
import {
  handTracker,
  drawHandSkeleton,
  TrackedHand,
  NormalizedLandmark,
  RecognizedHandGesture,
  classifyHandLandmarks,
} from '../services/handTracking';
import {
  AnimatedCamera,
  AnimatedHand,
  AnimatedRadarScanner,
  AnimatedSpeaker,
  AnimatedSparkles,
} from './AnimatedIcons';

interface CameraTranslatorProps {
  voiceSettings: VoiceSettings;
  isMuted: boolean;
  onNewTranslation: (translation: GestureTranslation) => void;
  practiceFocus: string | null;
  clearPracticeFocus: () => void;
  highContrast: boolean;
  onSwitchToVideoUpload?: () => void;
}

// Canonical 21 landmark templates for simulated virtual signs (normalized 0 to 1)
function generateLandmarksForSign(signId: string): NormalizedLandmark[] {
  const wrist: NormalizedLandmark = { x: 0.5, y: 0.85, z: 0 };
  const landmarks: NormalizedLandmark[] = new Array(21);
  landmarks[0] = wrist;

  const basePalmScale = 0.25;

  // Joint offsets for 5 fingers: [Thumb, Index, Middle, Ring, Pinky]
  const configs: Record<string, { ext: [boolean, boolean, boolean, boolean, boolean]; thumbUp?: boolean; thumbSpread?: boolean }> = {
    hello: { ext: [true, true, true, true, true], thumbSpread: true },
    thank_you: { ext: [false, true, true, true, true] },
    i_love_you: { ext: [true, true, false, false, true], thumbSpread: true },
    yes: { ext: [false, false, false, false, false] },
    peace: { ext: [false, true, true, false, false] },
    thumbs_up: { ext: [false, false, false, false, false], thumbUp: true },
    okay: { ext: [false, false, true, true, true] },
    call_me: { ext: [true, false, false, false, true], thumbSpread: true },
    pointing_one: { ext: [false, true, false, false, false] },
    water: { ext: [false, true, true, true, false] },
  };

  const currentCfg = configs[signId] || configs.hello;
  const spreads = [-0.18, -0.09, 0, 0.08, 0.16];

  for (let f = 0; f < 5; f++) {
    const isThumb = f === 0;
    const isExtended = currentCfg.ext[f];
    const baseIdx = 1 + f * 4;

    const angleSpread = spreads[f];
    const len = isThumb
      ? basePalmScale * (currentCfg.thumbUp ? 0.75 : 0.6)
      : isExtended
      ? basePalmScale * 1.05
      : basePalmScale * 0.42;

    const tipX = 0.5 + angleSpread + (isThumb && currentCfg.thumbSpread ? 0.12 : 0);
    const tipY = isThumb && currentCfg.thumbUp
      ? 0.85 - len * 1.2
      : 0.85 - len;

    for (let j = 0; j < 4; j++) {
      const frac = (j + 1) / 4;
      landmarks[baseIdx + j] = {
        x: wrist.x + (tipX - wrist.x) * frac,
        y: wrist.y + (tipY - wrist.y) * frac,
        z: Math.sin(j) * 0.015,
      };
    }
  }

  return landmarks;
}

// Interactive virtual hand models for simulation mode
interface VirtualSignModel {
  id: string;
  name: string;
  icon: string;
  spokenText: string;
  category: string;
  description: string;
  drawHand: (ctx: CanvasRenderingContext2D, t: number) => void;
}

const VIRTUAL_SIGNS: VirtualSignModel[] = [
  {
    id: 'hello',
    name: 'Hello / Wave',
    icon: '👋',
    spokenText: 'Hello there, nice to meet you!',
    category: 'greeting',
    description: 'Open flat palm waving gently near temple.',
    drawHand: (ctx, t) => {
      const waveAngle = Math.sin(t * 0.006) * 0.22;
      ctx.save();
      ctx.translate(320, 240);
      ctx.rotate(waveAngle);
      // Forearm & wrist
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(-24, 70, 48, 120, 16);
      ctx.fill();
      // Palm
      ctx.beginPath();
      ctx.roundRect(-42, -30, 84, 110, 24);
      ctx.fill();
      // Fingers
      const fingers = [
        { x: -34, y: -95, w: 16, h: 75 }, // pinky
        { x: -14, y: -115, w: 16, h: 95 }, // ring
        { x: 8, y: -125, w: 16, h: 105 },  // middle
        { x: 30, y: -110, w: 16, h: 90 },  // index
      ];
      fingers.forEach((f) => {
        ctx.beginPath();
        ctx.roundRect(f.x, f.y, f.w, f.h, 10);
        ctx.fill();
      });
      // Thumb
      ctx.beginPath();
      ctx.roundRect(40, -10, 22, 55, 10);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'i_love_you',
    name: 'I Love You',
    icon: '🤟',
    spokenText: 'I love you!',
    category: 'phrase',
    description: 'ASL ILY sign with thumb, index, and pinky extended.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Palm
      ctx.beginPath();
      ctx.roundRect(-38, -25, 76, 100, 22);
      ctx.fill();
      // Pinky extended
      ctx.beginPath();
      ctx.roundRect(-36, -105, 16, 85, 9);
      ctx.fill();
      // Curled middle & ring
      ctx.beginPath();
      ctx.roundRect(-16, -10, 16, 35, 8);
      ctx.roundRect(4, -10, 16, 35, 8);
      ctx.fill();
      // Index extended
      ctx.beginPath();
      ctx.roundRect(24, -120, 16, 100, 9);
      ctx.fill();
      // Thumb extended outward
      ctx.beginPath();
      ctx.roundRect(38, -5, 45, 18, 9);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'peace',
    name: 'Peace / V-Sign',
    icon: '✌️',
    spokenText: 'Peace and greetings!',
    category: 'universal',
    description: 'Index and middle fingers extended upward in V-shape.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Palm
      ctx.beginPath();
      ctx.roundRect(-36, -15, 72, 90, 20);
      ctx.fill();
      // Index finger angled right
      ctx.save();
      ctx.translate(14, -15);
      ctx.rotate(0.2);
      ctx.beginPath();
      ctx.roundRect(-8, -95, 16, 95, 8);
      ctx.fill();
      ctx.restore();
      // Middle finger angled left
      ctx.save();
      ctx.translate(-14, -15);
      ctx.rotate(-0.2);
      ctx.beginPath();
      ctx.roundRect(-8, -100, 16, 100, 8);
      ctx.fill();
      ctx.restore();
      // Curled ring & pinky
      ctx.beginPath();
      ctx.roundRect(-32, -5, 16, 32, 8);
      ctx.roundRect(-12, -5, 16, 32, 8);
      ctx.fill();
      // Thumb folded over
      ctx.beginPath();
      ctx.roundRect(-10, 10, 40, 18, 9);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'thumbs_up',
    name: 'Thumbs Up',
    icon: '👍',
    spokenText: 'Yes, that looks great!',
    category: 'phrase',
    description: 'Closed fist with upright thumb pointing upward.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Fist body
      ctx.beginPath();
      ctx.roundRect(-40, -15, 80, 80, 22);
      ctx.fill();
      // Thumb extended straight up
      ctx.beginPath();
      ctx.roundRect(-36, -95, 22, 90, 11);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'yes',
    name: 'Yes (Nodding Fist)',
    icon: '✊',
    spokenText: 'Yes, that is correct.',
    category: 'phrase',
    description: 'Closed S-fist bobbing up and down.',
    drawHand: (ctx, t) => {
      const nodOffset = Math.sin(t * 0.007) * 20;
      ctx.save();
      ctx.translate(320, 240 + nodOffset);
      ctx.fillStyle = '#f59e0b';
      // Fist
      ctx.beginPath();
      ctx.roundRect(-42, -35, 84, 85, 24);
      ctx.fill();
      // Curled finger lines
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-35, -5);
      ctx.lineTo(35, -5);
      ctx.moveTo(-35, 18);
      ctx.lineTo(35, 18);
      ctx.stroke();
      // Thumb wrapped across front
      ctx.beginPath();
      ctx.roundRect(-32, -18, 64, 22, 10);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'thank_you',
    name: 'Thank You',
    icon: '🙏',
    spokenText: 'Thank you very much!',
    category: 'phrase',
    description: 'Flat open hand moving outward from chin toward partner.',
    drawHand: (ctx, t) => {
      const forwardOffset = (Math.sin(t * 0.005) + 1) * 30;
      ctx.save();
      ctx.translate(320, 220 + forwardOffset);
      ctx.fillStyle = '#f59e0b';
      // Palm
      ctx.beginPath();
      ctx.roundRect(-36, -30, 72, 90, 20);
      ctx.fill();
      // Fingers together flat
      [-26, -9, 8, 25].forEach((fx, i) => {
        ctx.beginPath();
        ctx.roundRect(fx, -110 + Math.abs(i - 1.5) * 8, 15, 90, 8);
        ctx.fill();
      });
      // Thumb alongside
      ctx.beginPath();
      ctx.roundRect(34, -15, 16, 50, 8);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'okay',
    name: 'Okay / Perfect',
    icon: '👌',
    spokenText: 'Okay, sounds perfect!',
    category: 'universal',
    description: 'Thumb and index forming circular pinch with three fingers extended.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Palm base
      ctx.beginPath();
      ctx.roundRect(-35, -15, 70, 85, 20);
      ctx.fill();
      // 3 Extended fingers (middle, ring, pinky)
      [-15, 6, 26].forEach((fx, i) => {
        ctx.beginPath();
        ctx.roundRect(fx, -105 + i * 8, 15, 95, 8);
        ctx.fill();
      });
      // Pinched loop (thumb + index)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(-22, -18, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'call_me',
    name: 'Call Me / Shaka',
    icon: '🤙',
    spokenText: 'Call me, or Letter Y.',
    category: 'universal',
    description: 'Thumb and pinky extended wide, three middle fingers curled.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Palm
      ctx.beginPath();
      ctx.roundRect(-35, -20, 70, 80, 20);
      ctx.fill();
      // Extended Pinky left
      ctx.beginPath();
      ctx.roundRect(-85, -25, 60, 18, 9);
      ctx.fill();
      // Extended Thumb right
      ctx.beginPath();
      ctx.roundRect(25, -25, 60, 18, 9);
      ctx.fill();
      // Curled middle 3 fingers
      ctx.beginPath();
      ctx.roundRect(-25, -45, 50, 30, 12);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'pointing_one',
    name: 'Number One / Pointing',
    icon: '☝️',
    spokenText: 'Excuse me, or number one.',
    category: 'number',
    description: 'Index finger pointing straight upward with other fingers closed.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Closed fist base
      ctx.beginPath();
      ctx.roundRect(-36, -20, 72, 85, 22);
      ctx.fill();
      // Index extended straight up
      ctx.beginPath();
      ctx.roundRect(-8, -120, 18, 105, 9);
      ctx.fill();
      // Thumb tucked over middle
      ctx.beginPath();
      ctx.roundRect(-25, 0, 45, 18, 9);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'water',
    name: 'Water (W-Sign)',
    icon: '💧',
    spokenText: 'Water, please.',
    category: 'survival',
    description: 'Index, middle, and ring fingers extended in W-handshape.',
    drawHand: (ctx) => {
      ctx.save();
      ctx.translate(320, 240);
      ctx.fillStyle = '#f59e0b';
      // Palm
      ctx.beginPath();
      ctx.roundRect(-35, -15, 70, 85, 20);
      ctx.fill();
      // 3 extended fingers (W)
      [-22, 0, 22].forEach((fx, i) => {
        ctx.beginPath();
        ctx.roundRect(fx - 7, -110 + (i === 1 ? -10 : 0), 16, 100, 8);
        ctx.fill();
      });
      // Pinky and thumb tucked together
      ctx.beginPath();
      ctx.roundRect(-25, 5, 50, 20, 10);
      ctx.fill();
      ctx.restore();
    },
  },
];

export const CameraTranslator: React.FC<CameraTranslatorProps> = ({
  voiceSettings,
  isMuted,
  onNewTranslation,
  practiceFocus,
  clearPracticeFocus,
  onSwitchToVideoUpload,
}) => {
  // DOM element refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stream & state
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [isConnectingCamera, setIsConnectingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState<boolean>(true);

  // Virtual Camera practice feed
  const [isVirtualCamera, setIsVirtualCamera] = useState<boolean>(false);
  const [selectedVirtualSign, setSelectedVirtualSign] = useState<string>('hello');
  const virtualAnimRef = useRef<number | null>(null);

  // Static preview
  const [staticPreviewImage, setStaticPreviewImage] = useState<string | null>(null);

  // Hand Tracking Configuration & State
  const [handTrackingEnabled, setHandTrackingEnabled] = useState<boolean>(true);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showLandmarkPoints, setShowLandmarkPoints] = useState<boolean>(true);
  const [showGestureBadge, setShowGestureBadge] = useState<boolean>(true);
  const [trackingColorTheme, setTrackingColorTheme] = useState<'neonCyan' | 'emerald' | 'amber'>('neonCyan');
  const [trackedHandState, setTrackedHandState] = useState<TrackedHand | null>(null);
  const [fpsCounter, setFpsCounter] = useState<number>(30);
  const [trackingLatencyMs, setTrackingLatencyMs] = useState<number>(22);
  const [translationLatencyMs, setTranslationLatencyMs] = useState<number | null>(null);

  // Active tracked hand ref (stable reference for frame capture)
  const trackedHandRef = useRef<TrackedHand | null>(null);
  const trackingAnimFrameRef = useRef<number | null>(null);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  // Translation & Speech
  const [isTranslatingContinuous, setIsTranslatingContinuous] = useState<boolean>(false);
  const [isProcessingFrame, setIsProcessingFrame] = useState<boolean>(false);
  const [latestTranslation, setLatestTranslation] = useState<GestureTranslation | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);

  // Refs for stable loops
  const isProcessingFrameRef = useRef<boolean>(false);
  const isContinuousRef = useRef<boolean>(false);
  const lastTranslatedGestureRef = useRef<string>('');
  const lastTranslatedTimeRef = useRef<number>(0);
  const practiceFocusRef = useRef<string | null>(practiceFocus);
  const recentGesturesHistoryRef = useRef<string[]>([]);
  const streamActiveRef = useRef<boolean>(false);
  const isVirtualCameraRef = useRef<boolean>(false);
  const autoScanCountRef = useRef<number>(0);

  // Keep refs synchronized
  useEffect(() => {
    isContinuousRef.current = isTranslatingContinuous;
  }, [isTranslatingContinuous]);

  useEffect(() => {
    practiceFocusRef.current = practiceFocus;
  }, [practiceFocus]);

  useEffect(() => {
    isProcessingFrameRef.current = isProcessingFrame;
  }, [isProcessingFrame]);

  useEffect(() => {
    streamActiveRef.current = streamActive;
  }, [streamActive]);

  useEffect(() => {
    isVirtualCameraRef.current = isVirtualCamera;
  }, [isVirtualCamera]);

  // Initialize Hand Tracker engine on mount
  useEffect(() => {
    handTracker.initialize().then((ready) => {
      if (ready) {
        console.log('[CameraTranslator] HandLandmarker ready for real-time tracking.');
      }
    });
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
    streamActiveRef.current = false;
  }, []);

  // Stop virtual camera
  const stopVirtualCamera = useCallback(() => {
    setIsVirtualCamera(false);
    isVirtualCameraRef.current = false;
    if (virtualAnimRef.current) {
      cancelAnimationFrame(virtualAnimRef.current);
      virtualAnimRef.current = null;
    }
  }, []);

  // Start real webcam
  const startCamera = useCallback(async () => {
    stopVirtualCamera();
    setIsConnectingCamera(true);
    setCameraError(null);
    setIsPermissionDenied(false);
    setStaticPreviewImage(null);

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not available in this browser window.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.srcObject = stream;

        // Ensure video is playing and ready
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.onloadedmetadata = () => resolve();
            setTimeout(resolve, 600);
          }
        });

        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video play triggered:', playErr);
        }
      }

      setStreamActive(true);
      streamActiveRef.current = true;
      setCameraError(null);
      setIsPermissionDenied(false);
    } catch (err: any) {
      console.warn('Camera request error:', err?.name, err?.message);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        setIsPermissionDenied(true);
        setCameraError(
          'Camera access was denied by the browser. You can use the Virtual Camera simulator or upload an image below.'
        );
      } else {
        setCameraError(err?.message || 'Could not connect to webcam device.');
      }
      setStreamActive(false);
      streamActiveRef.current = false;
    } finally {
      setIsConnectingCamera(false);
    }
  }, [facingMode, stopVirtualCamera]);

  // Start virtual practice camera
  const startVirtualCamera = useCallback(() => {
    stopCamera();
    setCameraError(null);
    setIsPermissionDenied(false);
    setStaticPreviewImage(null);
    setIsVirtualCamera(true);
    isVirtualCameraRef.current = true;
  }, [stopCamera]);

  // Virtual Camera Animation Loop
  useEffect(() => {
    if (!isVirtualCamera) {
      if (virtualAnimRef.current) {
        cancelAnimationFrame(virtualAnimRef.current);
        virtualAnimRef.current = null;
      }
      return;
    }

    const canvas = virtualCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const render = (time: number) => {
      canvas.width = 640;
      canvas.height = 480;

      // Dark virtual studio background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 640, 480);

      // Grid guide lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 40; x < 640; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 40; y < 480; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }

      // Draw active virtual sign hand model
      const signModel =
        VIRTUAL_SIGNS.find((s) => s.id === selectedVirtualSign) || VIRTUAL_SIGNS[0];
      signModel.drawHand(ctx, time);

      // Label overlay on virtual canvas
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Virtual Simulation: ${signModel.name} (${signModel.icon})`,
        320,
        35
      );

      // Supply corresponding canonical landmarks for virtual hand tracking
      const virtualLandmarks = generateLandmarksForSign(selectedVirtualSign);
      const recognizedGesture = classifyHandLandmarks(virtualLandmarks, 'Right', practiceFocusRef.current || undefined);

      const virtualTrackedHand: TrackedHand = {
        landmarks: virtualLandmarks,
        handedness: 'Right',
        score: 0.98,
        boundingBox: { x: 0.35, y: 0.25, width: 0.3, height: 0.55 },
        gesture: recognizedGesture,
      };

      trackedHandRef.current = virtualTrackedHand;
      setTrackedHandState(virtualTrackedHand);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    virtualAnimRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
      virtualAnimRef.current = null;
    };
  }, [isVirtualCamera, selectedVirtualSign]);

  // Real-time Hand Tracking & Overlay Render Loop
  useEffect(() => {
    const runTrackingLoop = () => {
      const overlayCanvas = trackingCanvasRef.current;
      if (!overlayCanvas) {
        trackingAnimFrameRef.current = requestAnimationFrame(runTrackingLoop);
        return;
      }

      const overlayCtx = overlayCanvas.getContext('2d');
      if (!overlayCtx) {
        trackingAnimFrameRef.current = requestAnimationFrame(runTrackingLoop);
        return;
      }

      // Maintain overlay canvas resolution
      const targetW = overlayCanvas.parentElement?.clientWidth || 640;
      const targetH = overlayCanvas.parentElement?.clientHeight || 480;
      if (overlayCanvas.width !== targetW || overlayCanvas.height !== targetH) {
        overlayCanvas.width = targetW;
        overlayCanvas.height = targetH;
      }

      // Clear canvas before each frame
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // FPS tracking
      const now = performance.now();
      frameCountRef.current += 1;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFpsCounter(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      if (handTrackingEnabled) {
        let currentHand: TrackedHand | null = null;

        if (streamActive && videoRef.current && videoRef.current.readyState >= 2) {
          const video = videoRef.current;
          const t0 = performance.now();
          // Run hand detection
          const detected = handTracker.detect(
            video,
            now,
            canvasRef.current?.getContext('2d', { willReadFrequently: true }) || undefined,
            practiceFocusRef.current || undefined
          );
          const dt = Math.round(performance.now() - t0);
          if (dt > 0 && frameCountRef.current % 15 === 0) {
            setTrackingLatencyMs(dt);
          }

          if (detected) {
            currentHand = detected;
            trackedHandRef.current = detected;
            setTrackedHandState(detected);
          } else {
            trackedHandRef.current = null;
            setTrackedHandState(null);
          }
        } else if (isVirtualCamera) {
          // Virtual camera populates trackedHandRef in its own render loop
          currentHand = trackedHandRef.current;
        }

        // Draw glowing hand skeleton and landmarks if present
        if (currentHand && currentHand.landmarks && currentHand.landmarks.length >= 21) {
          drawHandSkeleton(
            overlayCtx,
            currentHand.landmarks,
            overlayCanvas.width,
            overlayCanvas.height,
            {
              showSkeleton,
              showPoints: showLandmarkPoints,
              showGestureBadge,
              gesture: currentHand.gesture,
              colorTheme: trackingColorTheme,
            }
          );
        }
      }

      trackingAnimFrameRef.current = requestAnimationFrame(runTrackingLoop);
    };

    trackingAnimFrameRef.current = requestAnimationFrame(runTrackingLoop);

    return () => {
      if (trackingAnimFrameRef.current) {
        cancelAnimationFrame(trackingAnimFrameRef.current);
        trackingAnimFrameRef.current = null;
      }
    };
  }, [
    streamActive,
    isVirtualCamera,
    handTrackingEnabled,
    showSkeleton,
    showLandmarkPoints,
    showGestureBadge,
    trackingColorTheme,
  ]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopVirtualCamera();
    };
  }, [stopCamera, stopVirtualCamera]);

  // Fast client-side vision metrics for instant fallback analysis
  const analyzeFrameMetrics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const startX = Math.floor(width * 0.2);
    const startY = Math.floor(height * 0.15);
    const zoneW = Math.floor(width * 0.6);
    const zoneH = Math.floor(height * 0.7);

    try {
      const imgData = ctx.getImageData(startX, startY, zoneW, zoneH);
      const d = imgData.data;
      let skinPixels = 0;
      let topY = zoneH;
      let bottomY = 0;
      let leftX = zoneW;
      let rightX = 0;

      const colCounts = new Int32Array(zoneW);

      for (let y = 0; y < zoneH; y += 4) {
        for (let x = 0; x < zoneW; x += 4) {
          const idx = (y * zoneW + x) * 4;
          const r = d[idx];
          const g = d[idx + 1];
          const b = d[idx + 2];

          // Skin hue filter in RGB color space
          const isSkin =
            r > 75 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.abs(r - g) > 10;

          if (isSkin) {
            skinPixels++;
            colCounts[x]++;
            if (y < topY) topY = y;
            if (y > bottomY) bottomY = y;
            if (x < leftX) leftX = x;
            if (x > rightX) rightX = x;
          }
        }
      }

      const totalSampled = (zoneW / 4) * (zoneH / 4);
      const skinDensity = totalSampled > 0 ? skinPixels / totalSampled : 0;
      const handDetected = skinDensity > 0.06;

      let peaks = 0;
      let inPeak = false;
      const colThreshold = Math.max(3, (bottomY - topY) * 0.08);

      for (let x = leftX; x <= rightX; x += 4) {
        if (colCounts[x] > colThreshold) {
          if (!inPeak) {
            peaks++;
            inPeak = true;
          }
        } else {
          inPeak = false;
        }
      }

      const hBox = Math.max(1, bottomY - topY);
      const wBox = Math.max(1, rightX - leftX);
      const aspectRatio = hBox / wBox;

      return {
        handDetected,
        skinDensity,
        estimatedFingers: Math.min(5, Math.max(0, peaks)),
        aspectRatio,
        isFist: peaks <= 1 && aspectRatio < 1.2 && skinDensity > 0.12,
        thumbUp: peaks <= 2 && aspectRatio > 1.3,
        openPalm: peaks >= 4 || skinDensity > 0.28,
        isWaterSign: peaks === 3,
      };
    } catch {
      return {
        handDetected: true,
        skinDensity: 0.2,
        estimatedFingers: 5,
        aspectRatio: 1.2,
        isFist: false,
        thumbUp: false,
        openPalm: true,
        isWaterSign: false,
      };
    }
  };

  // Capture current video frame or virtual canvas to JPEG base64
  const captureFrame = useCallback((): {
    image: string;
    metrics: any;
    handTracking: any;
  } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const currentTracked = trackedHandRef.current;
    const handTrackingPayload = currentTracked
      ? {
          gesture: currentTracked.gesture,
          landmarks: currentTracked.landmarks,
          fingerStates: currentTracked.gesture?.fingerStates,
          score: currentTracked.score,
        }
      : null;

    if (staticPreviewImage) {
      return {
        image: staticPreviewImage,
        metrics: {
          handDetected: true,
          skinDensity: 0.25,
          estimatedFingers: 5,
          openPalm: true,
          gestureNameHint: currentTracked?.gesture?.name,
          spokenTextHint: currentTracked?.gesture?.spokenText,
        },
        handTracking: handTrackingPayload,
      };
    }

    if (isVirtualCameraRef.current && virtualCanvasRef.current) {
      const vCanvas = virtualCanvasRef.current;
      canvas.width = vCanvas.width || 640;
      canvas.height = vCanvas.height || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(vCanvas, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      const activeModel =
        VIRTUAL_SIGNS.find((s) => s.id === selectedVirtualSign) || VIRTUAL_SIGNS[0];
      return {
        image: base64,
        metrics: {
          handDetected: true,
          demoId: activeModel.id,
          skinDensity: 0.3,
          gestureNameHint: activeModel.name,
          spokenTextHint: activeModel.spokenText,
          estimatedFingers: activeModel.id === 'hello' ? 5 : activeModel.id === 'peace' ? 2 : 1,
          openPalm: activeModel.id === 'hello' || activeModel.id === 'thank_you',
          isFist: activeModel.id === 'yes',
          thumbUp: activeModel.id === 'thumbs_up',
        },
        handTracking: handTrackingPayload,
      };
    }

    const video = videoRef.current;
    if (!video) return null;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w === 0 || h === 0) return null;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const metrics: Record<string, any> = analyzeFrameMetrics(ctx, canvas.width, canvas.height);
    if (currentTracked?.gesture) {
      metrics.gestureNameHint = currentTracked.gesture.name;
      metrics.spokenTextHint = currentTracked.gesture.spokenText;
      metrics.isILY = currentTracked.gesture.id === 'i_love_you';
      metrics.isPeace = currentTracked.gesture.id === 'peace_v';
      metrics.isPoint = currentTracked.gesture.id === 'pointing_one';
      metrics.thumbUp = currentTracked.gesture.id === 'thumbs_up';
      metrics.thumbDown = currentTracked.gesture.id === 'thumbs_down';
      metrics.isPinch = currentTracked.gesture.id === 'okay';
      metrics.isFist = currentTracked.gesture.id === 'yes_fist';
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.82);

    return { image: base64, metrics, handTracking: handTrackingPayload };
  }, [isMirrored, staticPreviewImage, selectedVirtualSign]);

  // Send image to translate API
  const sendImageToTranslate = useCallback(
    async (
      base64Image: string,
      metrics: any,
      handTrackingData: any,
      triggerMode: 'manual' | 'auto',
      demoId?: string
    ) => {
      if (isProcessingFrameRef.current) return;
      setIsProcessingFrame(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5500);

      const reqStart = performance.now();

      try {
        const response = await fetch('/api/translate-gesture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            image: base64Image,
            previousGestures: recentGesturesHistoryRef.current,
            mode: triggerMode,
            focus: practiceFocusRef.current,
            demoId: demoId || metrics?.demoId,
            visionMetrics: metrics,
            handTracking: handTrackingData,
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const latencyMs = Math.round(performance.now() - reqStart);
        setTranslationLatencyMs(latencyMs);

        if (data.quotaExhausted) {
          setIsQuotaExhausted(true);
        }

        if (data.detected && data.spokenText) {
          const now = Date.now();
          const isSameGesture =
            data.gestureName === lastTranslatedGestureRef.current &&
            now - lastTranslatedTimeRef.current < 3500;

          const translation: GestureTranslation = {
            detected: true,
            gestureName: data.gestureName,
            spokenText: data.spokenText,
            category: data.category || 'phrase',
            confidence: data.confidence || 'high',
            description: data.description,
            aslTip: data.aslTip,
            timestamp: now,
            thumbnail: base64Image,
          };

          setLatestTranslation(translation);
          onNewTranslation(translation);

          recentGesturesHistoryRef.current = [
            ...recentGesturesHistoryRef.current.slice(-5),
            data.gestureName,
          ];

          if (voiceSettings.soundEffects) {
            soundEffects.playDetectChime();
          }

          if (!isSameGesture || triggerMode === 'manual') {
            lastTranslatedGestureRef.current = data.gestureName;
            lastTranslatedTimeRef.current = now;

            if (voiceSettings.autoSpeak && !isMuted) {
              speechManager.speak(data.spokenText, voiceSettings);
            }
          }
        } else {
          // Guidance when hand is in standby
          const standbyNotice: GestureTranslation = {
            detected: false,
            gestureName: data.gestureName || 'STANDBY',
            spokenText: '',
            confidence: 'low',
            description: data.description || 'Hold hand steady inside camera frame.',
            aslTip: data.aslTip || 'Ensure fingers and palm are clearly visible.',
            timestamp: Date.now(),
          };
          setLatestTranslation(standbyNotice);
        }
      } catch (err: any) {
        const localLatencyMs = Math.round(performance.now() - reqStart);
        setTranslationLatencyMs(localLatencyMs);

        if (err.name === 'AbortError') {
          console.warn('Translation request timed out, checking hand tracking...');
        } else {
          console.error('Translation error:', err);
        }

        // Instant local resolution using tracked hand landmarks (NO hardcoded static "Thank you" repeats!)
        const activeHand = trackedHandRef.current;
        if (activeHand && activeHand.gesture && activeHand.gesture.id !== 'standby') {
          const g = activeHand.gesture;
          const fallbackTrans: GestureTranslation = {
            detected: true,
            gestureName: g.name.toUpperCase().replace(/\s+/g, '_'),
            spokenText: g.spokenText,
            category: g.category,
            confidence: g.confidence,
            description: g.description,
            aslTip: g.aslTip,
            timestamp: Date.now(),
          };
          setLatestTranslation(fallbackTrans);
          onNewTranslation(fallbackTrans);
          if (voiceSettings.autoSpeak && !isMuted) {
            speechManager.speak(g.spokenText, voiceSettings);
          }
        } else {
          const fallbackTrans: GestureTranslation = {
            detected: false,
            gestureName: 'STANDBY',
            spokenText: '',
            confidence: 'low',
            description: 'Position your hand inside the camera frame.',
            aslTip: 'Raise hand into view for real-time tracking.',
            timestamp: Date.now(),
          };
          setLatestTranslation(fallbackTrans);
        }
      } finally {
        clearTimeout(timeoutId);
        setIsProcessingFrame(false);
      }
    },
    [voiceSettings, isMuted, onNewTranslation]
  );

  // Manual trigger from primary button
  const performManualTranslation = useCallback(() => {
    const captured = captureFrame();
    if (captured) {
      sendImageToTranslate(
        captured.image,
        captured.metrics,
        captured.handTracking,
        'manual'
      );
    }
  }, [captureFrame, sendImageToTranslate]);

  // Continuous auto-detection loop (stable timer, 4.0s cooldown)
  useEffect(() => {
    if (!isTranslatingContinuous) return;
    if (!streamActive && !isVirtualCamera) return;

    autoScanCountRef.current = 0;
    const timer = setInterval(() => {
      if (
        isContinuousRef.current &&
        (streamActiveRef.current || isVirtualCameraRef.current) &&
        !isProcessingFrameRef.current
      ) {
        autoScanCountRef.current += 1;
        // Pause auto-loop after 15 scans
        if (autoScanCountRef.current > 15) {
          setIsTranslatingContinuous(false);
          autoScanCountRef.current = 0;
          return;
        }

        const captured = captureFrame();
        if (captured) {
          sendImageToTranslate(
            captured.image,
            captured.metrics,
            captured.handTracking,
            'auto'
          );
        }
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [isTranslatingContinuous, streamActive, isVirtualCamera, captureFrame, sendImageToTranslate]);

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        stopCamera();
        stopVirtualCamera();
        setStaticPreviewImage(base64);
        sendImageToTranslate(
          base64,
          { handDetected: true, skinDensity: 0.3, openPalm: true },
          null,
          'manual'
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Test with sample demo gesture
  const handleSelectSampleGesture = (sample: SampleGesture) => {
    stopCamera();
    stopVirtualCamera();
    if (canvasRef.current) {
      sample.renderToCanvas(canvasRef.current);
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9);
      setStaticPreviewImage(base64);

      // Generate corresponding landmarks for sample gesture
      const sampleLandmarks = generateLandmarksForSign(sample.id);
      const sampleHand: TrackedHand = {
        landmarks: sampleLandmarks,
        handedness: 'Right',
        score: 0.96,
        boundingBox: { x: 0.35, y: 0.25, width: 0.3, height: 0.55 },
        gesture: classifyHandLandmarks(sampleLandmarks, 'Right'),
      };
      trackedHandRef.current = sampleHand;
      setTrackedHandState(sampleHand);

      sendImageToTranslate(
        base64,
        {
          handDetected: true,
          skinDensity: 0.3,
          demoId: sample.id,
          gestureNameHint: sample.name,
          spokenTextHint: sample.spokenText,
        },
        {
          gesture: sampleHand.gesture,
          landmarks: sampleHand.landmarks,
          fingerStates: sampleHand.gesture.fingerStates,
          score: sampleHand.score,
        },
        'manual',
        sample.id
      );
    }
  };

  // Quick phrase shortcut (immediate vocalization)
  const handleQuickSpeak = (text: string) => {
    if (!isMuted) {
      speechManager.speak(text, voiceSettings);
    }
    const quickTrans: GestureTranslation = {
      detected: true,
      gestureName: 'QUICK_SPEECH',
      spokenText: text,
      category: 'phrase',
      confidence: 'high',
      description: 'Signer quick-tap speech shortcut',
      timestamp: Date.now(),
    };
    setLatestTranslation(quickTrans);
    onNewTranslation(quickTrans);
  };

  const activeGesture = trackedHandState?.gesture;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Hidden processing canvas and file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="user"
        className="hidden"
      />

      {/* Main Viewport & Framing Card */}
      <div className="relative w-full rounded-3xl apple-glass border border-white/[0.08] overflow-hidden shadow-2xl flex flex-col">
        {/* Top Viewport HUD bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06] text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  streamActive
                    ? 'bg-emerald-400'
                    : isVirtualCamera
                    ? 'bg-indigo-400'
                    : staticPreviewImage
                    ? 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
              />
              <span className="font-semibold text-white tracking-[-0.01em]">
                {streamActive
                  ? 'Live Camera'
                  : isVirtualCamera
                  ? 'Simulator'
                  : staticPreviewImage
                  ? 'Snapshot'
                  : 'Standby'}
              </span>
            </div>

            {/* Unboxed live telemetry & real latency readout */}
            {(streamActive || isVirtualCamera) && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                <span aria-hidden="true" className="text-slate-700">|</span>
                <span className={trackedHandState ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                  {trackedHandState ? 'Hand Locked' : 'Scanning'}
                </span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span>{fpsCounter} FPS</span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span>{trackingLatencyMs}ms tracking</span>
                {translationLatencyMs !== null && (
                  <>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span className="text-slate-300">{translationLatencyMs}ms translate</span>
                  </>
                )}
              </div>
            )}

            {practiceFocus && (
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                <span aria-hidden="true" className="text-slate-700">|</span>
                <span>Practicing: {practiceFocus}</span>
                <button
                  onClick={clearPracticeFocus}
                  className="hover:text-white font-bold ml-0.5 cursor-pointer"
                  title="Clear practice focus"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Camera & Tracking controls */}
          <div className="flex items-center gap-1.5">
            {/* Hand Tracking Toggle */}
            <button
              onClick={() => setHandTrackingEnabled((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer apple-press ${
                handTrackingEnabled
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
              }`}
              title="Toggle Real-Time 21-Landmark Hand Skeleton Tracking"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">
                {handTrackingEnabled ? 'Skeleton ON' : 'Skeleton OFF'}
              </span>
            </button>

            {streamActive && (
              <>
                <button
                  onClick={() => setIsMirrored((prev) => !prev)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isMirrored
                      ? 'bg-slate-800 text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mirror Flip View (Recommended for self-signing)"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    stopCamera();
                    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                    setTimeout(() => startCamera(), 100);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Switch Front/Back Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Virtual Camera simulator toggle */}
            <button
              onClick={isVirtualCamera ? stopVirtualCamera : startVirtualCamera}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 text-xs cursor-pointer ${
                isVirtualCamera
                  ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Virtual Practice Simulator (test without physical camera)"
            >
              <MonitorPlay className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isVirtualCamera ? 'Virtual Feed On' : 'Simulator'}
              </span>
            </button>

            {/* Upload image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
              title="Upload Gesture Photo"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Real Camera On/Off Toggle */}
            <button
              onClick={streamActive ? stopCamera : startCamera}
              disabled={isConnectingCamera}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                streamActive
                  ? 'text-rose-400 hover:bg-rose-950/50'
                  : 'text-emerald-400 hover:bg-emerald-950/50'
              }`}
              title={streamActive ? 'Turn Off Webcam' : 'Turn On Webcam'}
            >
              {streamActive ? (
                <CameraOff className="w-4 h-4" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Viewfinder Frame */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[500px] bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Real Webcam video element: ALWAYS in DOM */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isMirrored ? 'scale-x-[-1]' : ''
            } ${streamActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none absolute inset-0'}`}
          />

          {/* Virtual Camera Canvas element: Active when simulating */}
          <canvas
            ref={virtualCanvasRef}
            className={`w-full h-full object-contain ${
              isVirtualCamera ? 'opacity-100 z-10' : 'hidden'
            }`}
          />

          {/* Real-time Hand Tracking Skeleton Overlay Canvas */}
          <canvas
            ref={trackingCanvasRef}
            className={`absolute inset-0 pointer-events-none z-20 w-full h-full object-cover ${
              isMirrored && streamActive ? 'scale-x-[-1]' : ''
            }`}
          />

          {/* Framing Target Box with UIverse Cyber HUD Brackets and Magic UI Border Beam */}
          {(streamActive || isVirtualCamera) && (
            <>
              <div className="uiverse-hud-corner-tl" />
              <div className="uiverse-hud-corner-tr" />
              <div className="uiverse-hud-corner-bl" />
              <div className="uiverse-hud-corner-br" />
              <div className="absolute inset-8 sm:inset-14 pointer-events-none border-2 border-dashed border-cyan-500/30 rounded-3xl flex flex-col items-center justify-between p-4 z-15 relative overflow-hidden">
                <div className="magic-border-beam" />
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-mono tracking-wider uppercase text-cyan-400/80 bg-slate-950/85 px-2.5 py-0.5 rounded border border-cyan-500/20">
                    {isVirtualCamera ? 'Simulated Gesture Feed' : '21-Point Hand Tracking Zone'}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/85 border border-slate-800 text-[11px] font-mono">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        trackedHandState ? 'bg-cyan-400 animate-ping' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span className={trackedHandState ? 'text-cyan-300' : 'text-amber-300'}>
                      {trackedHandState ? 'Hand Tracked' : 'Scanning'}
                    </span>
                  </div>
                </div>

                {/* Circle Loaders Animated Radar Scanner while waiting for hand */}
                {!trackedHandState && (
                  <AnimatedRadarScanner size={84} className="my-auto opacity-75" />
                )}

                <div className="text-[11px] text-slate-300/80 bg-slate-950/85 px-3 py-1 rounded-full border border-slate-800 text-center">
                  {trackedHandState?.gesture
                    ? `Recognized: ${trackedHandState.gesture.emoji} ${trackedHandState.gesture.name} • Tap Translate to Speak`
                    : 'Position hand inside box • 21 Landmarks track in real time'}
                </div>
              </div>
            </>
          )}

          {/* Processing overlay */}
          {isProcessingFrame && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-950/90 border border-emerald-500/50 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md z-30">
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-emerald-300">
                Translating Sign to Voice...
              </span>
            </div>
          )}

          {/* Uploaded or Demo Static Image View */}
          {!streamActive && !isVirtualCamera && staticPreviewImage && (
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950 z-10">
              <img
                src={staticPreviewImage}
                alt="Captured Hand Sign"
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-lg text-xs text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Uploaded Snapshot Frame</span>
              </div>
              <button
                onClick={startCamera}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Switch to Webcam</span>
              </button>
            </div>
          )}

          {/* Camera Standby Screen with Aceternity Ambient Grid */}
          {!streamActive && !isVirtualCamera && !staticPreviewImage && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center max-w-lg gap-5 z-10 bg-ambient-grid">
              <div className="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-sky-500/10 border border-white/15 flex items-center justify-center text-emerald-400 shadow-[0_8px_24px_rgba(16,185,129,0.25)] group hover:scale-105 transition-transform">
                <AnimatedCamera className="w-8 h-8 text-emerald-400" active={isConnectingCamera} />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white tracking-[-0.02em]">
                  {isPermissionDenied ? 'Camera Access Required' : 'Ready for ASL & Hand Tracking'}
                </h3>
                <p className="text-xs text-slate-300/80 mt-1.5 leading-relaxed">
                  {isPermissionDenied
                    ? 'Browser webcam permission was declined. Launch the Virtual Simulator or upload an image to continue.'
                    : 'Enable your camera for real-time 21-landmark skeletal tracking and voice translation, or explore with the virtual simulator.'}
                </p>
              </div>

              {/* Action Buttons with UIverse Glow Styling */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  onClick={startCamera}
                  disabled={isConnectingCamera}
                  className="uiverse-glow-btn px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs sm:text-sm transition-all shadow-[0_4px_20px_rgba(16,185,129,0.35)] flex items-center gap-2 cursor-pointer"
                >
                  <AnimatedCamera className="w-4 h-4 text-white" active={isConnectingCamera} />
                  <span>
                    {isConnectingCamera ? 'Connecting...' : isPermissionDenied ? 'Retry Camera Access' : 'Enable Camera'}
                  </span>
                </button>

                <button
                  onClick={startVirtualCamera}
                  className="uiverse-glow-btn px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(99,102,241,0.35)] flex items-center gap-2 cursor-pointer"
                >
                  <MonitorPlay className="w-4 h-4" />
                  <span>Virtual Simulator</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1] text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer apple-press"
                >
                  <Upload className="w-4 h-4 text-indigo-300" />
                  <span>Upload Frame</span>
                </button>

                {onSwitchToVideoUpload && (
                  <button
                    onClick={onSwitchToVideoUpload}
                    className="px-4 py-2.5 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer apple-press"
                    title="Upload full video clip and translate to text and voice audio"
                  >
                    <Upload className="w-4 h-4 text-purple-300" />
                    <span>Upload Sign Video</span>
                  </button>
                )}
              </div>

              {isPermissionDenied && (
                <div className="w-full mt-2 p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-left text-[11px] text-amber-200/90 leading-relaxed">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>To allow webcam in your browser:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-200/80">
                    <li>Click the lock or site settings icon in the address bar.</li>
                    <li>Set Camera to &ldquo;Allow&rdquo;.</li>
                    <li>Click &ldquo;Retry Camera Access&rdquo; above.</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Real-Time Hand Tracking Telemetry & Finger State HUD */}
        {handTrackingEnabled && (streamActive || isVirtualCamera) && (
          <div className="px-4 sm:px-5 py-2.5 bg-slate-950/80 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left: Active Recognized Sign Badge */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium text-[11px]">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live Gesture:</span>
              </span>
              {activeGesture && activeGesture.id !== 'standby' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-semibold shadow-sm animate-pulse">
                  <span>{activeGesture.emoji}</span>
                  <span>{activeGesture.name}</span>
                  <span className="text-cyan-400 text-[10px] font-mono">
                    ({Math.round(activeGesture.confidenceScore * 100)}%)
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Position hand in view...</span>
              )}
            </div>

            {/* Right: Skeleton display toggles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSkeleton((prev) => !prev)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer apple-press ${
                  showSkeleton
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
                title="Toggle Skeleton Bones"
              >
                Bones: {showSkeleton ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowLandmarkPoints((prev) => !prev)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer apple-press ${
                  showLandmarkPoints
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
                title="Toggle 21 Landmark Nodes"
              >
                Nodes: {showLandmarkPoints ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() =>
                  setTrackingColorTheme((prev) =>
                    prev === 'neonCyan' ? 'emerald' : prev === 'emerald' ? 'amber' : 'neonCyan'
                  )
                }
                className="px-2.5 py-1 rounded-xl text-[11px] bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] cursor-pointer capitalize apple-press"
                title="Change Skeleton Neon Theme"
              >
                Theme: {trackingColorTheme}
              </button>
            </div>
          </div>
        )}

        {/* Translation Execution Controls Bar */}
        <div className="p-4 sm:p-5 bg-slate-950/70 backdrop-blur-xl border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Primary Manual Trigger */}
            <button
              onClick={performManualTranslation}
              disabled={(!streamActive && !isVirtualCamera && !staticPreviewImage) || isProcessingFrame}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs sm:text-sm transition-all shadow-[0_4px_16px_rgba(16,185,129,0.35)] disabled:opacity-40 cursor-pointer apple-press"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Translate Sign to Voice</span>
            </button>

            {/* Continuous Auto-Detect Toggle */}
            <button
              onClick={() => setIsTranslatingContinuous((prev) => !prev)}
              disabled={!streamActive && !isVirtualCamera}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition-all cursor-pointer apple-press ${
                isTranslatingContinuous
                  ? 'bg-amber-400 text-slate-950 shadow-[0_2px_12px_rgba(251,191,36,0.35)]'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isTranslatingContinuous ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Stop Loop</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-slate-300" />
                  <span>Auto-Detect</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              {isTranslatingContinuous ? 'Continuous Auto Loop' : 'Instant Snapshot'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className={voiceSettings.autoSpeak ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
              {voiceSettings.autoSpeak ? 'Auto-Voice Active' : 'Tap to Voice'}
            </span>
          </div>
        </div>
      </div>

      {/* Instant Demo Gestures (Quick-Test Signs) */}
      <div className="w-full flex flex-col gap-2.5 p-4 sm:p-5 rounded-3xl apple-glass-card border border-white/[0.08]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white tracking-[-0.01em] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Interactive Sign Demos (Instant Test)</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Tap any sign to inspect 21 landmarks and speak
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
          {SAMPLE_GESTURES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSampleGesture(sample)}
              className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-cyan-500/40 transition-all text-center group apple-press cursor-pointer shadow-sm"
              title={`Test ${sample.name} translation`}
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{sample.icon}</span>
              <span className="text-[11px] font-medium text-slate-200 group-hover:text-cyan-300 line-clamp-1">
                {sample.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Translated Speech Card (Liquid Glass + CSS Text Shimmer) */}
      <div
        className={`w-full rounded-3xl p-6 sm:p-7 border transition-all duration-200 relative overflow-hidden ${
          latestTranslation?.detected
            ? 'liquid-glass-card uiverse-edge-sheen border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.2)]'
            : 'liquid-glass-card border-white/[0.08]'
        }`}
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-5 relative z-10">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
                {latestTranslation?.detected ? 'Vocalized Output' : 'Translator Standby'}
              </span>
              {latestTranslation?.gestureName && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono text-emerald-300 font-medium text-xs">
                    {latestTranslation.gestureName}
                  </span>
                </>
              )}
              {latestTranslation?.confidence && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span
                    className={`text-xs font-medium capitalize ${
                      latestTranslation.confidence === 'high'
                        ? 'text-emerald-400'
                        : latestTranslation.confidence === 'medium'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {latestTranslation.confidence} Confidence
                  </span>
                </>
              )}
            </div>

            {latestTranslation?.spokenText ? (
              <h2 className="text-2xl sm:text-3xl font-bold text-shimmer tracking-tight leading-snug">
                &ldquo;{latestTranslation.spokenText}&rdquo;
              </h2>
            ) : (
              <p className="text-slate-400 text-sm">
                Sign in front of the camera, or choose a demo sign above to translate into voice.
              </p>
            )}

            {latestTranslation?.description && (
              <p className="text-xs text-slate-300/80 mt-1">
                <span className="text-slate-400">Analysis: </span>
                {latestTranslation.description}
              </p>
            )}
            {latestTranslation?.aslTip && (
              <p className="text-xs text-amber-300 mt-1">
                <span className="font-semibold text-amber-400">Tip:</span> {latestTranslation.aslTip}
              </p>
            )}
          </div>

          {latestTranslation?.spokenText && (
            <button
              onClick={() => {
                if (latestTranslation.spokenText) {
                  speechManager.speak(latestTranslation.spokenText, voiceSettings);
                }
              }}
              className="uiverse-glow-btn w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] flex items-center justify-center shrink-0 cursor-pointer apple-press transition-all"
              title="Speak phrase aloud through device speakers"
              aria-label="Replay speech"
            >
              <AnimatedSpeaker className="w-6 h-6 text-white" active={true} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Emergency & Conversational Phrases */}
      <div className="w-full flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
            Signer Speech Shortcuts
          </span>
          <span className="text-[11px]">Instant 1-tap vocalization</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {QUICK_EMERGENCY_PHRASES.map((phrase, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickSpeak(phrase.text)}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-left transition-all apple-press group cursor-pointer shadow-sm"
            >
              <span className="text-lg shrink-0">{phrase.icon}</span>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                {phrase.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
