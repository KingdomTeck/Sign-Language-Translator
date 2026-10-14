import React from 'react';

/**
 * Animated SVG Icons inspired by Lucide-Animated, Lordicon, UseAnimations, and Svgator.
 * Designed with CSS transitions, spring transforms, and keyframes for high-end micro-interactions.
 */

interface IconProps {
  className?: string;
  size?: number;
  active?: boolean;
}

// 1. Animated Camera: aperture rotates and breathes on hover or active state
export const AnimatedCamera: React.FC<IconProps> = ({ className = 'w-4 h-4', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 group-hover:scale-110 ${className}`}
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle
      cx="12"
      cy="13"
      r="3"
      className={`transition-all duration-500 origin-center ${
        active ? 'animate-spin stroke-emerald-400 stroke-[2.5]' : 'group-hover:stroke-emerald-400'
      }`}
      style={{ animationDuration: '4s' }}
    />
    {active && (
      <circle cx="18" cy="10" r="1.2" className="fill-rose-500 stroke-rose-500 animate-ping" />
    )}
  </svg>
);

// 2. Animated Microphone: soundwave ripple arcs pulse outward when listening
export const AnimatedMic: React.FC<IconProps> = ({ className = 'w-4 h-4', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 group-hover:scale-110 ${className}`}
  >
    <path
      d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
      className={active ? 'fill-sky-400/20 stroke-sky-400' : ''}
    />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    {active && (
      <>
        <path
          d="M21 7a10 10 0 0 1 0 10"
          className="stroke-sky-400 opacity-75 animate-pulse"
        />
        <path
          d="M3 7a10 10 0 0 0 0 10"
          className="stroke-sky-400 opacity-75 animate-pulse"
          style={{ animationDelay: '0.2s' }}
        />
      </>
    )}
  </svg>
);

// 3. Animated Hand / Gesture: palm with glowing 21-landmark joints and subtle wave
export const AnimatedHand: React.FC<IconProps> = ({ className = 'w-4 h-4', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 origin-bottom group-hover:rotate-12 ${
      active ? 'animate-bounce text-cyan-400' : ''
    } ${className}`}
  >
    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
    <path d="M14 10V4a2 2 0 0 0-4 0v6" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    {/* Micro landmark joints for futuristic feel */}
    <circle cx="10" cy="4" r="0.75" className="fill-cyan-400 stroke-none" />
    <circle cx="14" cy="4" r="0.75" className="fill-cyan-400 stroke-none" />
    <circle cx="18" cy="6" r="0.75" className="fill-cyan-400 stroke-none" />
  </svg>
);

// 4. Animated Speaker / Soundwave: progressive sound arcs
export const AnimatedSpeaker: React.FC<IconProps> = ({ className = 'w-4 h-4', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 group-hover:scale-110 ${className}`}
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path
      d="M15.54 8.46a5 5 0 0 1 0 7.07"
      className={active ? 'animate-pulse stroke-emerald-400' : ''}
    />
    <path
      d="M19.07 4.93a10 10 0 0 1 0 14.14"
      className={active ? 'animate-pulse stroke-emerald-400' : ''}
      style={{ animationDelay: '0.2s' }}
    />
  </svg>
);

// 5. Animated Sparkles: rotating kinetic 4-point star
export const AnimatedSparkles: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-700 group-hover:rotate-45 ${className}`}
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    <path d="M19 3v4" />
    <path d="M21 5h-4" />
  </svg>
);

// 6. Animated Video Film Reel: spinning reels
export const AnimatedVideo: React.FC<IconProps> = ({ className = 'w-4 h-4', active = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 group-hover:scale-110 ${className}`}
  >
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7" x2="7" y2="7" />
    <line x1="2" y1="17" x2="7" y2="17" />
    <line x1="17" y1="17" x2="22" y2="17" />
    <line x1="17" y1="7" x2="22" y2="7" />
    {active && (
      <circle cx="12" cy="7" r="1.5" className="fill-purple-400 stroke-purple-400 animate-ping" />
    )}
  </svg>
);

// 7. Animated Book: page flutter on hover
export const AnimatedBook: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`transition-transform duration-300 group-hover:-translate-y-0.5 ${className}`}
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

// 8. Animated Circle Radar Scanner (Circle Loaders inspired)
export const AnimatedRadarScanner: React.FC<{ size?: number; className?: string }> = ({
  size = 120,
  className = '',
}) => (
  <div
    className={`relative pointer-events-none flex items-center justify-center ${className}`}
    style={{ width: size, height: size }}
  >
    {/* Outer glowing ring */}
    <div className="absolute inset-0 rounded-full border border-cyan-400/25 animate-ping opacity-30" />
    {/* Middle radar sweep circle */}
    <div className="absolute inset-2 rounded-full border border-cyan-400/40 animate-pulse" />
    {/* Inner dashed targeting ring */}
    <div
      className="absolute inset-6 rounded-full border border-dashed border-cyan-300/50 animate-spin"
      style={{ animationDuration: '8s' }}
    />
    {/* Center crosshair */}
    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
    <div className="absolute w-8 h-[1px] bg-cyan-400/60" />
    <div className="absolute h-8 w-[1px] bg-cyan-400/60" />
  </div>
);
