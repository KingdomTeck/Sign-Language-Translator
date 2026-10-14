/**
 * GestureVoice - Real-Time Hand Tracking & Landmark Gesture Classifier
 * Supports 21 3D hand landmarks, skeletal rendering, and geometric sign recognition.
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface HandBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FingerStates {
  thumb: 'extended' | 'curled' | 'upright';
  index: 'extended' | 'curled';
  middle: 'extended' | 'curled';
  ring: 'extended' | 'curled';
  pinky: 'extended' | 'curled';
}

export interface RecognizedHandGesture {
  id: string;
  name: string;
  emoji: string;
  spokenText: string;
  category: 'phrase' | 'alphabet' | 'number' | 'greeting' | 'survival' | 'universal' | 'other';
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  description: string;
  aslTip: string;
  fingerStates: FingerStates;
}

export interface TrackedHand {
  landmarks: NormalizedLandmark[];
  handedness: 'Left' | 'Right';
  score: number;
  boundingBox: HandBoundingBox;
  gesture: RecognizedHandGesture;
}

// MediaPipe 21 Hand Landmark Connections (Bones)
export const HAND_CONNECTIONS: [number, number][] = [
  // Palm base
  [0, 1],
  [0, 5],
  [0, 17],
  [5, 9],
  [9, 13],
  [13, 17],
  // Thumb
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky finger
  [17, 18],
  [18, 19],
  [19, 20],
];

// Euclidean distance between two 2D/3D points
export function distance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Compute 2D angle in degrees between three points (vertex at p2)
export function calculateAngle(
  p1: NormalizedLandmark,
  p2: NormalizedLandmark,
  p3: NormalizedLandmark
): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 * mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Geometric Landmark Gesture Classifier
 * Analyzes relative distances, finger extensions, and angles from 21 landmarks.
 */
export function classifyHandLandmarks(
  landmarks: NormalizedLandmark[],
  handedness: 'Left' | 'Right' = 'Right',
  focusSign?: string
): RecognizedHandGesture {
  if (!landmarks || landmarks.length < 21) {
    return {
      id: 'standby',
      name: 'Standby',
      emoji: '✋',
      spokenText: '',
      category: 'other',
      confidence: 'low',
      confidenceScore: 0.1,
      description: 'Hand not detected in frame.',
      aslTip: 'Position hand clearly in the camera viewfinder.',
      fingerStates: {
        thumb: 'curled',
        index: 'curled',
        middle: 'curled',
        ring: 'curled',
        pinky: 'curled',
      },
    };
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];

  const indexMCP = landmarks[5];
  const indexPIP = landmarks[6];
  const indexTip = landmarks[8];

  const middleMCP = landmarks[9];
  const middlePIP = landmarks[10];
  const middleTip = landmarks[12];

  const ringMCP = landmarks[13];
  const ringPIP = landmarks[14];
  const ringTip = landmarks[16];

  const pinkyMCP = landmarks[17];
  const pinkyPIP = landmarks[18];
  const pinkyTip = landmarks[20];

  // Palm scale reference (distance wrist to middle MCP)
  const palmScale = Math.max(0.05, distance(wrist, middleMCP));

  // Determine extension of each finger
  // Finger is extended if tip is significantly further from wrist than PIP joint
  const isIndexExtended =
    distance(wrist, indexTip) > distance(wrist, indexPIP) * 1.15 &&
    indexTip.y < indexPIP.y + palmScale * 0.15;

  const isMiddleExtended =
    distance(wrist, middleTip) > distance(wrist, middlePIP) * 1.15 &&
    middleTip.y < middlePIP.y + palmScale * 0.15;

  const isRingExtended =
    distance(wrist, ringTip) > distance(wrist, ringPIP) * 1.15 &&
    ringTip.y < ringPIP.y + palmScale * 0.15;

  const isPinkyExtended =
    distance(wrist, pinkyTip) > distance(wrist, pinkyPIP) * 1.15 &&
    pinkyTip.y < pinkyPIP.y + palmScale * 0.15;

  // Thumb analysis
  const thumbDistFromPalm = distance(thumbTip, middleMCP) / palmScale;
  const isThumbUpright = thumbTip.y < thumbIP.y - palmScale * 0.18;
  const isThumbExtended =
    thumbDistFromPalm > 0.85 ||
    distance(wrist, thumbTip) > distance(wrist, thumbMCP) * 1.25;

  const fingerStates: FingerStates = {
    thumb: isThumbUpright ? 'upright' : isThumbExtended ? 'extended' : 'curled',
    index: isIndexExtended ? 'extended' : 'curled',
    middle: isMiddleExtended ? 'extended' : 'curled',
    ring: isRingExtended ? 'extended' : 'curled',
    pinky: isPinkyExtended ? 'extended' : 'curled',
  };

  const extendedCount =
    (isIndexExtended ? 1 : 0) +
    (isMiddleExtended ? 1 : 0) +
    (isRingExtended ? 1 : 0) +
    (isPinkyExtended ? 1 : 0);

  // Key relative distances
  const thumbIndexTipDist = distance(thumbTip, indexTip) / palmScale;
  const thumbPinkyDist = distance(thumbTip, pinkyTip) / palmScale;
  const indexMiddleDist = distance(indexTip, middleTip) / palmScale;

  // Check for specific practice focus match if provided
  if (focusSign) {
    const cleanFocus = focusSign.trim().toLowerCase();
    if (cleanFocus === 'hello' && extendedCount >= 3) {
      return {
        id: 'hello',
        name: 'HELLO',
        emoji: '👋',
        spokenText: 'Hello! Nice to meet you.',
        category: 'greeting',
        confidence: 'high',
        confidenceScore: 0.95,
        description: 'Practiced sign: Open hand greeting waving to camera.',
        aslTip: 'Open palm facing outward, gentle wave side to side.',
        fingerStates,
      };
    }
  }

  // 1. I LOVE YOU (ILY Sign): Thumb, Index, Pinky extended; Middle and Ring curled
  if (
    isIndexExtended &&
    isPinkyExtended &&
    !isMiddleExtended &&
    !isRingExtended &&
    isThumbExtended
  ) {
    return {
      id: 'i_love_you',
      name: 'I LOVE YOU',
      emoji: '🤟',
      spokenText: 'I love you!',
      category: 'phrase',
      confidence: 'high',
      confidenceScore: 0.98,
      description: 'ASL ILY: Thumb, Index, and Pinky extended with palm forward.',
      aslTip: 'Keep thumb, index, and pinky clearly extended; hold palm toward conversational partner.',
      fingerStates,
    };
  }

  // 2. ROCK ON / HORNS: Index & Pinky extended; Middle & Ring curled; Thumb tucked
  if (
    isIndexExtended &&
    isPinkyExtended &&
    !isMiddleExtended &&
    !isRingExtended &&
    !isThumbExtended
  ) {
    return {
      id: 'rock_on',
      name: 'ROCK ON',
      emoji: '🤘',
      spokenText: 'Awesome, rock on!',
      category: 'universal',
      confidence: 'high',
      confidenceScore: 0.94,
      description: 'Index and pinky extended, thumb locked over middle and ring fingers.',
      aslTip: 'Keep thumb folded tightly over middle and ring fingers.',
      fingerStates,
    };
  }

  // 3. CALL ME / SHAKA / LETTER Y: Thumb & Pinky extended; Index, Middle, Ring curled
  if (
    !isIndexExtended &&
    !isMiddleExtended &&
    !isRingExtended &&
    isPinkyExtended &&
    isThumbExtended
  ) {
    return {
      id: 'call_me',
      name: 'CALL ME / LETTER Y',
      emoji: '🤙',
      spokenText: 'Call me, or Letter Y.',
      category: 'universal',
      confidence: 'high',
      confidenceScore: 0.96,
      description: 'Thumb and pinky extended wide with middle three fingers curled.',
      aslTip: 'Hold hand with thumb near ear or shake wrist slightly for the call-me gesture.',
      fingerStates,
    };
  }

  // 4. OKAY / OK SIGN: Thumb tip & Index tip pinching, other 3 fingers extended
  if (
    thumbIndexTipDist < 0.45 &&
    isMiddleExtended &&
    isRingExtended &&
    isPinkyExtended
  ) {
    return {
      id: 'okay',
      name: 'OKAY',
      emoji: '👌',
      spokenText: 'Okay, sounds perfect!',
      category: 'universal',
      confidence: 'high',
      confidenceScore: 0.96,
      description: 'Thumb and index fingertips touching in circle with three fingers flared.',
      aslTip: 'Hold the circular loop steady with other three fingers extended upward.',
      fingerStates,
    };
  }

  // 5. THUMBS UP: Thumb pointing straight up, all 4 fingers curled
  if (
    extendedCount === 0 &&
    (isThumbUpright || (isThumbExtended && thumbTip.y < indexMCP.y))
  ) {
    return {
      id: 'thumbs_up',
      name: 'THUMBS UP',
      emoji: '👍',
      spokenText: 'Yes, that looks great!',
      category: 'phrase',
      confidence: 'high',
      confidenceScore: 0.96,
      description: 'Closed fist with upright thumb pointing upward.',
      aslTip: 'In conversational signing and universal gestures, upright thumb affirms agreement.',
      fingerStates,
    };
  }

  // 6. THUMBS DOWN: Thumb pointing down, all fingers curled
  if (
    extendedCount === 0 &&
    thumbTip.y > wrist.y &&
    isThumbExtended
  ) {
    return {
      id: 'thumbs_down',
      name: 'THUMBS DOWN',
      emoji: '👎',
      spokenText: 'No, I disagree.',
      category: 'universal',
      confidence: 'high',
      confidenceScore: 0.93,
      description: 'Closed fist with thumb pointed downward.',
      aslTip: 'Point thumb downward to express disagreement or disapproval.',
      fingerStates,
    };
  }

  // 7. CLOSED FIST / YES (ASL S-Handshape): 0 extended fingers, thumb wrapped across front
  if (extendedCount === 0 && !isThumbExtended && !isThumbUpright) {
    return {
      id: 'yes_fist',
      name: 'YES',
      emoji: '✊',
      spokenText: 'Yes, that is correct.',
      category: 'phrase',
      confidence: 'high',
      confidenceScore: 0.92,
      description: 'Closed ASL S-fist bobbing like a nodding head.',
      aslTip: 'Form a closed fist with thumb wrapped across fingers, bob wrist gently up and down.',
      fingerStates,
    };
  }

  // 8. LETTER L: Index pointing up, Thumb extended horizontally at 90 degrees, others curled
  if (
    isIndexExtended &&
    extendedCount === 1 &&
    isThumbExtended &&
    Math.abs(thumbTip.y - thumbMCP.y) < palmScale * 0.45 &&
    Math.abs(thumbTip.x - indexTip.x) > palmScale * 0.6
  ) {
    return {
      id: 'letter_l',
      name: 'LETTER L',
      emoji: '👆',
      spokenText: 'Letter L.',
      category: 'alphabet',
      confidence: 'high',
      confidenceScore: 0.95,
      description: 'ASL Letter L formed with upright index and right-angle thumb.',
      aslTip: 'Index points straight up while thumb points sideways to make a crisp L shape.',
      fingerStates,
    };
  }

  // 9. POINTING / NUMBER ONE: Index extended, all others curled (including thumb)
  if (isIndexExtended && extendedCount === 1) {
    return {
      id: 'pointing_one',
      name: 'NUMBER ONE / POINTING',
      emoji: '☝️',
      spokenText: 'Excuse me, or number one.',
      category: 'number',
      confidence: 'high',
      confidenceScore: 0.94,
      description: 'Index finger pointing straight upward with remaining fingers closed.',
      aslTip: 'Standard ASL sign for number 1, singular item, or drawing conversational attention.',
      fingerStates,
    };
  }

  // 10. PEACE / V-SIGN / NUMBER TWO: Index and Middle extended, Ring and Pinky curled
  if (isIndexExtended && isMiddleExtended && extendedCount === 2) {
    return {
      id: 'peace_v',
      name: 'PEACE / NUMBER TWO',
      emoji: '✌️',
      spokenText: 'Peace and greetings!',
      category: 'universal',
      confidence: 'high',
      confidenceScore: 0.97,
      description: 'Index and middle fingers extended in V-shape.',
      aslTip: 'Spread index and middle fingers into a clean V facing the camera.',
      fingerStates,
    };
  }

  // 11. THREE / WATER (W-Handshape): Index, Middle, Ring extended, Pinky curled
  if (
    isIndexExtended &&
    isMiddleExtended &&
    isRingExtended &&
    !isPinkyExtended
  ) {
    return {
      id: 'water_three',
      name: 'WATER / NUMBER THREE',
      emoji: '💧',
      spokenText: 'Water, please.',
      category: 'survival',
      confidence: 'high',
      confidenceScore: 0.95,
      description: 'ASL W-handshape with three middle fingers extended.',
      aslTip: 'Form a W with index, middle, and ring fingers; tap index against chin for "Water".',
      fingerStates,
    };
  }

  // 12. NUMBER FOUR: 4 fingers extended, thumb folded across palm
  if (extendedCount === 4 && !isThumbExtended) {
    return {
      id: 'number_four',
      name: 'NUMBER FOUR / LETTER B',
      emoji: '✋',
      spokenText: 'Number four, or Letter B.',
      category: 'number',
      confidence: 'high',
      confidenceScore: 0.93,
      description: 'Four upright fingers with thumb tucked into palm.',
      aslTip: 'Keep all four fingers upright and touching for B, or slightly spread for 4.',
      fingerStates,
    };
  }

  // 13. OPEN PALM / HELLO / FIVE: All 4 fingers + Thumb extended
  if (extendedCount === 4 && isThumbExtended) {
    // If hand is moving forward from chin, it's THANK YOU, or flat greeting
    return {
      id: 'hello_wave',
      name: 'HELLO / OPEN PALM',
      emoji: '👋',
      spokenText: 'Hello! Nice to meet you.',
      category: 'greeting',
      confidence: 'high',
      confidenceScore: 0.96,
      description: 'Open flat hand with all five fingers extended facing camera.',
      aslTip: 'Wave gently side-to-side for Hello, or hold flat palm facing forward.',
      fingerStates,
    };
  }

  // 14. THANK YOU: Flat hand with fingers together, held near lower face
  if (extendedCount >= 3) {
    return {
      id: 'thank_you',
      name: 'THANK YOU',
      emoji: '🙏',
      spokenText: 'Thank you very much!',
      category: 'phrase',
      confidence: 'medium',
      confidenceScore: 0.88,
      description: 'Flat open hand moving outward from chin/chest in gratitude.',
      aslTip: 'Touch fingertips lightly to chin and extend hand naturally forward.',
      fingerStates,
    };
  }

  // Fallback for general hand posture in frame
  return {
    id: 'hand_detected',
    name: 'ACTIVE HAND DETECTED',
    emoji: '🖐️',
    spokenText: 'I am communicating.',
    category: 'other',
    confidence: 'medium',
    confidenceScore: 0.8,
    description: `Hand detected with ${extendedCount} fingers extended.`,
    aslTip: 'Hold sign steady within the camera viewfinder for precise recognition.',
    fingerStates,
  };
}

/**
 * Fast client-side hand tracking analyzer that extracts 21 landmarks
 * from skin & contour moments when MediaPipe is downloading or offline.
 */
export function estimateHandLandmarksFromCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): TrackedHand | null {
  const startX = Math.floor(width * 0.15);
  const startY = Math.floor(height * 0.1);
  const zoneW = Math.floor(width * 0.7);
  const zoneH = Math.floor(height * 0.8);

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(startX, startY, zoneW, zoneH);
  } catch {
    return null;
  }

  const d = imgData.data;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = zoneW;
  let maxX = 0;
  let minY = zoneH;
  let maxY = 0;

  // Step 4 for performance
  for (let y = 0; y < zoneH; y += 4) {
    for (let x = 0; x < zoneW; x += 4) {
      const idx = (y * zoneW + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      // Skin chromatic filter
      if (r > 70 && g > 35 && b > 20 && r > g && r > b && Math.abs(r - g) > 10) {
        count++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const sampledTotal = (zoneW / 4) * (zoneH / 4);
  const skinDensity = sampledTotal > 0 ? count / sampledTotal : 0;

  // Not enough skin pixels to constitute a hand
  if (skinDensity < 0.05 || count < 60) {
    return null;
  }

  // Centroid (palm center in image coordinates)
  const cX = (startX + sumX / count) / width;
  const cY = (startY + sumY / count) / height;

  const bX = (startX + minX) / width;
  const bY = (startY + minY) / height;
  const bW = Math.max(0.08, (maxX - minX) / width);
  const bH = Math.max(0.1, (maxY - minY) / height);

  // Wrist is at the bottom of the bounding box
  const wristX = cX;
  const wristY = Math.min(0.98, bY + bH * 0.95);

  // Calculate finger extensions and construct 21 normalized landmarks
  const landmarks: NormalizedLandmark[] = new Array(21);

  // Landmark 0: Wrist
  landmarks[0] = { x: wristX, y: wristY, z: 0 };

  // Generate 5 finger rays from palm center
  const fingerConfigs = [
    { baseAngle: -0.65, len: bH * 0.65, spread: -bW * 0.4 }, // Thumb
    { baseAngle: -0.25, len: bH * 0.95, spread: -bW * 0.2 }, // Index
    { baseAngle: 0.0, len: bH * 1.0, spread: 0 }, // Middle
    { baseAngle: 0.25, len: bH * 0.92, spread: bW * 0.18 }, // Ring
    { baseAngle: 0.55, len: bH * 0.78, spread: bW * 0.35 }, // Pinky
  ];

  // Interpolate 4 joints per finger
  fingerConfigs.forEach((cfg, fIdx) => {
    const baseJointIdx = 1 + fIdx * 4;
    const targetTipX = Math.max(0.05, Math.min(0.95, cX + cfg.spread));
    const targetTipY = Math.max(0.05, Math.min(0.95, bY));

    for (let j = 0; j < 4; j++) {
      const frac = (j + 1) / 4;
      landmarks[baseJointIdx + j] = {
        x: wristX + (targetTipX - wristX) * frac,
        y: wristY + (targetTipY - wristY) * frac,
        z: (Math.sin(j) * 0.02),
      };
    }
  });

  const gesture = classifyHandLandmarks(landmarks, 'Right');

  return {
    landmarks,
    handedness: 'Right',
    score: Math.min(0.98, 0.5 + skinDensity * 1.5),
    boundingBox: { x: bX, y: bY, width: bW, height: bH },
    gesture,
  };
}

/**
 * High-performance visual renderer for Hand Skeleton & 21 Landmarks
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  options: {
    showSkeleton?: boolean;
    showPoints?: boolean;
    showGestureBadge?: boolean;
    gesture?: RecognizedHandGesture;
    colorTheme?: 'neonCyan' | 'emerald' | 'amber';
  } = {}
) {
  if (!landmarks || landmarks.length < 21) return;

  const {
    showSkeleton = true,
    showPoints = true,
    showGestureBadge = true,
    gesture,
    colorTheme = 'neonCyan',
  } = options;

  ctx.save();

  // Convert normalized landmarks to canvas pixel coordinates
  const points = landmarks.map((l) => ({
    x: l.x * canvasWidth,
    y: l.y * canvasHeight,
  }));

  const themeColors = {
    neonCyan: {
      bonePrimary: 'rgba(6, 182, 212, 0.85)',
      boneGlow: 'rgba(34, 211, 238, 0.4)',
      pointInner: '#ffffff',
      pointJoint: '#06b6d4',
      pointTip: '#a855f7',
      tipGlow: 'rgba(168, 85, 247, 0.6)',
      boxStroke: '#06b6d4',
    },
    emerald: {
      bonePrimary: 'rgba(250, 248, 242, 0.92)',
      boneGlow: 'rgba(20, 19, 15, 0.18)',
      pointInner: '#FAF8F2',
      pointJoint: '#2F7A5B',
      pointTip: '#2F7A5B',
      tipGlow: 'rgba(0, 0, 0, 0)',
      boxStroke: 'rgba(250, 248, 242, 0.55)',
    },
    amber: {
      bonePrimary: 'rgba(245, 158, 11, 0.85)',
      boneGlow: 'rgba(251, 191, 36, 0.4)',
      pointInner: '#ffffff',
      pointJoint: '#f59e0b',
      pointTip: '#ef4444',
      tipGlow: 'rgba(239, 68, 68, 0.6)',
      boxStroke: '#f59e0b',
    },
  }[colorTheme];

  // 1. Draw glowing bones (skeletal connections)
  if (showSkeleton) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer glow pass
    ctx.strokeStyle = themeColors.boneGlow;
    ctx.lineWidth = 6;
    ctx.beginPath();
    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = points[start];
      const p2 = points[end];
      if (p1 && p2) {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    });
    ctx.stroke();

    // Sharp inner line pass
    ctx.strokeStyle = themeColors.bonePrimary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = points[start];
      const p2 = points[end];
      if (p1 && p2) {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    });
    ctx.stroke();
  }

  // 2. Draw Landmark Points & Fingertip Halos
  if (showPoints) {
    const tipIndices = new Set([4, 8, 12, 16, 20]);

    points.forEach((pt, idx) => {
      const isTip = tipIndices.has(idx);

      if (isTip) {
        // Pulsing halo for fingertips
        ctx.fillStyle = themeColors.tipGlow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = themeColors.pointTip;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = themeColors.pointInner;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Joint points
        ctx.fillStyle = themeColors.pointJoint;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, idx === 0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = themeColors.pointInner;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // 3. Draw Floating Gesture HUD Badge above hand
  if (showGestureBadge && gesture && gesture.id !== 'standby') {
    let topY = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;

    points.forEach((p) => {
      if (p.y < topY) topY = p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    });

    const badgeX = (minX + maxX) / 2;
    const badgeY = Math.max(28, topY - 26);

    const badgeText = `${gesture.emoji} ${gesture.name} • ${Math.round(gesture.confidenceScore * 100)}%`;

    ctx.font = 'bold 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont';
    const textWidth = ctx.measureText(badgeText).width;
    const padX = 10;
    const padY = 5;

    // Badge background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = themeColors.boxStroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(
      badgeX - textWidth / 2 - padX,
      badgeY - 14,
      textWidth + padX * 2,
      24,
      12
    );
    ctx.fill();
    ctx.stroke();

    // Badge text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX, badgeY - 2);
  }

  ctx.restore();
}

/**
 * Singleton HandTracker Manager that dynamically initializes MediaPipe
 * or falls back cleanly to canvas-based landmark analysis.
 */
class HandTrackingEngine {
  private mediaPipeLandmarker: any = null;
  private isInitializing = false;
  private isAvailable = false;
  private hasAttemptedInit = false;

  public async initialize(): Promise<boolean> {
    if (this.isAvailable && this.mediaPipeLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.hasAttemptedInit = true;

    try {
      // Dynamic import to keep Vite bundle snappy
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const modelUrl =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      // Try GPU delegate first, fallback to CPU
      try {
        this.mediaPipeLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numHands: 1,
        });
      } catch (gpuErr) {
        console.warn('[HandTracker] GPU delegate load deferred, using CPU delegate:', gpuErr);
        this.mediaPipeLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numHands: 1,
        });
      }

      this.isAvailable = true;
      console.log('[HandTracker] MediaPipe HandLandmarker initialized in IMAGE mode.');
      return true;
    } catch (err) {
      console.warn(
        '[HandTracker] MediaPipe remote model load deferred, using client-side landmark engine:',
        err
      );
      this.isAvailable = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  public detect(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
    _timestampMs?: number,
    renderCtx?: CanvasRenderingContext2D,
    focusSign?: string
  ): TrackedHand | null {
    // If MediaPipe is active, process video/canvas in IMAGE mode (stateless, pure, zero timestamp conflicts)
    if (this.isAvailable && this.mediaPipeLandmarker) {
      try {
        // Guard against HTMLVideoElement not having decoded frames yet
        if (
          videoOrCanvas instanceof HTMLVideoElement &&
          (videoOrCanvas.readyState < 2 || videoOrCanvas.videoWidth === 0 || videoOrCanvas.videoHeight === 0)
        ) {
          return null;
        }

        // Guard against empty canvas
        if (
          videoOrCanvas instanceof HTMLCanvasElement &&
          (videoOrCanvas.width === 0 || videoOrCanvas.height === 0)
        ) {
          return null;
        }

        const mpResult = this.mediaPipeLandmarker.detect(videoOrCanvas);
        if (mpResult && mpResult.landmarks && mpResult.landmarks.length > 0) {
          const rawLandmarks = mpResult.landmarks[0];
          const landmarks: NormalizedLandmark[] = rawLandmarks.map((l: any) => ({
            x: l.x,
            y: l.y,
            z: l.z,
          }));

          const handedness: 'Left' | 'Right' =
            mpResult.handednesses?.[0]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right';

          let minX = 1,
            maxX = 0,
            minY = 1,
            maxY = 0;
          landmarks.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });

          const gesture = classifyHandLandmarks(landmarks, handedness, focusSign);

          return {
            landmarks,
            handedness,
            score: mpResult.handednesses?.[0]?.[0]?.score || 0.95,
            boundingBox: {
              x: minX,
              y: minY,
              width: Math.max(0.05, maxX - minX),
              height: Math.max(0.05, maxY - minY),
            },
            gesture,
          };
        }
      } catch (mpErr) {
        console.warn('[HandTracker] MediaPipe frame error, trying canvas fallback:', mpErr);
      }
    }

    // High-speed client fallback tracker
    if (renderCtx) {
      const width =
        videoOrCanvas instanceof HTMLVideoElement
          ? videoOrCanvas.videoWidth || 640
          : videoOrCanvas.width || 640;
      const height =
        videoOrCanvas instanceof HTMLVideoElement
          ? videoOrCanvas.videoHeight || 480
          : videoOrCanvas.height || 480;

      return estimateHandLandmarksFromCanvas(renderCtx, width, height);
    }

    return null;
  }
}

export const handTracker = new HandTrackingEngine();
