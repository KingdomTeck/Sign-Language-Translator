import React, { useMemo, useState } from 'react';
import { Search, Volume2, Hand } from 'lucide-react';
import { Mascot } from './Mascot';
import { ASL_DICTIONARY } from '../data/aslDictionary';
import { ASLSignItem, VoiceSettings } from '../types';
import { speechManager } from '../services/speechSynthesis';

interface ASLLibraryModalProps {
  onSelectPracticeSign: (signName: string) => void;
  voiceSettings: VoiceSettings;
}

type Filter = 'all' | 'common' | 'survival' | 'alphabet';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'common', label: 'Everyday' },
  { id: 'survival', label: 'Needs & urgent' },
  { id: 'alphabet', label: 'Alphabet' },
];

const glyphOf = (item: ASLSignItem) =>
  item.category === 'alphabet' || item.category === 'number'
    ? item.name.replace(/^(Letter|Number)\s+/i, '')
    : null;

export const ASLLibraryModal: React.FC<ASLLibraryModalProps> = ({ onSelectPracticeSign, voiceSettings }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string>(ASL_DICTIONARY[0]?.id);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ASL_DICTIONARY.filter(
      (item) =>
        (filter === 'all' || item.category === filter) &&
        (!q ||
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.spokenEquivalent.toLowerCase().includes(q))
    );
  }, [query, filter]);

  const words = results.filter((i) => !glyphOf(i));
  const letters = results.filter((i) => glyphOf(i));
  const selected = ASL_DICTIONARY.find((i) => i.id === selectedId) ?? results[0];

  const detail = selected && (
    <article key={selected.id} className="arrive">
      <p className="eyebrow">{selected.category === 'alphabet' ? 'Fingerspelling' : selected.category === 'survival' ? 'Needs & urgent' : 'Everyday'}</p>
      <div className="flex items-center gap-4 mt-2">
        {glyphOf(selected) && (
          <span
            className="shrink-0 w-20 h-20 rounded-2xl bg-partner-soft border-2 border-b-4 border-[var(--partner-line)] inline-flex items-center justify-center text-[3rem] font-black text-partner-ink"
            aria-hidden="true"
          >
            {glyphOf(selected)}
          </span>
        )}
        <h2 className="text-[2rem] font-black leading-[1.1] text-ink">{selected.name}</h2>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Mascot size={52} className="shrink-0" />
        <div className="bubble font-extrabold">“{selected.spokenEquivalent}”</div>
      </div>

      <dl className="mt-7 space-y-5 text-[1rem]">
        <div>
          <dt className="eyebrow mb-1.5">How to form it</dt>
          <dd className="text-ink font-bold leading-relaxed">{selected.instruction}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1.5">Handshape</dt>
          <dd className="text-ink-2 font-bold leading-relaxed">{selected.handshape}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1.5">Movement</dt>
          <dd className="text-ink-2 font-bold leading-relaxed">{selected.description}</dd>
        </div>
        {selected.aslTip && (
          <div>
            <dt className="eyebrow mb-1.5">Tip</dt>
            <dd className="text-ink-2 font-bold leading-relaxed">{selected.aslTip}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button onClick={() => onSelectPracticeSign(selected.name)} className="btn btn-signer">
          <Hand className="w-5 h-5" strokeWidth={2.5} /> Practise
        </button>
        <button onClick={() => speechManager.speak(selected.spokenEquivalent, voiceSettings)} className="btn btn-line">
          <Volume2 className="w-5 h-5" strokeWidth={2.5} /> Hear it
        </button>
      </div>
    </article>
  );

  return (
    <div className="w-full">
      <header className="max-w-2xl">
        <h1 className="text-[2.25rem] sm:text-[2.75rem] font-black leading-[1.05]">Signs</h1>
        <p className="mt-2 text-ink-2 font-bold text-[1.0625rem]">
          The signs GestureVoice understands, and how to make them. Pick one to practise it in front of the camera.
        </p>
      </header>

      <div className="mt-7 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
        <nav aria-label="Filter signs" className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-current={filter === f.id ? 'page' : undefined}
              className="chip"
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div className="relative sm:w-72">
          <Search className="w-5 h-5 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
          <label htmlFor="sign-search" className="sr-only">
            Search signs
          </label>
          <input
            id="sign-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search signs"
            className="field !pl-10"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-7 min-w-0">
          {results.length === 0 && (
            <p className="py-16 text-center text-ink-3">No signs match “{query}”.</p>
          )}

          {words.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {words.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setSelectedId(item.id)}
                      aria-current={active ? 'true' : undefined}
                      className="tile w-full flex items-center justify-between gap-6 px-4 py-3 text-left"
                    >
                      <span className="text-[1.0625rem] font-extrabold">{item.name}</span>
                      <span className="hidden sm:block text-[0.9375rem] font-bold text-ink-3 truncate max-w-[55%] text-right">
                        {item.spokenEquivalent}
                      </span>
                    </button>
                    {active && <div className="lg:hidden sheet p-5 mt-2 mb-3">{detail}</div>}
                  </li>
                );
              })}
            </ul>
          )}

          {letters.length > 0 && (
            <div className={words.length ? 'mt-10' : ''}>
              <h3 className="text-[1.375rem] font-black mb-3">Alphabet</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {letters.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      aria-label={item.name}
                      aria-current={active ? 'true' : undefined}
                      className="tile aspect-[4/5] flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-[3rem] font-black leading-none text-partner-ink">{glyphOf(item)}</span>
                      <span className="text-sm font-extrabold text-ink-2">letter {glyphOf(item)?.toLowerCase()}</span>
                    </button>
                  );
                })}
              </div>
              {selected && glyphOf(selected) && <div className="lg:hidden sheet p-5 mt-4">{detail}</div>}
            </div>
          )}
        </div>

        <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-10">
          <div className="sheet p-7">{detail}</div>
        </aside>
      </div>
    </div>
  );
};
