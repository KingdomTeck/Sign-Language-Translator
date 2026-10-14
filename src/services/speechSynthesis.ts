import { VoiceSettings } from '../types';

class SoundController {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playDetectChime(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // AudioContext policy fallback
    }
  }

  playPartnerChime(enabled: boolean = true) {
    if (!enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.12); // C#5

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // AudioContext policy fallback
    }
  }
}

export const soundEffects = new SoundController();

export class SpeechSynthesisManager {
  private static instance: SpeechSynthesisManager;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakingListeners: Set<(isSpeaking: boolean) => void> = new Set();

  private constructor() {
    this.initVoices();
  }

  public static getInstance(): SpeechSynthesisManager {
    if (!SpeechSynthesisManager.instance) {
      SpeechSynthesisManager.instance = new SpeechSynthesisManager();
    }
    return SpeechSynthesisManager.instance;
  }

  private initVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        this.voices = list;
        this.voicesLoaded = true;
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded && typeof window !== 'undefined' && window.speechSynthesis) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  public getBestDefaultVoice(): SpeechSynthesisVoice | undefined {
    const all = this.getVoices();
    if (all.length === 0) return undefined;

    // Prefer natural English voices
    const preferred = all.find(
      (v) =>
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')) &&
        v.lang.startsWith('en')
    );
    if (preferred) return preferred;

    const anyEnglish = all.find((v) => v.lang.startsWith('en'));
    return anyEnglish || all[0];
  }

  public speak(
    text: string,
    settings: VoiceSettings,
    onEnd?: () => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve(false);
        return;
      }

      if (!text || text.trim() === '') {
        resolve(false);
        return;
      }

      // Stop any active speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Resolve voice
      const voices = this.getVoices();
      const selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        const fallback = this.getBestDefaultVoice();
        if (fallback) utterance.voice = fallback;
      }

      utterance.rate = Math.max(0.5, Math.min(2.0, settings.rate));
      utterance.pitch = Math.max(0.5, Math.min(2.0, settings.pitch));
      utterance.volume = Math.max(0, Math.min(1.0, settings.volume));

      utterance.onstart = () => {
        this.notifySpeaking(true);
      };

      utterance.onend = () => {
        this.notifySpeaking(false);
        this.currentUtterance = null;
        if (onEnd) onEnd();
        resolve(true);
      };

      utterance.onerror = (e) => {
        // Interrupted is normal when a newer utterance overrides
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('SpeechSynthesis error:', e.error);
        }
        this.notifySpeaking(false);
        this.currentUtterance = null;
        if (onEnd) onEnd();
        resolve(false);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech speak failed:', err);
        this.notifySpeaking(false);
        resolve(false);
      }
    });
  }

  public stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
      this.notifySpeaking(false);
    }
  }

  public isSpeaking(): boolean {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking);
  }

  public subscribeSpeaking(callback: (isSpeaking: boolean) => void): () => void {
    this.speakingListeners.add(callback);
    return () => {
      this.speakingListeners.delete(callback);
    };
  }

  private notifySpeaking(speaking: boolean) {
    this.speakingListeners.forEach((cb) => cb(speaking));
  }
}

export const speechManager = SpeechSynthesisManager.getInstance();
