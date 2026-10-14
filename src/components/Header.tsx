import React from 'react';
import { Mascot } from './Mascot';
import { Volume2, VolumeX, Moon, Sun, SlidersHorizontal, Hand, Clapperboard, BookOpen } from 'lucide-react';

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

const NAV: { id: AppView; label: string; icon: React.ElementType; tint: string }[] = [
  { id: 'converse', label: 'Converse', icon: Hand, tint: 'var(--signer-edge)' },
  { id: 'video', label: 'Video', icon: Clapperboard, tint: 'var(--sun)' },
  { id: 'signs', label: 'Signs', icon: BookOpen, tint: 'var(--partner)' },
];

export const Wordmark: React.FC<{ small?: boolean }> = ({ small }) => (
  <span className="inline-flex items-center gap-2 select-none">
    <Mascot size={small ? 30 : 36} />
    <span className={`${small ? 'text-[1.375rem]' : 'text-[1.625rem]'} leading-none font-black tracking-[-0.03em] text-ink`}>
      gesture<span className="text-partner-ink">voice</span>
    </span>
  </span>
);

const SpeakingBadge: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    aria-live="polite"
    className={`inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-signer-ink transition-opacity ${
      on ? 'opacity-100' : 'opacity-0'
    }`}
  >
    <span className="speak-bars" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
    {on ? 'Speaking' : ''}
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
  const utilities = (
    <>
      <button
        onClick={toggleMute}
        className="icon-btn"
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
        title={isMuted ? 'Voice is muted' : 'Mute voice'}
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-alert" strokeWidth={2.5} /> : <Volume2 className="w-5 h-5" strokeWidth={2.5} />}
      </button>
      <button
        onClick={toggleTheme}
        className="icon-btn"
        aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
        title={isDark ? 'Light theme' : 'Dark theme'}
      >
        {isDark ? <Sun className="w-5 h-5" strokeWidth={2.5} /> : <Moon className="w-5 h-5" strokeWidth={2.5} />}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop: left rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[248px] flex-col border-r-2 border-rule bg-paper px-4 py-7">
        <button onClick={() => setView('converse')} className="px-4 mb-8 text-left" aria-label="GestureVoice home">
          <Wordmark />
        </button>
        <nav aria-label="Primary" className="flex flex-col gap-2">
          {NAV.map(({ id, label, icon: Icon, tint }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
              className="navitem"
            >
              <Icon className="w-7 h-7" strokeWidth={2.5} style={{ color: tint }} />
              {label}
            </button>
          ))}
          <button onClick={onOpenSettings} className="navitem">
            <SlidersHorizontal className="w-7 h-7 text-ink-3" strokeWidth={2.5} />
            Settings
          </button>
        </nav>
        <div className="mt-auto px-2 flex flex-col gap-3">
          <SpeakingBadge on={isSpeaking} />
          <div className="flex items-center gap-1">{utilities}</div>
        </div>
      </aside>

      {/* Mobile: top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-paper border-b-2 border-rule">
        <div className="h-16 px-4 flex items-center justify-between">
          <button onClick={() => setView('converse')} aria-label="GestureVoice home">
            <Wordmark small />
          </button>
          <div className="flex items-center gap-1">
            <SpeakingBadge on={isSpeaking} />
            {utilities}
          </div>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper border-t-2 border-rule px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around"
      >
        {NAV.map(({ id, label, icon: Icon, tint }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            aria-label={label}
            className="w-14 h-12 inline-flex items-center justify-center rounded-[14px] border-2 border-transparent aria-[current=page]:bg-partner-soft aria-[current=page]:border-[var(--partner-line)]"
          >
            <Icon className="w-7 h-7" strokeWidth={2.5} style={{ color: tint }} />
          </button>
        ))}
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-14 h-12 inline-flex items-center justify-center rounded-[14px] border-2 border-transparent"
        >
          <SlidersHorizontal className="w-7 h-7 text-ink-3" strokeWidth={2.5} />
        </button>
      </nav>
    </>
  );
};
