import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraTranslator } from './components/CameraTranslator';
import { TwoWayTranscript } from './components/TwoWayTranscript';
import { ASLLibraryModal } from './components/ASLLibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { VideoTranslator } from './components/VideoTranslator';
import {
  GestureTranslation,
  TranscriptMessage,
  VoiceSettings,
} from './types';
import { speechManager } from './services/speechSynthesis';
import {
  AnimatedMic,
  AnimatedVideo,
  AnimatedSpeaker,
  AnimatedBook,
  AnimatedHand,
} from './components/AnimatedIcons';

const INITIAL_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoSpeak: true,
  soundEffects: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'translate' | 'video' | 'conversation' | 'library' | 'settings'>(
    'translate'
  );
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem('gv_voice_settings');
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [isMuted, setIsMuted] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [practiceFocus, setPracticeFocus] = useState<string | null>(null);

  const [messages, setMessages] = useState<TranscriptMessage[]>([
    {
      id: 'welcome_1',
      role: 'system',
      text: 'GestureVoice active. Position your hand inside the camera frame or use the microphone to talk back.',
      timestamp: Date.now() - 60000,
    },
  ]);

  // Subscribe to speech synthesis state
  useEffect(() => {
    const unsubscribe = speechManager.subscribeSpeaking((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => unsubscribe();
  }, []);

  // Save voice settings changes
  const handleUpdateSettings = (newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    try {
      localStorage.setItem('gv_voice_settings', JSON.stringify(newSettings));
    } catch {}
  };

  // Add new translated gesture to conversation (stable callback)
  const handleNewTranslation = useCallback((translation: GestureTranslation) => {
    if (!translation.detected || !translation.spokenText) return;

    const newMsg: TranscriptMessage = {
      id: `signer_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role: 'signer',
      text: translation.spokenText,
      gestureName: translation.gestureName,
      timestamp: translation.timestamp,
      confidence: translation.confidence,
    };

    setMessages((prev) => [...prev, newMsg]);
  }, []);

  // Add partner or system message
  const handleAddMessage = useCallback((msg: TranscriptMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleClearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSelectPracticeSign = useCallback((signName: string) => {
    setPracticeFocus(signName);
    setActiveTab('translate');
  }, []);

  const handleVideoToConversation = useCallback((text: string, gestureName: string) => {
    const newMsg: TranscriptMessage = {
      id: `signer_video_${Date.now()}`,
      role: 'signer',
      text,
      gestureName,
      timestamp: Date.now(),
      confidence: 'high',
    };
    setMessages((prev) => [...prev, newMsg]);
    setActiveTab('conversation');
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors relative overflow-hidden ${
        highContrast
          ? 'bg-black text-white'
          : 'bg-slate-950 text-slate-100 bg-ambient-grid'
      }`}
    >
      {/* Ambient background lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[360px] bg-gradient-to-b from-emerald-500/10 via-sky-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMuted={isMuted}
        toggleMute={() => setIsMuted(!isMuted)}
        highContrast={highContrast}
        toggleHighContrast={() => setHighContrast(!highContrast)}
        isSpeaking={isSpeaking}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col relative z-10">
        {activeTab === 'translate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Primary Camera Viewfinder and Translator */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <CameraTranslator
                voiceSettings={voiceSettings}
                isMuted={isMuted}
                onNewTranslation={handleNewTranslation}
                practiceFocus={practiceFocus}
                clearPracticeFocus={() => setPracticeFocus(null)}
                highContrast={highContrast}
                onSwitchToVideoUpload={() => setActiveTab('video')}
              />
            </div>

            {/* Side Companion Column: Live Feed & Quick Assistive Panels */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Partner Quick Voice Response Card */}
              <div className="p-5 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-slate-200 tracking-tight flex items-center gap-2">
                    <AnimatedMic className="w-3.5 h-3.5 text-sky-400" />
                    <span>Partner Voice Reply</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('conversation')}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    Open Chat →
                  </button>
                </div>
                <p className="text-xs text-slate-300/80 leading-relaxed mb-4">
                  Speak into the microphone to transcribe hearing replies into large real-time text for the signer.
                </p>
                <button
                  onClick={() => setActiveTab('conversation')}
                  className="uiverse-glow-btn w-full py-2.5 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition-all shadow-[0_4px_16px_rgba(14,165,233,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AnimatedMic className="w-3.5 h-3.5 text-white" />
                  <span>Start Two-Way Voice Reply</span>
                </button>
              </div>

              {/* Recent Utterances Feed */}
              <div className="p-5 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] flex flex-col">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <h3 className="font-semibold text-slate-200 tracking-tight flex items-center gap-2">
                    <AnimatedSpeaker className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recent Vocalizations</span>
                  </h3>
                  <span className="text-slate-400 font-mono tabular-nums text-xs">
                    {messages.filter((m) => m.role === 'signer').length} signs
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {messages
                    .filter((m) => m.role === 'signer')
                    .slice(-5)
                    .reverse()
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-all flex items-start justify-between gap-3 group"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-white truncate">
                            "{m.text}"
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5 flex items-center gap-1.5">
                            <span className="text-emerald-400 font-medium">{m.gestureName}</span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span>
                              {new Date(m.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        </div>
                        <button
                          onClick={() => speechManager.speak(m.text, voiceSettings)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 shrink-0 transition-all apple-press cursor-pointer"
                          title="Replay voice audio"
                        >
                          <AnimatedSpeaker className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  {messages.filter((m) => m.role === 'signer').length === 0 && (
                    <div className="text-center py-7 text-xs text-slate-400 flex flex-col items-center gap-1.5">
                      <AnimatedHand className="w-6 h-6 text-slate-500" />
                      <span>Form an ASL gesture in front of the camera to vocalize words.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Upload Quick Access Card */}
              <div className="p-5 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-200 tracking-tight flex items-center gap-2">
                    <AnimatedVideo className="w-3.5 h-3.5 text-purple-400" />
                    <span>Upload Sign Video</span>
                  </h3>
                  <span className="text-xs text-purple-300 font-medium">
                    Continuous translation
                  </span>
                </div>
                <p className="text-xs text-slate-300/80 leading-relaxed mb-3.5">
                  Have a recorded video of someone signing? Upload it to translate the full video to text & voiceover.
                </p>
                <button
                  onClick={() => setActiveTab('video')}
                  className="uiverse-glow-btn w-full py-2.5 px-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <AnimatedVideo className="w-3.5 h-3.5 text-purple-400" />
                  <span>Open Video Translator</span>
                </button>
              </div>

              {/* ASL Quick Practice Suggestion */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AnimatedBook className="w-5 h-5 text-amber-300" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">ASL Sign Library</span>
                    <span className="text-[11px] text-slate-400">Explore gestures & fingerspelling</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('library')}
                  className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-semibold transition-all apple-press cursor-pointer"
                >
                  Browse →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <VideoTranslator
            voiceSettings={voiceSettings}
            isMuted={isMuted}
            onSendToConversation={handleVideoToConversation}
            highContrast={highContrast}
          />
        )}

        {activeTab === 'conversation' && (
          <TwoWayTranscript
            messages={messages}
            onAddMessage={handleAddMessage}
            onClearMessages={handleClearMessages}
            voiceSettings={voiceSettings}
            highContrast={highContrast}
          />
        )}

        {activeTab === 'library' && (
          <ASLLibraryModal
            onSelectPracticeSign={handleSelectPracticeSign}
            voiceSettings={voiceSettings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModal
            voiceSettings={voiceSettings}
            onUpdateSettings={handleUpdateSettings}
            highContrast={highContrast}
            onToggleHighContrast={() => setHighContrast(!highContrast)}
          />
        )}
      </main>

      {/* Accessible Footer with single-line quiet metadata */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>GestureVoice Assistive Sign Translator</span>
            <span aria-hidden="true">·</span>
            <span>Multimodal Vision & Speech Synthesis</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Designed for seamless communication between sign language users and non-signers.
          </div>
        </div>
      </footer>
    </div>
  );
}
