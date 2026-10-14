import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2 } from 'lucide-react';
import { VoiceSettings } from '../types';
import { speechManager } from '../services/speechSynthesis';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
}

const Row: React.FC<{ title: string; hint: string; checked: boolean; onChange: () => void }> = ({
  title,
  hint,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-6 py-4 border-b-2 border-rule">
    <div>
      <p className="text-[1rem] font-extrabold text-ink">{title}</p>
      <p className="text-sm font-bold text-ink-3 mt-0.5">{hint}</p>
    </div>
    <button role="switch" aria-checked={checked} aria-label={title} onClick={onChange} className="switch" />
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  voiceSettings,
  onUpdateSettings,
  highContrast,
  onToggleHighContrast,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testing, setTesting] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVoices(speechManager.getVoices());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (patch: Partial<VoiceSettings>) => onUpdateSettings({ ...voiceSettings, ...patch });

  const handleTestVoice = () => {
    setTesting(true);
    speechManager.speak('Hello. This is how your signs will sound.', voiceSettings, () => setTesting(false));
  };

  const handleReset = () => {
    const defaultVoice = speechManager.getBestDefaultVoice();
    onUpdateSettings({
      voiceURI: defaultVoice?.voiceURI || '',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      autoSpeak: true,
      soundEffects: true,
    });
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`absolute right-0 top-0 h-full w-full max-w-[420px] bg-sheet border-l-2 border-rule flex flex-col outline-none transition-transform duration-200 ease-out ${
          open ? 'translate-x-0 shadow-2xl' : 'translate-x-full invisible'
        }`}
      >
        <div className="flex items-center justify-between h-16 pl-6 pr-3 border-b-2 border-rule shrink-0">
          <h2 id="settings-title" className="text-[1.375rem] font-black">
            Settings
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close settings">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-quiet px-6 py-6">
          <h3 className="eyebrow mb-4">Voice</h3>
          <p className="text-sm text-ink-3 -mt-2 mb-4">How your signs sound when spoken aloud.</p>

          <label htmlFor="voice" className="block text-sm font-extrabold text-ink mb-2">
            Voice
          </label>
          <select
            id="voice"
            value={voiceSettings.voiceURI}
            onChange={(e) => set({ voiceURI: e.target.value })}
            className="field mb-6"
          >
            <option value="">System default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} — {v.lang}
              </option>
            ))}
          </select>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-3">
              <label htmlFor="rate" className="font-extrabold text-ink">
                Speed
              </label>
              <span className="tnum font-extrabold text-partner-ink">{voiceSettings.rate.toFixed(2)}×</span>
            </div>
            <input
              id="rate"
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={voiceSettings.rate}
              onChange={(e) => set({ rate: parseFloat(e.target.value) })}
              className="range"
            />
            <div className="flex justify-between text-xs text-ink-3 mt-2">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-3">
              <label htmlFor="pitch" className="font-extrabold text-ink">
                Pitch
              </label>
              <span className="tnum font-extrabold text-partner-ink">{voiceSettings.pitch.toFixed(2)}</span>
            </div>
            <input
              id="pitch"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={voiceSettings.pitch}
              onChange={(e) => set({ pitch: parseFloat(e.target.value) })}
              className="range"
            />
            <div className="flex justify-between text-xs text-ink-3 mt-2">
              <span>Lower</span>
              <span>Higher</span>
            </div>
          </div>

          <button onClick={handleTestVoice} className="btn btn-line w-full mb-10">
            <Volume2 className="w-4 h-4" /> {testing ? 'Speaking…' : 'Hear a sample'}
          </button>

          <h3 className="eyebrow">Behaviour</h3>
          <div className="border-t-2 border-rule mt-3">
            <Row
              title="Speak signs automatically"
              hint="Say each sign as soon as it’s read. Off: tap “Say again” to speak."
              checked={voiceSettings.autoSpeak}
              onChange={() => set({ autoSpeak: !voiceSettings.autoSpeak })}
            />
            <Row
              title="Sound cues"
              hint="A soft tone when a sign is read or the partner starts speaking."
              checked={voiceSettings.soundEffects}
              onChange={() => set({ soundEffects: !voiceSettings.soundEffects })}
            />
            <Row
              title="High contrast"
              hint="Black on white with solid lines, for bright light or low vision."
              checked={highContrast}
              onChange={onToggleHighContrast}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t-2 border-rule shrink-0">
          <button onClick={handleReset} className="btn btn-sm btn-quiet -ml-3">
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
};
