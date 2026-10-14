import React, { useState } from 'react';
import { Search, X, Layers, ExternalLink } from 'lucide-react';
import { ASL_DICTIONARY } from '../data/aslDictionary';
import { ASLSignItem, VoiceSettings } from '../types';
import { speechManager } from '../services/speechSynthesis';
import {
  AnimatedBook,
  AnimatedCamera,
  AnimatedSpeaker,
  AnimatedHand,
  AnimatedSparkles,
} from './AnimatedIcons';

interface ASLLibraryModalProps {
  onSelectPracticeSign: (signName: string) => void;
  voiceSettings: VoiceSettings;
}

export const ASLLibraryModal: React.FC<ASLLibraryModalProps> = ({
  onSelectPracticeSign,
  voiceSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'common' | 'survival' | 'alphabet'
  >('all');
  const [inspectedSign, setInspectedSign] = useState<ASLSignItem | null>(null);

  const filteredSigns = ASL_DICTIONARY.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.spokenEquivalent.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Header & Search Bar (Liquid Glass) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-6 sm:p-7 rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.08] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.2)]">
              <AnimatedBook className="w-5 h-5 text-amber-300" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-[-0.02em]">
              ASL & Hand Gesture Reference Library
            </h2>
          </div>
          <p className="text-xs text-slate-300/80 mt-1.5 leading-relaxed">
            Browse standard American Sign Language signs, fingerspelling alphabet, and emergency gestures with 21-landmark anatomical guidance.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80 relative z-10">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search signs, letters, phrases..."
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-amber-400/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category Filter Tabs (Segmented Control conforming to constitution) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] overflow-x-auto">
        {(
          [
            { id: 'all', label: 'All Signs' },
            { id: 'common', label: 'Common Phrases' },
            { id: 'survival', label: 'Emergency & Survival' },
            { id: 'alphabet', label: 'Alphabet (A-Z)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all apple-press cursor-pointer ${
              selectedCategory === tab.id
                ? 'bg-amber-400 text-slate-950 shadow-[0_2px_12px_rgba(251,191,36,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sign Grid with Zero-Pill Typography */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSigns.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between p-5 rounded-3xl liquid-glass-card border border-white/[0.08] hover:border-amber-400/35 transition-all gap-4 group"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] group-hover:scale-105 transition-transform shadow-inner">
                    {item.iconSymbol || '✋'}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {item.name}
                    </h3>
                    {/* Unboxed Metadata (Zero Pill Rule) */}
                    <div className="text-[11px] font-medium text-amber-300/90 capitalize flex items-center gap-1.5 mt-0.5">
                      <span>{item.category}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono text-[10px]">ASL</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => speechManager.speak(item.spokenEquivalent, voiceSettings)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all apple-press cursor-pointer"
                  title="Listen to spoken vocalization"
                >
                  <AnimatedSpeaker className="w-4 h-4" />
                </button>
              </div>

              {/* Handshape & Instruction */}
              <div className="mt-3.5 flex flex-col gap-1.5 text-xs">
                <p className="text-slate-200 font-medium leading-relaxed">
                  <span className="text-amber-300 font-semibold text-[11px]">How to form: </span>
                  {item.instruction}
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <span className="text-slate-500 font-medium">Handshape: </span>
                  {item.handshape}
                </p>
              </div>
            </div>

            {/* Card Actions */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
              <button
                onClick={() => setInspectedSign(item)}
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                <span>Inspect Anatomy</span>
              </button>

              <button
                onClick={() => onSelectPracticeSign(item.name)}
                className="uiverse-glow-btn px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-emerald-500 hover:text-white text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 border border-white/[0.08] apple-press cursor-pointer"
                title="Practice this gesture with the live camera"
              >
                <AnimatedCamera className="w-3.5 h-3.5" />
                <span>Practice</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Anatomical Gesture Inspection Modal (Kitbitz & 3D Icons Inspired) */}
      {inspectedSign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl liquid-glass-card uiverse-edge-sheen border border-white/[0.12] p-6 sm:p-7 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-2xl bg-white/[0.06] border border-white/[0.1]">
                  {inspectedSign.iconSymbol || '✋'}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {inspectedSign.name}
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="capitalize">{inspectedSign.category}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>Spoken: &ldquo;{inspectedSign.spokenEquivalent}&rdquo;</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectedSign(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 21-Landmark Skeletal Positioning Guide */}
            <div className="flex flex-col gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  21-Landmark Finger Configuration
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {inspectedSign.instruction}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Handshape Structure
                </span>
                <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                  {inspectedSign.handshape}
                </p>
              </div>

              {inspectedSign.description && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Sign Usage & Meaning
                  </span>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    {inspectedSign.description}
                  </p>
                </div>
              )}

              {inspectedSign.aslTip && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-200">
                  <AnimatedSparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <span className="font-semibold text-emerald-300">Pro Tip: </span>
                    {inspectedSign.aslTip}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => speechManager.speak(inspectedSign.spokenEquivalent, voiceSettings)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer apple-press"
              >
                <AnimatedSpeaker className="w-4 h-4" />
                <span>Hear Voice</span>
              </button>

              <button
                onClick={() => {
                  onSelectPracticeSign(inspectedSign.name);
                  setInspectedSign(null);
                }}
                className="uiverse-glow-btn px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-[0_2px_12px_rgba(16,185,129,0.35)]"
              >
                <AnimatedCamera className="w-4 h-4" />
                <span>Practice with Camera</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
