import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, ArrowUp, Trash2, Download, Copy, Check, Volume2, Hand } from 'lucide-react';
import { Mascot } from './Mascot';
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
    <div className="sheet h-full min-h-[560px] flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 pl-5 pr-2 h-16 border-b-2 border-rule shrink-0">
        <h2 className="text-[1.25rem] font-black">Conversation</h2>
        {visible.length > 0 && (
          <div className="flex items-center">
            <button onClick={handleCopy} className="icon-btn" aria-label="Copy conversation" title="Copy">
              {copied ? <Check className="w-5 h-5 text-signer" strokeWidth={3} /> : <Copy className="w-5 h-5" strokeWidth={2.5} />}
            </button>
            <button onClick={handleDownload} className="icon-btn" aria-label="Download conversation" title="Download .txt">
              <Download className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button
              onClick={handleClear}
              className={confirmClear ? 'btn btn-sm btn-danger' : 'icon-btn'}
              aria-label="Clear conversation"
              title="Clear"
            >
              {confirmClear ? 'Clear all?' : <Trash2 className="w-5 h-5" strokeWidth={2.5} />}
            </button>
          </div>
        )}
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto scroll-quiet px-4 sm:px-5 py-5" aria-live="polite">
        {visible.length === 0 && !interimText ? (
          <div className="h-full flex flex-col justify-center gap-6 py-8">
            <div className="flex items-center gap-4">
              <Mascot size={64} className="bob shrink-0" />
              <div className="bubble font-extrabold">Nothing said yet. Here’s how it works:</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="tile p-4">
                <span className="inline-flex w-10 h-10 rounded-xl bg-signer-soft items-center justify-center">
                  <Hand className="w-6 h-6 text-signer-ink" strokeWidth={2.5} />
                </span>
                <p className="mt-3 font-black">Signs → speech</p>
                <p className="text-sm font-bold text-ink-2 mt-0.5">Each sign is spoken aloud and written here.</p>
              </div>
              <div className="tile p-4">
                <span className="inline-flex w-10 h-10 rounded-xl bg-partner-soft items-center justify-center">
                  <Mic className="w-6 h-6 text-partner-ink" strokeWidth={2.5} />
                </span>
                <p className="mt-3 font-black">Speech → text</p>
                <p className="text-sm font-bold text-ink-2 mt-0.5">Replies show up big, easy to read across a table.</p>
              </div>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-5">
            {visible.map((m, i) => {
              const isSigner = m.role === 'signer';
              const isLast = i === visible.length - 1;
              return (
                <li key={m.id} className={`arrive flex items-end gap-2.5 ${isSigner ? '' : 'flex-row-reverse'}`}>
                  {isSigner ? (
                    <Mascot size={36} className="shrink-0 mb-1" />
                  ) : (
                    <span className="shrink-0 mb-1 w-9 h-9 rounded-full bg-partner text-white inline-flex items-center justify-center" aria-hidden="true">
                      <Mic className="w-5 h-5" strokeWidth={2.5} />
                    </span>
                  )}
                  <div className={`min-w-0 max-w-[85%] flex flex-col ${isSigner ? 'items-start' : 'items-end'}`}>
                    <div className={`flex items-baseline gap-2 text-xs font-extrabold uppercase tracking-wider mb-1 px-1 ${isSigner ? '' : 'flex-row-reverse'}`}>
                      <span className={isSigner ? 'text-signer-ink' : 'text-partner-ink'}>{isSigner ? 'Signer' : 'Partner'}</span>
                      <span className="text-ink-3 tnum normal-case tracking-normal font-bold">{time(m.timestamp)}</span>
                    </div>
                    <div
                      className={`group relative rounded-2xl border-2 border-b-4 px-4 py-3 ${
                        isSigner
                          ? 'bg-sheet border-rule rounded-bl-md'
                          : 'bg-partner-soft border-[var(--partner-line)] rounded-br-md'
                      }`}
                    >
                      <p
                        className={`said ${
                          isSigner ? (isLast ? 'text-[1.375rem]' : 'text-[1.125rem]') : isLast ? 'text-[1.75rem]' : 'text-[1.25rem]'
                        } text-ink`}
                      >
                        {m.text}
                      </p>
                      {isSigner && m.gestureName && (
                        <p className="text-sm font-bold text-ink-3 mt-1">
                          signed “{m.gestureName}”
                          {m.source === 'offline' && <span className="text-coral"> · offline guess</span>}
                        </p>
                      )}
                      {!isSigner && m.aslCue && (
                        <p className="text-sm font-bold text-partner-ink mt-1">Related sign: {m.aslCue}</p>
                      )}
                    </div>
                  </div>
                  {isSigner && (
                    <button
                      onClick={() => !isMuted && speechManager.speak(m.text, voiceSettings)}
                      className="icon-btn !w-9 !h-9 mb-1 text-partner-ink shrink-0"
                      aria-label={`Say again: ${m.text}`}
                      title="Say again"
                    >
                      <Volume2 className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  )}
                </li>
              );
            })}
            {interimText && (
              <li className="flex items-end gap-2.5 flex-row-reverse">
                <span className="shrink-0 mb-1 w-9 h-9 rounded-full bg-partner text-white inline-flex items-center justify-center">
                  <span className="live-dot !bg-white" aria-hidden="true" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-br-md border-2 border-dashed border-[var(--partner-line)] px-4 py-3">
                  <p className="said text-[1.75rem] text-ink-2">{interimText}</p>
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* Partner reply */}
      <div className="border-t-2 border-rule p-3 sm:p-4 shrink-0">
        {micError && <p className="text-sm font-bold text-alert mb-2 px-1">{micError}</p>}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`btn shrink-0 ${isListening ? 'btn-danger' : 'btn-partner'}`}
            aria-pressed={isListening}
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 fill-current" /> Done
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" strokeWidth={2.5} /> Reply
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
            className="field"
            autoComplete="off"
          />
          <button type="submit" disabled={!draft.trim()} className="btn btn-partner shrink-0 !px-0 w-12" aria-label="Send reply">
            <ArrowUp className="w-5 h-5" strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  );
};
