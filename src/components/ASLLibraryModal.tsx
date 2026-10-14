import React, { useMemo, useState } from 'react';
import { Search, Volume2, Hand } from 'lucide-react';
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
      <div className="flex items-end gap-5 mt-2">
        {glyphOf(selected) && (
          <span className="said text-[5.5rem] leading-[0.8] text-signer" aria-hidden="true">
            {glyphOf(selected)}
          </span>
        )}
        <h2 className="said text-[2.5rem] leading-[1] text-ink">{selected.name}</h2>
      </div>
      <p className="mt-4 text-ink-2 text-[0.9375rem]">
        Spoken as <span className="said italic text-[1.25rem] text-ink">“{selected.spokenEquivalent}”</span>
      </p>

      <dl className="mt-8 space-y-5 text-[0.9375rem]">
        <div>
          <dt className="eyebrow mb-1.5">How to form it</dt>
          <dd className="text-ink leading-relaxed">{selected.instruction}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1.5">Handshape</dt>
          <dd className="text-ink-2 leading-relaxed">{selected.handshape}</dd>
        </div>
        <div>
          <dt className="eyebrow mb-1.5">Movement</dt>
          <dd className="text-ink-2 leading-relaxed">{selected.description}</dd>
        </div>
        {selected.aslTip && (
          <div>
            <dt className="eyebrow mb-1.5">Tip</dt>
            <dd className="text-ink-2 leading-relaxed">{selected.aslTip}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        <button onClick={() => onSelectPracticeSign(selected.name)} className="btn btn-signer">
          <Hand className="w-4 h-4" /> Practise with camera
        </button>
        <button onClick={() => speechManager.speak(selected.spokenEquivalent, voiceSettings)} className="btn btn-line">
          <Volume2 className="w-4 h-4" /> Hear it
        </button>
      </div>
    </article>
  );

  return (
    <div className="w-full">
      <header className="max-w-2xl">
        <h1 className="said text-[2.75rem] sm:text-[3.5rem] leading-[1]">Signs</h1>
        <p className="mt-3 text-ink-2 text-[1.0625rem]">
          The signs GestureVoice understands, and how to make them. Pick one to practise it in front of the camera.
        </p>
      </header>

      <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 border-b border-rule">
        <nav aria-label="Filter signs" className="flex gap-6 h-11 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-current={filter === f.id ? 'page' : undefined}
              className="navlink whitespace-nowrap"
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div className="relative sm:w-72 sm:mb-2">
          <Search className="w-4 h-4 text-ink-3 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <label htmlFor="sign-search" className="sr-only">
            Search signs
          </label>
          <input
            id="sign-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search signs"
            className="field !pl-10 !rounded-full"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-7 min-w-0">
          {results.length === 0 && (
            <p className="py-16 text-center text-ink-3">No signs match “{query}”.</p>
          )}

          {words.length > 0 && (
            <ul className="border-t border-rule">
              {words.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id} className="border-b border-rule">
                    <button
                      onClick={() => setSelectedId(item.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-baseline justify-between gap-6 py-3.5 pl-3 pr-2 text-left transition-colors border-l-2 ${
                        active ? 'border-signer bg-signer-soft/60' : 'border-transparent hover:bg-sunk/60'
                      }`}
                    >
                      <span className="text-[1.0625rem] font-medium text-ink">{item.name}</span>
                      <span className="said italic text-[1.0625rem] text-ink-3 truncate max-w-[55%] text-right">
                        {item.spokenEquivalent}
                      </span>
                    </button>
                    {active && <div className="lg:hidden px-3 pt-4 pb-8">{detail}</div>}
                  </li>
                );
              })}
            </ul>
          )}

          {letters.length > 0 && (
            <div className={words.length ? 'mt-10' : ''}>
              <h3 className="eyebrow mb-3">Alphabet</h3>
              <div className="grid grid-cols-6 sm:grid-cols-8 border-t border-l border-rule">
                {letters.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      aria-label={item.name}
                      aria-current={active ? 'true' : undefined}
                      className={`aspect-square said text-[2rem] border-r border-b border-rule transition-colors ${
                        active ? 'bg-signer text-on-accent' : 'bg-sheet text-ink hover:bg-sunk'
                      }`}
                    >
                      {glyphOf(item)}
                    </button>
                  );
                })}
              </div>
              {selected && glyphOf(selected) && <div className="lg:hidden pt-8">{detail}</div>}
            </div>
          )}
        </div>

        <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-[96px]">
          <div className="sheet p-8">{detail}</div>
        </aside>
      </div>
    </div>
  );
};
