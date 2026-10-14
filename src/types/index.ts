export type GestureCategory =
  | 'phrase'
  | 'alphabet'
  | 'number'
  | 'greeting'
  | 'survival'
  | 'universal'
  | 'other';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface GestureTranslation {
  detected: boolean;
  gestureName: string;
  spokenText: string;
  category?: GestureCategory;
  confidence: ConfidenceLevel;
  description?: string;
  aslTip?: string;
  timestamp: number;
  thumbnail?: string;
  /** 'ai' when the cloud model answered; 'offline' when the local hand-shape guesser did. */
  source?: 'ai' | 'offline';
}

export type ConversationRole = 'signer' | 'partner' | 'system';

export interface TranscriptMessage {
  id: string;
  role: ConversationRole;
  text: string;
  gestureName?: string;
  timestamp: number;
  confidence?: ConfidenceLevel;
  aslCue?: string;
  audioPlayed?: boolean;
  source?: 'ai' | 'offline';
}

export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
  soundEffects: boolean;
}

export interface ASLSignItem {
  id: string;
  name: string;
  category: 'alphabet' | 'number' | 'common' | 'survival';
  description: string;
  handshape: string;
  instruction: string;
  spokenEquivalent: string;
  iconSymbol?: string;
  aslTip?: string;
}

export interface VideoSignSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  signName: string;
  spokenText: string;
  meaning?: string;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  thumbnail?: string;
  fingerStates?: Record<string, string>;
  aslTip?: string;
}

export interface TimedTranscriptLine {
  startTime: number;
  endTime: number;
  speaker: string;
  signName: string;
  text: string;
}

export interface WholeTranscriptData {
  continuousText: string;
  wordCount: number;
  charCount: number;
  estimatedReadingTimeSec: number;
  timedLines: TimedTranscriptLine[];
}

export interface VideoTranslationResult {
  fullTranslation: string;
  aslGloss: string;
  confidence: ConfidenceLevel;
  summary: string;
  duration: number;
  segments: VideoSignSegment[];
  engine: 'gemini-multimodal' | 'hand-landmark-engine' | 'hybrid';
  translatedAt: number;
  fileName?: string;
  wordCount?: number;
  charCount?: number;
  estimatedReadingTimeSec?: number;
  wholeTranscript?: WholeTranscriptData;
  quotaExhausted?: boolean;
}

