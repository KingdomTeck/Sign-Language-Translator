import React from 'react';

type Mood = 'happy' | 'listening' | 'thinking';

interface MascotProps {
  size?: number;
  mood?: Mood;
  className?: string;
}

/**
 * Palmer — a friendly open hand. The app's guide and the signer's avatar.
 * Built from simple rounded shapes so it reads at 28px and at 160px.
 */
export const Mascot: React.FC<MascotProps> = ({ size = 96, mood = 'happy', className = '' }) => {
  const pupilY = mood === 'thinking' ? 55 : 58;
  const pupilDx = mood === 'thinking' ? 2 : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* fingers */}
      <g fill="var(--signer)" stroke="var(--signer-edge)" strokeWidth="3">
        <rect x="26" y="10" width="13" height="40" rx="6.5" />
        <rect x="41" y="4" width="13" height="44" rx="6.5" />
        <rect x="56" y="8" width="13" height="42" rx="6.5" />
        <rect x="71" y="18" width="12" height="34" rx="6" />
        <rect x="6" y="44" width="13" height="30" rx="6.5" transform="rotate(-32 12 58)" />
      </g>
      {/* palm */}
      <rect x="22" y="36" width="64" height="58" rx="24" fill="var(--signer)" stroke="var(--signer-edge)" strokeWidth="3" />
      <path d="M26 78 C34 90 74 90 82 78 L82 82 C76 94 32 94 26 82 Z" fill="var(--signer-edge)" opacity="0.5" />
      {/* eyes */}
      <g>
        <ellipse cx="44" cy="58" rx="8" ry="9.5" fill="#fff" />
        <ellipse cx="64" cy="58" rx="8" ry="9.5" fill="#fff" />
        <circle cx={46 + pupilDx} cy={pupilY + 1} r="4.2" fill="#3c3c3c" />
        <circle cx={66 + pupilDx} cy={pupilY + 1} r="4.2" fill="#3c3c3c" />
        <circle cx={47 + pupilDx} cy={pupilY - 1} r="1.4" fill="#fff" />
        <circle cx={67 + pupilDx} cy={pupilY - 1} r="1.4" fill="#fff" />
      </g>
      {/* mouth */}
      {mood === 'listening' ? (
        <ellipse cx="54" cy="77" rx="5" ry="4" fill="#3c3c3c" />
      ) : mood === 'thinking' ? (
        <path d="M48 77 H60" stroke="#3c3c3c" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M46 74 Q54 83 62 74" fill="none" stroke="#3c3c3c" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* cheeks */}
      <circle cx="34" cy="70" r="4" fill="var(--sun)" opacity="0.45" />
      <circle cx="74" cy="70" r="4" fill="var(--sun)" opacity="0.45" />
    </svg>
  );
};

/** Mascot + speech bubble, the app's way of talking to you. */
export const MascotSays: React.FC<{
  children: React.ReactNode;
  size?: number;
  mood?: Mood;
  className?: string;
}> = ({ children, size = 72, mood, className = '' }) => (
  <div className={`flex items-center gap-5 ${className}`}>
    <Mascot size={size} mood={mood} className="bob shrink-0" />
    <div className="bubble text-[1rem] font-bold leading-snug">{children}</div>
  </div>
);
