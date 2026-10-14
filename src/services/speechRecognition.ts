// Cross-browser Speech Recognition wrapper for hearing partner voice input

export interface RecognitionCallbacks {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  onStateChange?: (isListening: boolean) => void;
}

export class SpeechRecognitionManager {
  private recognition: any = null;
  private isListening: boolean = false;
  private callbacks: RecognitionCallbacks = {};

  constructor() {
    this.init();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  private init() {
    if (!this.isSupported()) return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStateChange?.(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        if (finalTranscript.trim() && this.callbacks.onFinalResult) {
          this.callbacks.onFinalResult(finalTranscript.trim());
        } else if (interimTranscript.trim() && this.callbacks.onInterimResult) {
          this.callbacks.onInterimResult(interimTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        // 'no-speech' is expected during silent intervals
        if (event.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', event.error);
          this.callbacks.onError?.(
            event.error === 'not-allowed'
              ? 'Microphone permission was denied. Please allow microphone access.'
              : `Speech recognition error: ${event.error}`
          );
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onStateChange?.(false);
      };
    } catch (e) {
      console.error('Failed to initialize speech recognition:', e);
    }
  }

  public start(callbacks: RecognitionCallbacks): boolean {
    this.callbacks = callbacks;
    if (!this.recognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser.');
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (e: any) {
      // If already started, ignore or restart
      if (e.name === 'InvalidStateError') {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch {}
        }, 100);
        return true;
      }
      callbacks.onError?.(e.message || 'Could not start microphone');
      return false;
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    this.callbacks.onStateChange?.(false);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechRecognitionManager = new SpeechRecognitionManager();
