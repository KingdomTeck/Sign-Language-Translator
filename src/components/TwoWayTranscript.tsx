import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, ArrowUp, Trash2, Download, Copy, Check, Volume2 } from 'lucide-react';
import { TranscriptMessage, VoiceSettings } from '../types';
import { speechRecognitionManager } from '../services/speechRecognition';
import { speechManager, soundEffects } from '../services/speechSynthesis';
import { findMatchingASLCue } from '../data/aslDictionary';

interface TwoWayTranscriptProps {
  messages: TranscriptMessage[];
  onAddMessage: (msg: TranscriptMessage) => void;
  onClearMessages: () => void;
  voiceSettings: VoiceSettings;
  isMuted?: boolean;
  highContrast: boolean;
}

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const TwoWayTranscript: React.FC<TwoWayTranscriptProps> = ({
  messages,
  onAddMessage,
  onClearMessages,
  voiceSettings,
  isMuted = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [draft, setDraft] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const visible = messages.filter((m) => m.role !== 'system');

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visible.length, interimText]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const addPartnerMessage = (text: string) => {
    const cue = findMatchingASLCue(text);
    onAddMessage({
      id: `partner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'partner',
      text,
      timestamp: Date.now(),
      aslCue: cue?.name,
    });
  };

  const toggleListening = () => {
    setMicError(null);
    if (isListening) {
      speechRecognitionManager.stop();
      setIsListening(false);
      setInterimText('');
      return;
    }
    const started = speechRecognitionManager.start({
      onInterimResult: setInterimText,
      onFinalResult: (text) => {
        setInterimText('');
        if (text.trim()) addPartnerMessage(text.trim());
      },
      onError: (err) => {
        setMicError(err);
        setIsListening(false);
      },
      onStateChange: setIsListening,
    });
    if (!started) {
      setMicError('This browser can’t listen for speech. Type the reply instead.');
    } else if (voiceSettings.soundEffects) {
      soundEffects.playPartnerChime();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addPartnerMessage(draft.trim());
    setDraft('');
  };

  const transcriptText = (sep: string) =>
    visible
      .map((m) => `[${time(m.timestamp)}] ${m.role === 'signer' ? 'Signer' : 'Partner'}: ${m.text}`)
      .join(sep);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcriptText('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([transcriptText('\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    onClearMessages();
  };

  return (
    <div className="sheet h-full min-h-[520px] flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 pl-5 pr-2 h-14 border-b border-rule shrink-0">
        <h2 className="text-[0.9375rem] font-semibold">Conversation</h2>
        {visible.length > 0 && (
          <div className="flex items-center">
            <button onClick={handleCopy} className="icon-btn" aria-label="Copy conversation" title="Copy">
              {copied ? <Check className="w-4 h-4 text-signer" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={handleDownload} className="icon-btn" aria-label="Download conversation" title="Download .txt">
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className={confirmClear ? 'btn btn-sm btn-quiet !text-alert' : 'icon-btn'}
              aria-label="Clear conversation"
              title="Clear"
            >
              {confirmClear ? 'Clear all?' : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto scroll-quiet px-5 py-5" aria-live="polite">
        {visible.length === 0 && !interimText ? (
          <div className="h-full flex flex-col justify-center max-w-[22rem] mx-auto py-10">
            <p className="said text-[1.75rem] text-ink">Nothing said yet.</p>
            <dl className="mt-6 space-y-4 text-[0.9375rem] text-ink-2">
              <div className="flex gap-3">
                <span className="mt-[7px] w-2 h-2 rounded-full bg-signer shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">Signs become speech</dt>
                  <dd>Each sign the camera reads is spoken aloud and written here.</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-[7px] w-2 h-2 rounded-full bg-partner shrink-0" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">Speech becomes text</dt>
                  <dd>Replies appear in large type, easy to read from across a table.</dd>
                </div>
              </div>
            </dl>
          </div>
        ) : (
          <ol className="flex flex-col gap-6">
            {visible.map((m, i) => {
              const isSigner = m.role === 'signer';
              const isLast = i === visible.length - 1;
              return (
                <li key={m.id} className={`arrive group pl-4 border-l-2 ${isSigner ? 'border-signer' : 'border-partner'}`}>
                  <div className="flex items-baseline gap-2 text-[0.8125rem]">
                    <span className={`font-semibold ${isSigner ? 'text-signer' : 'text-partner'}`}>
                      {isSigner ? 'Signer' : 'Partner'}
                    </span>
                    <span className="text-ink-3 tnum">{time(m.timestamp)}</span>
                    {isSigner && m.gestureName && <span className="text-ink-3">· signed “{m.gestureName}”</span>}
                  </div>
                  <div className="flex items-start gap-2 mt-1">
                    <p
                      className={`said flex-1 ${
                        isSigner
                          ? isLast ? 'text-[1.75rem]' : 'text-[1.375rem]'
                          : isLast ? 'text-[2rem]' : 'text-[1.5rem]'
                      } text-ink`}
                    >
                      {m.text}
                    </p>
                    {isSigner && (
                      <button
                        onClick={() => !isMuted && speechManager.speak(m.text, voiceSettings)}
                        className="icon-btn -mt-1 opacity-60 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Say again: ${m.text}`}
                        title="Say again"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {!isSigner && m.aslCue && (
                    <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                      Related sign: <span className="text-ink-2 font-medium">{m.aslCue}</span>
                    </p>
                  )}
                </li>
              );
            })}
            {interimText && (
              <li className="pl-4 border-l-2 border-dashed border-partner">
                <div className="flex items-center gap-2 text-[0.8125rem] text-partner font-semibold">
                  <span className="live-dot" aria-hidden="true" /> Partner is speaking
                </div>
                <p className="said italic text-[2rem] text-ink-2 mt-1">{interimText}</p>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* Partner reply */}
      <div className="border-t border-rule p-3 sm:p-4 shrink-0 bg-sheet">
        {micError && <p className="text-sm text-alert mb-2 px-1">{micError}</p>}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`btn shrink-0 ${isListening ? 'btn-ink' : 'btn-partner'}`}
            aria-pressed={isListening}
          >
            {isListening ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Done
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" /> Reply
              </>
            )}
          </button>
          <label htmlFor="partner-reply" className="sr-only">
            Type a reply
          </label>
          <input
            id="partner-reply"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isListening ? 'Listening…' : 'or type a reply'}
            className="field !rounded-full"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="icon-btn shrink-0 !bg-ink !text-paper disabled:!bg-rule disabled:!text-ink-3"
            aria-label="Send reply"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
