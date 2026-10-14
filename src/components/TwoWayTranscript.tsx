import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  Download,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { TranscriptMessage, VoiceSettings } from '../types';
import { speechRecognitionManager } from '../services/speechRecognition';
import { speechManager, soundEffects } from '../services/speechSynthesis';
import { findMatchingASLCue } from '../data/aslDictionary';
import { AnimatedMic, AnimatedSpeaker } from './AnimatedIcons';

interface TwoWayTranscriptProps {
  messages: TranscriptMessage[];
  onAddMessage: (msg: TranscriptMessage) => void;
  onClearMessages: () => void;
  voiceSettings: VoiceSettings;
  highContrast: boolean;
}

export const TwoWayTranscript: React.FC<TwoWayTranscriptProps> = ({
  messages,
  onAddMessage,
  onClearMessages,
  voiceSettings,
  highContrast,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [partnerTextInput, setPartnerTextInput] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText]);

  // Toggle microphone for hearing partner
  const toggleListening = () => {
    setMicError(null);

    if (isListening) {
      speechRecognitionManager.stop();
      setIsListening(false);
      setInterimText('');
    } else {
      const started = speechRecognitionManager.start({
        onInterimResult: (text) => {
          setInterimText(text);
        },
        onFinalResult: (text) => {
          setInterimText('');
          if (text.trim()) {
            handleNewPartnerMessage(text.trim());
          }
        },
        onError: (err) => {
          setMicError(err);
          setIsListening(false);
        },
        onStateChange: (listening) => {
          setIsListening(listening);
        },
      });

      if (!started) {
        setMicError('Speech recognition could not be started in this browser.');
      } else {
        if (voiceSettings.soundEffects) {
          soundEffects.playPartnerChime();
        }
      }
    }
  };

  // Add partner message to transcript and detect ASL cues
  const handleNewPartnerMessage = (text: string) => {
    const cue = findMatchingASLCue(text);

    const newMsg: TranscriptMessage = {
      id: `partner_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role: 'partner',
      text: text,
      timestamp: Date.now(),
      aslCue: cue?.name,
    };

    onAddMessage(newMsg);
  };

  // Manual partner text submission
  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerTextInput.trim()) return;
    handleNewPartnerMessage(partnerTextInput.trim());
    setPartnerTextInput('');
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = () => {
    const text = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}] ${m.role === 'signer' ? 'Signer (Camera/Voice)' : 'Partner (Spoken/Text)'}: ${m.text}`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download transcript as file
  const handleDownloadTranscript = () => {
    const text = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleTimeString()}] ${
            m.role === 'signer' ? 'Signer' : 'Partner'
          }: ${m.text}`
      )
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GestureVoice_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Partner Voice Response Screen (Liquid Glass + Siri-Inspired Dictation) */}
      <div className="w-full rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] p-6 sm:p-7 relative overflow-hidden flex flex-col gap-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <AnimatedMic className="w-4 h-4 text-sky-400" active={isListening} />
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Hearing Partner Voice Reply
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Live speech transcription for the signer
          </span>
        </div>

        {/* Primary Mic Trigger & Large Transcript Area */}
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-3xl bg-white/[0.03] border border-white/[0.06] text-center gap-4 relative z-10">
          <button
            onClick={toggleListening}
            className={`w-18 h-18 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white shadow-[0_0_35px_rgba(244,63,94,0.6)] ring-8 ring-rose-500/25 uiverse-neon-pulse'
                : 'uiverse-glow-btn bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-[0_4px_24px_rgba(14,165,233,0.4)] ring-4 ring-sky-500/10'
            }`}
            title={isListening ? 'Stop listening' : 'Start microphone listening'}
          >
            {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          <div className="flex flex-col items-center gap-1.5">
            <div className="text-base font-semibold text-white tracking-[-0.01em]">
              {isListening ? 'Listening to speech...' : 'Tap to Speak Reply'}
            </div>

            {/* UIverse Audio Wave Bars when listening */}
            {isListening && (
              <div className="flex items-center gap-1 h-5 my-1">
                <span className="uiverse-wave-bar bg-rose-400" style={{ animationDelay: '0.0s' }} />
                <span className="uiverse-wave-bar bg-rose-400" style={{ animationDelay: '0.15s' }} />
                <span className="uiverse-wave-bar bg-rose-300" style={{ animationDelay: '0.3s' }} />
                <span className="uiverse-wave-bar bg-rose-400" style={{ animationDelay: '0.45s' }} />
                <span className="uiverse-wave-bar bg-rose-300" style={{ animationDelay: '0.2s' }} />
              </div>
            )}

            <p className="text-xs text-slate-400 max-w-sm">
              {isListening
                ? 'Speak naturally. Your words will appear live in large high-contrast text below.'
                : 'Transcribes non-signer speech into large readable text in real-time.'}
            </p>
          </div>

          {/* Live Interim Transcript (Super Large for High Readability) */}
          {interimText && (
            <div className="w-full p-5 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-center animate-pulse">
              <span className="text-[10px] text-sky-300 font-semibold uppercase tracking-wider block mb-1">
                Live Speech Detected
              </span>
              <p className="text-2xl sm:text-3xl font-bold text-white tracking-[-0.02em] leading-relaxed">
                "{interimText}"
              </p>
            </div>
          )}

          {micError && (
            <div className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3.5 py-2 rounded-xl">
              {micError}
            </div>
          )}
        </div>

        {/* Fallback Text Input for Partner (Quiet/Noisy spaces) */}
        <form onSubmit={handlePartnerSubmit} className="flex items-center gap-2 relative z-10">
          <input
            type="text"
            value={partnerTextInput}
            onChange={(e) => setPartnerTextInput(e.target.value)}
            placeholder="Or type a quick response here..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-sky-400/50 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!partnerTextInput.trim()}
            className="uiverse-glow-btn px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-[0_2px_12px_rgba(14,165,233,0.3)]"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>

      {/* Two-Way Conversation Transcript History (Apple Messages Style) */}
      <div className="w-full rounded-3xl liquid-glass-card border border-white/[0.08] p-6 sm:p-7 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">
              Conversation History
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ({messages.length} messages)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyTranscript}
              disabled={messages.length === 0}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30 apple-press cursor-pointer"
              title="Copy transcript to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handleDownloadTranscript}
              disabled={messages.length === 0}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30 apple-press cursor-pointer"
              title="Download transcript file (.txt)"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClearMessages}
              disabled={messages.length === 0}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-all disabled:opacity-30 apple-press cursor-pointer"
              title="Clear transcript history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chronological Chat Messages with Zero-Pill Typography */}
        <div className="flex flex-col gap-3.5 max-h-[500px] overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Info className="w-7 h-7 text-slate-500" />
              <span className="font-medium text-slate-300">No conversation messages yet.</span>
              <span>Use camera to sign or speak into the microphone to start talking.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isSigner = msg.role === 'signer';
              const matchedCue = msg.aslCue ? findMatchingASLCue(msg.aslCue) : null;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col p-5 rounded-3xl border transition-all ${
                    isSigner
                      ? 'bg-emerald-500/10 border-emerald-500/25 ml-0 mr-4 sm:mr-12'
                      : 'bg-sky-500/10 border-sky-500/25 ml-4 sm:ml-12 mr-0'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`font-semibold uppercase tracking-wider text-[10px] ${
                          isSigner ? 'text-emerald-400' : 'text-sky-300'
                        }`}
                      >
                        {isSigner ? 'Signer (ASL → Voice)' : 'Hearing Partner (Voice → Text)'}
                      </span>
                      {msg.gestureName && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="font-mono text-emerald-300 font-medium">
                            {msg.gestureName}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Message Content */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                      "{msg.text}"
                    </p>

                    {/* Replay voice button with AnimatedSpeaker */}
                    <button
                      onClick={() => speechManager.speak(msg.text, voiceSettings)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] shrink-0 mt-0.5 apple-press transition-all cursor-pointer"
                      title="Speak phrase aloud"
                    >
                      <AnimatedSpeaker className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Matched ASL Visual Cue Card for Partner Speech */}
                  {matchedCue && (
                    <div className="mt-3 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center gap-3">
                      <span className="text-2xl p-1 rounded-xl bg-white/[0.06]">{matchedCue.iconSymbol || '🤟'}</span>
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-sky-200">
                          ASL Reference: {matchedCue.name}
                        </span>
                        <span className="text-slate-300 text-[11px]">
                          {matchedCue.handshape}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};
