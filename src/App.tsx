import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppView } from './components/Header';
import { CameraTranslator } from './components/CameraTranslator';
import { TwoWayTranscript } from './components/TwoWayTranscript';
import { ASLLibraryModal } from './components/ASLLibraryModal';
import { SettingsModal } from './components/SettingsModal';
import { VideoTranslator } from './components/VideoTranslator';
import { GestureTranslation, TranscriptMessage, VoiceSettings } from './types';
import { speechManager } from './services/speechSynthesis';

const INITIAL_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoSpeak: true,
  soundEffects: true,
};

type ThemePref = 'light' | 'dark' | null;

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export default function App() {
  const [view, setView] = useState<AppView>('converse');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() =>
    readStored('gv_voice_settings', INITIAL_SETTINGS)
  );
  const [themePref, setThemePref] = useState<ThemePref>(() => readStored<ThemePref>('gv_theme', null));
  const [highContrast, setHighContrast] = useState<boolean>(() => readStored('gv_contrast', false));
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [practiceFocus, setPracticeFocus] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  const isDark = !highContrast && (themePref ? themePref === 'dark' : systemPrefersDark());

  // Reflect theme + contrast on <html> so CSS tokens switch everywhere at once.
  useEffect(() => {
    const root = document.documentElement;
    if (themePref) root.dataset.theme = themePref;
    else delete root.dataset.theme;
    if (highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', highContrast ? '#ffffff' : isDark ? '#131f24' : '#ffffff');
  }, [themePref, highContrast, isDark]);

  useEffect(() => speechManager.subscribeSpeaking(setIsSpeaking), []);

  const handleUpdateSettings = (next: VoiceSettings) => {
    setVoiceSettings(next);
    writeStored('gv_voice_settings', next);
  };

  const toggleTheme = () => {
    const next: ThemePref = isDark ? 'light' : 'dark';
    setThemePref(next);
    writeStored('gv_theme', next);
  };

  const toggleContrast = () => {
    setHighContrast((prev) => {
      writeStored('gv_contrast', !prev);
      return !prev;
    });
  };

  const handleNewTranslation = useCallback((translation: GestureTranslation) => {
    if (!translation.detected || !translation.spokenText) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `signer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'signer',
        text: translation.spokenText,
        gestureName:
          translation.gestureName === 'QUICK_SPEECH'
            ? undefined
            : translation.gestureName.split('__')[0].replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
        timestamp: translation.timestamp,
        confidence: translation.confidence,
        source: translation.source,
      },
    ]);
  }, []);

  const handleAddMessage = useCallback((msg: TranscriptMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleClearMessages = useCallback(() => setMessages([]), []);

  const handleSelectPracticeSign = useCallback((signName: string) => {
    setPracticeFocus(signName);
    setView('converse');
    window.scrollTo({ top: 0 });
  }, []);

  const handleVideoToConversation = useCallback((text: string, gestureName: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `signer_video_${Date.now()}`,
        role: 'signer',
        text,
        gestureName: gestureName ? 'From video' : undefined,
        timestamp: Date.now(),
        confidence: 'high',
      },
    ]);
    setView('converse');
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-ink btn-sm"
      >
        Skip to content
      </a>

      <Header
        view={view}
        setView={setView}
        isMuted={isMuted}
        toggleMute={() => setIsMuted((m) => !m)}
        isDark={isDark}
        toggleTheme={toggleTheme}
        isSpeaking={isSpeaking}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main id="main" className="flex-1 w-full lg:pl-[248px] pb-24 lg:pb-0">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        {view === 'converse' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <section aria-label="Signer" className="lg:col-span-7 min-w-0">
              <CameraTranslator
                voiceSettings={voiceSettings}
                isMuted={isMuted}
                onNewTranslation={handleNewTranslation}
                practiceFocus={practiceFocus}
                clearPracticeFocus={() => setPracticeFocus(null)}
                highContrast={highContrast}
                onSwitchToVideoUpload={() => setView('video')}
              />
            </section>
            <section
              aria-label="Conversation"
              className="lg:col-span-5 min-w-0 lg:sticky lg:top-10 lg:h-[calc(100vh-80px)]"
            >
              <TwoWayTranscript
                messages={messages}
                onAddMessage={handleAddMessage}
                onClearMessages={handleClearMessages}
                voiceSettings={voiceSettings}
                isMuted={isMuted}
                highContrast={highContrast}
              />
            </section>
          </div>
        )}

        {view === 'video' && (
          <VideoTranslator
            voiceSettings={voiceSettings}
            isMuted={isMuted}
            onSendToConversation={handleVideoToConversation}
            highContrast={highContrast}
          />
        )}

        {view === 'signs' && (
          <ASLLibraryModal onSelectPracticeSign={handleSelectPracticeSign} voiceSettings={voiceSettings} />
        )}
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        voiceSettings={voiceSettings}
        onUpdateSettings={handleUpdateSettings}
        highContrast={highContrast}
        onToggleHighContrast={toggleContrast}
      />
    </div>
  );
}
