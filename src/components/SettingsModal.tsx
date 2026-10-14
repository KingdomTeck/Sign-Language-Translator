import React, { useState, useEffect } from 'react';
import { Volume2, Sliders, RotateCcw } from 'lucide-react';
import { VoiceSettings } from '../types';
import { speechManager } from '../services/speechSynthesis';
import { AnimatedSpeaker } from './AnimatedIcons';

interface SettingsModalProps {
  voiceSettings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  voiceSettings,
  onUpdateSettings,
  highContrast,
  onToggleHighContrast,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    const list = speechManager.getVoices();
    setVoices(list);
  }, []);

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({
      ...voiceSettings,
      voiceURI: e.target.value,
    });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...voiceSettings,
      rate: parseFloat(e.target.value),
    });
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...voiceSettings,
      pitch: parseFloat(e.target.value),
    });
  };

  const handleTestVoice = () => {
    setTested(true);
    speechManager.speak(
      'Hello! This is your GestureVoice spoken translator speaking at your chosen speed and pitch.',
      voiceSettings,
      () => setTested(false)
    );
  };

  const handleResetDefaults = () => {
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
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-bold text-white tracking-[-0.02em]">
            Voice & Audio Preferences
          </h2>
          <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
            Configure spoken voice personas, playback speed, and assistive audio feedback.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs font-semibold border border-white/[0.08] transition-all apple-press relative z-10 cursor-pointer"
          title="Reset to recommended voice settings"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Voice Controls (Apple Settings Group) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Voice Selector Card */}
        <div className="p-6 rounded-3xl liquid-glass-card border border-white/[0.08] flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <AnimatedSpeaker className="w-4 h-4" active={tested} />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Voice Persona</h3>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-medium">
              Device Speech Engine:
            </label>
            <select
              value={voiceSettings.voiceURI}
              onChange={handleVoiceChange}
              className="bg-white/[0.04] border border-white/[0.08] text-white rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-emerald-400/50 transition-colors cursor-pointer"
            >
              {voices.length === 0 ? (
                <option value="" className="bg-slate-900">Default System Voice</option>
              ) : (
                voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900">
                    {v.name} ({v.lang})
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={handleTestVoice}
            disabled={tested}
            className="uiverse-glow-btn w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.3)] apple-press cursor-pointer"
          >
            <AnimatedSpeaker className="w-4 h-4" active={tested} />
            <span>{tested ? 'Speaking Sample...' : 'Test Spoken Voice'}</span>
          </button>
        </div>

        {/* Speed, Pitch & Volume Sliders */}
        <div className="p-6 rounded-3xl liquid-glass-card border border-white/[0.08] flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Pitch & Cadence</h3>
          </div>

          {/* Rate Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="font-medium">Speaking Speed</span>
              <span className="font-mono text-emerald-400 font-semibold">{voiceSettings.rate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={voiceSettings.rate}
              onChange={handleRateChange}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>0.6x (Deliberate)</span>
              <span>1.0x (Natural)</span>
              <span>1.5x (Fast)</span>
            </div>
          </div>

          {/* Pitch Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="font-medium">Vocal Pitch</span>
              <span className="font-mono text-sky-400 font-semibold">{voiceSettings.pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.05"
              value={voiceSettings.pitch}
              onChange={handlePitchChange}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Deep</span>
              <span>Default</span>
              <span>Higher</span>
            </div>
          </div>
        </div>
      </div>

      {/* Behavioral & Accessibility Preferences (iOS Inset Grouped Rows) */}
      <div className="p-6 sm:p-7 rounded-3xl liquid-glass-card border border-white/[0.08] flex flex-col gap-5">
        <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">Assistive Switches</h3>

        <div className="flex flex-col gap-3">
          {/* Auto speak toggle */}
          <div
            onClick={() => onUpdateSettings({ ...voiceSettings, autoSpeak: !voiceSettings.autoSpeak })}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] cursor-pointer transition-all apple-press"
          >
            <div>
              <div className="text-xs font-semibold text-white">Instant Auto-Vocalization</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Automatically speak recognized gestures aloud through speakers without tapping.
              </div>
            </div>
            {/* iOS Toggle Switch */}
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                voiceSettings.autoSpeak ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  voiceSettings.autoSpeak ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Audio Chime Feedback */}
          <div
            onClick={() => onUpdateSettings({ ...voiceSettings, soundEffects: !voiceSettings.soundEffects })}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] cursor-pointer transition-all apple-press"
          >
            <div>
              <div className="text-xs font-semibold text-white">Auditory Cue Chimes</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Play subtle sensory chime audio tones when gestures lock or partner begins speaking.
              </div>
            </div>
            {/* iOS Toggle Switch */}
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                voiceSettings.soundEffects ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  voiceSettings.soundEffects ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* High Contrast Mode */}
          <div
            onClick={onToggleHighContrast}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] cursor-pointer transition-all apple-press"
          >
            <div>
              <div className="text-xs font-semibold text-white">High Contrast AAA Mode</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Maximum contrast monochrome palette for bright sunlight or low-vision requirements.
              </div>
            </div>
            {/* iOS Toggle Switch */}
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                highContrast ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  highContrast ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
