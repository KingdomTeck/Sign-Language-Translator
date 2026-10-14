import React from 'react';
import { Volume2, VolumeX, Moon, Sun, SlidersHorizontal } from 'lucide-react';

export type AppView = 'converse' | 'video' | 'signs';

interface HeaderProps {
  view: AppView;
  setView: (view: AppView) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  isSpeaking: boolean;
  onOpenSettings: () => void;
}

const NAV: { id: AppView; label: string }[] = [
  { id: 'converse', label: 'Converse' },
  { id: 'video', label: 'Video' },
  { id: 'signs', label: 'Signs' },
];

/** Two overlapping marks — one per voice in the conversation. */
export const Wordmark: React.FC = () => (
  <span className="flex items-center gap-2.5 select-none">
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
      <circle cx="9" cy="9" r="8" fill="var(--signer)" />
      <circle cx="17" cy="9" r="8" fill="var(--partner)" style={{ mixBlendMode: 'multiply' }} />
    </svg>
    <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">GestureVoice</span>
  </span>
);

export const Header: React.FC<HeaderProps> = ({
  view,
  setView,
  isMuted,
  toggleMute,
  isDark,
  toggleTheme,
  isSpeaking,
  onOpenSettings,
}) => {
  const nav = (
    <nav aria-label="Primary" className="flex items-stretch gap-7 h-full">
      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          aria-current={view === item.id ? 'page' : undefined}
          className="navlink"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-rule">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-stretch justify-between gap-6">
        <div className="flex items-center gap-10">
          <button onClick={() => setView('converse')} aria-label="GestureVoice home">
            <Wordmark />
          </button>
          <div className="hidden md:flex items-stretch">{nav}</div>
        </div>

        <div className="flex items-center gap-1">
          <span
            aria-live="polite"
            className={`hidden sm:inline-flex items-center gap-2 mr-2 text-sm text-signer transition-opacity ${
              isSpeaking ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="speak-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {isSpeaking ? 'Speaking' : ''}
          </span>
          <button
            onClick={toggleMute}
            className="icon-btn"
            aria-pressed={isMuted}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            title={isMuted ? 'Voice is muted' : 'Mute voice'}
          >
            {isMuted ? <VolumeX className="w-[18px] h-[18px] text-alert" /> : <Volume2 className="w-[18px] h-[18px]" />}
          </button>
          <button
            onClick={toggleTheme}
            className="icon-btn"
            aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
            title={isDark ? 'Light theme' : 'Dark theme'}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <button onClick={onOpenSettings} className="icon-btn" aria-label="Voice and display settings" title="Settings">
            <SlidersHorizontal className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="md:hidden border-t border-rule px-4 h-12 flex items-stretch">{nav}</div>
    </header>
  );
};
