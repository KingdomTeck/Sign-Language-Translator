import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Volume2,
  FlipHorizontal,
  Eye,
  EyeOff,
  Hand,
  X,
  Check,
} from 'lucide-react';
import { GestureTranslation, VoiceSettings } from '../types';
import { Mascot } from './Mascot';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
      // Fist
      ctx.beginPath();
      ctx.roundRect(-42, -35, 84, 85, 24);
      ctx.fill();
      // Curled finger lines
      ctx.strokeStyle = '#d99f00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.strokeStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
      ctx.fillStyle = '#ffbf00';
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
  const [showGestureBadge, setShowGestureBadge] = useState<boolean>(false);
  const [trackingColorTheme, setTrackingColorTheme] = useState<'neonCyan' | 'emerald' | 'amber'>('emerald');
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
      ctx.fillStyle = '#131f24';
      ctx.fillRect(0, 0, 640, 480);

      // Grid guide lines
      ctx.strokeStyle = '#1c2b32';
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
        '',
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
      }, 15000);

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
            source: data.engine === 'gemini-cloud' ? 'ai' : 'offline',
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
            source: 'offline',
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
  const humanize = (raw: string) => {
    const base = raw.split('__')[0].replace(/_/g, ' ').trim();
    return base === base.toUpperCase() ? base.charAt(0) + base.slice(1).toLowerCase() : base;
  };

  const hasSource = streamActive || isVirtualCamera;
  const confidenceWord: Record<string, string> = { high: 'Sure', medium: 'Fairly sure', low: 'Unsure' };
  const handLabel = activeGesture && activeGesture.id !== 'standby' ? humanize(activeGesture.name) : null;
  const showCaption = latestTranslation?.spokenText && (hasSource || staticPreviewImage);

  let stageStatus: { text: string; tone: 'idle' | 'live' | 'found' } | null = null;
  if (isProcessingFrame) stageStatus = { text: 'Reading sign…', tone: 'found' };
  else if (isVirtualCamera) stageStatus = { text: handLabel ? `Simulated hand · ${handLabel}` : 'Simulated hand', tone: 'live' };
  else if (streamActive)
    stageStatus = trackedHandState
      ? { text: handLabel ? `Hand found · ${handLabel}` : 'Hand found', tone: 'found' }
      : { text: 'Looking for a hand', tone: 'live' };
  else if (staticPreviewImage) stageStatus = { text: 'Still image', tone: 'idle' };

  return (
    <div className="flex flex-col gap-8 w-full">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="user"
        className="hidden"
      />

      <div className="flex flex-col gap-4">
        {practiceFocus && (
          <div className="tile !border-b-2 flex items-center gap-4 pl-3 pr-2 py-2">
            <Mascot size={44} mood="listening" />
            <p className="flex-1 text-[1rem] font-bold">
              Let’s practise <span className="text-signer-ink">{practiceFocus}</span>! Make the sign, then tap Read sign.
            </p>
            <button onClick={clearPracticeFocus} className="icon-btn" aria-label="Stop practising">
              <X className="w-6 h-6" strokeWidth={3} />
            </button>
          </div>
        )}

        {/* The stage — dark while showing a picture, light while inviting */}
        <figure
          className={`relative m-0 w-full aspect-[4/5] sm:aspect-[16/10] rounded-[20px] overflow-hidden border-2 border-b-4 ${
            hasSource || staticPreviewImage ? 'bg-[var(--stage)] text-white border-[var(--stage)]' : 'bg-sunk text-ink border-rule'
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''} ${
              streamActive ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          />
          <canvas
            ref={virtualCanvasRef}
            className={`absolute inset-0 w-full h-full object-cover ${isVirtualCamera ? '' : 'hidden'}`}
          />
          <canvas
            ref={trackingCanvasRef}
            className={`absolute inset-0 pointer-events-none w-full h-full object-cover ${
              isMirrored && streamActive ? 'scale-x-[-1]' : ''
            } ${handTrackingEnabled ? '' : 'invisible'}`}
          />

          {!hasSource && staticPreviewImage && (
            <img
              src={staticPreviewImage}
              alt="The image being read"
              className="absolute inset-0 w-full h-full object-contain bg-[var(--stage)]"
            />
          )}

          {/* Idle — the invitation */}
          {!hasSource && !staticPreviewImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 text-center">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <Mascot size={120} className="bob" />
                <div className="bubble sm:text-left text-[1.125rem] font-extrabold max-w-[18rem] max-sm:before:hidden max-sm:after:hidden">
                  Sign to me and I’ll say it out loud!
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-3 w-full max-w-sm">
                <button onClick={startCamera} disabled={isConnectingCamera} className="btn btn-signer">
                  <Camera className="w-5 h-5" strokeWidth={2.5} />
                  {isConnectingCamera ? 'Starting…' : isPermissionDenied ? 'Try again' : 'Turn on camera'}
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={startVirtualCamera} className="btn btn-line btn-sm !min-h-11">
                    Simulator
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="btn btn-line btn-sm !min-h-11">
                    Use a photo
                  </button>
                </div>
              </div>
              {(cameraError || isPermissionDenied) && (
                <p className="max-w-md text-sm font-bold text-alert">
                  {isPermissionDenied
                    ? 'Camera access is blocked. Open site settings from the lock icon in the address bar, allow Camera, then try again.'
                    : cameraError}
                </p>
              )}
            </div>
          )}

          {/* Status, top-left */}
          {stageStatus && (
            <div className="absolute top-0 inset-x-0 flex items-start justify-between p-3 sm:p-4 bg-gradient-to-b from-black/45 to-transparent">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                <span
                  className={stageStatus.tone === 'idle' ? 'w-2.5 h-2.5 rounded-full bg-white/50' : 'live-dot'}
                  style={{ color: stageStatus.tone === 'found' ? '#ffbf00' : '#ffffff' }}
                  aria-hidden="true"
                />
                <span aria-live="polite">{stageStatus.text}</span>
              </span>
              <div className="flex items-center gap-0.5">
                {streamActive && (
                  <>
                    <button
                      onClick={() => setIsMirrored((p) => !p)}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white/15"
                      aria-label="Mirror preview"
                      title="Mirror preview"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        stopCamera();
                        setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                        setTimeout(() => startCamera(), 100);
                      }}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white/15"
                      aria-label="Switch camera"
                      title={facingMode === 'user' ? 'Use back camera' : 'Use front camera'}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                )}
                {hasSource && (
                  <button
                    onClick={() => setHandTrackingEnabled((p) => !p)}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white/15"
                    aria-pressed={handTrackingEnabled}
                    aria-label={handTrackingEnabled ? 'Hide hand outline' : 'Show hand outline'}
                    title={handTrackingEnabled ? 'Hide hand outline' : 'Show hand outline'}
                  >
                    {handTrackingEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                )}
                {(hasSource || staticPreviewImage) && (
                  <button
                    onClick={() => {
                      stopCamera();
                      stopVirtualCamera();
                      setIsTranslatingContinuous(false);
                      setStaticPreviewImage(null);
                      setLatestTranslation(null);
                    }}
                    className="ml-1 h-9 px-3 inline-flex items-center gap-1.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/20"
                  >
                    <X className="w-4 h-4" /> {streamActive ? 'Camera off' : 'Close'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Caption — the camera literally subtitles the signer */}
          {showCaption && (
            <figcaption
              key={latestTranslation!.timestamp}
              className="arrive absolute bottom-0 inset-x-0 px-4 sm:px-6 pt-16 pb-5 bg-gradient-to-t from-black/75 via-black/40 to-transparent"
            >
              <p className="text-[1.5rem] sm:text-[2rem] font-extrabold leading-[1.15] max-w-[24ch] drop-shadow">
                {latestTranslation!.spokenText}
              </p>
            </figcaption>
          )}

          {isProcessingFrame && <div className="reading-line" aria-hidden="true" />}
        </figure>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={performManualTranslation}
              disabled={!hasSource || isProcessingFrame}
              className="btn btn-signer !min-h-[3.25rem] !px-7 !text-base flex-1 sm:flex-none"
            >
              <Hand className="w-5 h-5" strokeWidth={2.5} />
              {isProcessingFrame ? 'Reading…' : 'Read sign'}
            </button>
            {latestTranslation?.spokenText && (
              <button
                onClick={() => speechManager.speak(latestTranslation.spokenText, voiceSettings)}
                className="btn btn-line !min-h-[3.25rem] !px-4"
                aria-label="Say the last sign again"
                title="Say again"
              >
                <Volume2 className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 w-full sm:w-auto">
            {isVirtualCamera && (
              <label className="flex items-center gap-2 text-sm font-bold text-ink-2">
                Simulate
                <select
                  value={selectedVirtualSign}
                  onChange={(e) => setSelectedVirtualSign(e.target.value)}
                  className="field !min-h-10 !w-auto !py-0 !pl-3 !pr-8 text-sm"
                >
                  {VIRTUAL_SIGNS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={`flex items-center gap-3 ${hasSource ? '' : 'opacity-45'}`}>
              <span className="leading-tight">
                <span className="block text-[0.9375rem] font-extrabold text-ink">Keep reading</span>
                <span className="block text-xs font-bold text-ink-3">every 4 seconds</span>
              </span>
              <button
                role="switch"
                aria-checked={isTranslatingContinuous}
                aria-label="Keep reading signs automatically"
                disabled={!hasSource}
                onClick={() => setIsTranslatingContinuous((p) => !p)}
                className="switch"
              />
            </label>
          </div>
        </div>

        {/* Result feedback — lesson-style banner */}
        {latestTranslation && latestTranslation.gestureName !== 'QUICK_SPEECH' && (
          <div
            key={latestTranslation.timestamp}
            className={`arrive rounded-2xl px-5 py-4 flex items-start gap-4 ${
              latestTranslation.detected ? 'bg-signer-soft' : 'bg-[#ffdfe0] dark:bg-[#3a1d1f]'
            }`}
          >
            <span
              className={`shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center ${
                latestTranslation.detected ? 'bg-signer text-on-signer' : 'bg-alert text-white'
              }`}
              aria-hidden="true"
            >
              {latestTranslation.detected ? <Check className="w-6 h-6" strokeWidth={4} /> : <X className="w-6 h-6" strokeWidth={4} />}
            </span>
            <div className="min-w-0">
              {latestTranslation.detected ? (
                <p className="text-[1.25rem] font-black text-signer-ink">
                  {humanize(latestTranslation.gestureName)}
                  <span className="ml-2 text-sm font-extrabold uppercase tracking-wider opacity-80">
                    {latestTranslation.source === 'offline'
                      ? 'Offline guess'
                      : confidenceWord[latestTranslation.confidence] ?? latestTranslation.confidence}
                    {translationLatencyMs ? <span className="tnum"> · {(translationLatencyMs / 1000).toFixed(1)}s</span> : null}
                  </span>
                </p>
              ) : (
                <p className="text-[1.25rem] font-black text-alert">No sign found</p>
              )}
              <p className={`text-[0.9375rem] font-bold mt-0.5 ${latestTranslation.detected ? 'text-signer-ink' : 'text-alert'}`}>
                {latestTranslation.detected
                  ? latestTranslation.aslTip ?? latestTranslation.description
                  : 'Keep your hand inside the frame and try again.'}
              </p>
              {latestTranslation.detected && latestTranslation.source === 'offline' && (
                <p className="text-sm font-bold text-ink-2 mt-2">
                  The AI didn’t answer in time, so this is a quick guess from your hand shape. It may be wrong.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phrases the signer can say instantly */}
      <section aria-labelledby="quick-phrases">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <h3 id="quick-phrases" className="text-[1.375rem] font-black">Say it now</h3>
          <span className="text-sm font-bold text-ink-3">Spoken instantly, no signing needed</span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_EMERGENCY_PHRASES.map((phrase, idx) => (
            <li key={idx}>
              <button
                onClick={() => handleQuickSpeak(phrase.text)}
                className="tile group w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                title={phrase.text}
              >
                <span className="text-[1rem] font-extrabold">{phrase.label}</span>
                <Volume2 className="w-5 h-5 text-partner-ink shrink-0" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Sample signs — for trying it without a camera */}
      <section aria-labelledby="samples">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <h3 id="samples" className="text-[1.375rem] font-black">No camera? Try a sample</h3>
          {onSwitchToVideoUpload && (
            <button onClick={onSwitchToVideoUpload} className="btn btn-sm btn-quiet -mr-3">
              Translate a video
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {SAMPLE_GESTURES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSampleGesture(sample)}
              className="tile flex flex-col items-center justify-center gap-1 px-2 pt-4 pb-3 text-center"
              title={sample.description}
            >
              <span className="text-[2.25rem] font-black leading-none text-partner-ink">
                {sample.name.replace(/^Letter\s+/i, '').charAt(0)}
              </span>
              <span className="text-[0.8125rem] font-extrabold text-ink-2 leading-tight">{sample.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
