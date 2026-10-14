import React from 'react';
import {
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  AnimatedCamera,
  AnimatedVideo,
  AnimatedMic,
  AnimatedBook,
  AnimatedHand,
} from './AnimatedIcons';

interface HeaderProps {
  activeTab: 'translate' | 'video' | 'conversation' | 'library' | 'settings';
  setActiveTab: (tab: 'translate' | 'video' | 'conversation' | 'library' | 'settings') => void;
  isMuted: boolean;
  toggleMute: () => void;
  highContrast: boolean;
  toggleHighContrast: () => void;
  isSpeaking: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isMuted,
  toggleMute,
  highContrast,
  toggleHighContrast,
  isSpeaking,
}) => {
  const navItems = [
    {
      id: 'translate' as const,
      label: 'Live Camera',
      shortLabel: 'Camera',
      icon: AnimatedCamera,
      color: 'text-emerald-400',
    },
    {
      id: 'video' as const,
      label: 'Video File',
      shortLabel: 'Video',
      icon: AnimatedVideo,
      color: 'text-purple-400',
    },
    {
      id: 'conversation' as const,
      label: 'Two-Way Voice',
      shortLabel: 'Voice',
      icon: AnimatedMic,
      color: 'text-sky-400',
    },
    {
      id: 'library' as const,
      label: 'ASL Library',
      shortLabel: 'Library',
      icon: AnimatedBook,
      color: 'text-amber-400',
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      shortLabel: 'Settings',
      icon: SettingsIcon,
      color: 'text-slate-300',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-2xl backdrop-saturate-180 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-6">
        {/* Zone 1: Single Brand Wordmark adhering strictly to Top Bar Contract */}
        <button
          onClick={() => setActiveTab('translate')}
          className="flex items-center gap-2.5 shrink-0 group text-left cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <AnimatedHand className="w-4 h-4 text-emerald-400" active={isSpeaking} />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            GestureVoice
          </span>
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Navigation Tabs */}
        <nav className="hidden md:flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer apple-press ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] border border-white/[0.12]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
                title={item.label}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? item.color : 'text-slate-400'}`}
                  active={isActive}
                />
                <span className="whitespace-nowrap shrink-0">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action & Accessibility Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Vocalizing Indicator */}
          {isSpeaking && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-0.5 h-3.5">
                <span className="uiverse-wave-bar bg-emerald-400" style={{ animationDelay: '0.0s' }} />
                <span className="uiverse-wave-bar bg-emerald-400" style={{ animationDelay: '0.2s' }} />
                <span className="uiverse-wave-bar bg-emerald-300" style={{ animationDelay: '0.4s' }} />
                <span className="uiverse-wave-bar bg-emerald-400" style={{ animationDelay: '0.1s' }} />
              </div>
              <span className="hidden xl:inline text-[11px] font-mono font-medium">Vocalizing</span>
            </div>
          )}

          {/* Mute Toggle Button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-all duration-150 apple-press cursor-pointer ${
              isMuted
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                : 'bg-white/[0.06] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.1]'
            }`}
            title={isMuted ? 'Unmute voice output' : 'Mute voice output'}
            aria-label="Toggle Voice Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* High Contrast Toggle Button */}
          <button
            onClick={toggleHighContrast}
            className={`p-2 rounded-xl border transition-all duration-150 apple-press cursor-pointer ${
              highContrast
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.06] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.1]'
            }`}
            title={highContrast ? 'Standard theme' : 'High contrast accessibility theme'}
            aria-label="Toggle High Contrast"
          >
            {highContrast ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Primary Action Button */}
          {activeTab !== 'library' ? (
            <button
              onClick={() => setActiveTab('library')}
              className="uiverse-glow-btn hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold cursor-pointer shadow-[0_2px_12px_rgba(16,185,129,0.3)] whitespace-nowrap shrink-0"
            >
              <AnimatedBook className="w-3.5 h-3.5 text-white" />
              <span>Explore ASL</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('translate')}
              className="uiverse-glow-btn hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold cursor-pointer shadow-[0_2px_12px_rgba(16,185,129,0.3)] whitespace-nowrap shrink-0"
            >
              <AnimatedCamera className="w-3.5 h-3.5 text-white" />
              <span>Launch Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar (below header on small screens) */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-white/[0.06] bg-slate-950/90 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                isActive ? `${item.color} font-semibold` : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" active={isActive} />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
