import React, { useMemo, useState } from 'react';
import { Info, MousePointerClick, Sparkles } from 'lucide-react';
import {
  buildResumeHighlights,
  DEFAULT_MAX_HIGHLIGHTS,
  type ResumeHighlight,
  type ResumeHighlightCategory,
} from '../../lib/resume-highlight.js';

interface ResumeHighlightPreviewProps {
  /** The candidate's own, unmodified resume text. */
  resumeText: string;
  /** Terms the job description requires and the resume already evidences. */
  matchedKeywords?: string[] | null;
  /** Gaps. Passed through only so the panel can state that gaps are never marked. */
  missingKeywords?: string[] | null;
  jobTitle?: string | null;
  maxHighlights?: number;
}

/**
 * Presentation-only view of ONE resume.
 *
 * The text on screen is always the exact string passed in: highlights are
 * rendered as inline <mark> elements over segments of that string, never as
 * HTML, never rewritten. Switching to "Normal" simply stops colouring the
 * segments, which is how a candidate proves nothing changed.
 */
export const ResumeHighlightPreview: React.FC<ResumeHighlightPreviewProps> = ({
  resumeText,
  matchedKeywords,
  missingKeywords,
  jobTitle,
  maxHighlights = DEFAULT_MAX_HIGHLIGHTS,
}) => {
  const [mode, setMode] = useState<'normal' | 'highlighted'>('highlighted');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [muted, setMuted] = useState<ResumeHighlightCategory[]>([]);

  const built = useMemo(
    () =>
      buildResumeHighlights({
        resumeText,
        matchedKeywords,
        missingKeywords,
        maxHighlights,
      }),
    [resumeText, matchedKeywords, missingKeywords, maxHighlights]
  );

  const selected: ResumeHighlight | null =
    built.highlights.find((h) => h.id === selectedId) ?? null;

  if (!resumeText.trim()) {
    return (
      <div className="rounded-2xl border border-line/80 bg-canvas/70 p-4 text-xs text-[#627D98]">
        Your resume preview will appear here after a review.
      </div>
    );
  }

  const visibleIds = new Set(
    built.highlights.filter((h) => !muted.includes(h.category)).map((h) => h.id)
  );
  const visibleCount = mode === 'highlighted' ? visibleIds.size : 0;
  const categoriesPresent = [...new Set(built.highlights.map((h) => h.category))];

  const legend: { category: ResumeHighlightCategory; label: string; swatch: string }[] = [
    { category: 'tool', label: 'Tools and technology', swatch: 'bg-[#BFDBFE]' },
    { category: 'skill', label: 'Skill', swatch: 'bg-[#C7D2FE]' },
    { category: 'keyword', label: 'Role requirement', swatch: 'bg-[#FDE68A]' },
    { category: 'certification', label: 'Certification', swatch: 'bg-[#BBF7D0]' },
    { category: 'achievement', label: 'Quantified achievement', swatch: 'bg-[#99F6E4]' },
    { category: 'responsibility', label: 'Leadership', swatch: 'bg-[#FECDD3]' },
  ];

  const toggleMute = (category: ResumeHighlightCategory) => {
    setMuted((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  };

  return (
    <section aria-label="Resume preview" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" aria-hidden />
            What stands out for this role
          </h4>
          <p className="text-xs text-[#627D98] mt-1 max-w-xl">
            {jobTitle ? `Matches for ${jobTitle}. ` : ''}
            Highlights point to skills and experience already in your resume. Nothing is rewritten here.
          </p>
        </div>

        <div
          role="group"
          aria-label="Highlight display mode"
          className="shrink-0 inline-flex rounded-full border border-line bg-canvas/90 p-0.5"
        >
          <button
            type="button"
            onClick={() => setMode('normal')}
            aria-pressed={mode === 'normal'}
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
              mode === 'normal' ? 'bg-white text-[#0B2545] shadow-sm' : 'text-[#627D98] hover:text-[#334E68]'
            }`}
          >
              Original resume
          </button>
          <button
            type="button"
            onClick={() => setMode('highlighted')}
            aria-pressed={mode === 'highlighted'}
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
              mode === 'highlighted'
                ? 'bg-[#1D4ED8] text-white shadow-sm'
                : 'text-[#627D98] hover:text-[#334E68]'
            }`}
          >
              Show highlights
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] items-start">
        <div className="min-w-0 rounded-2xl border border-white/80 bg-white/70 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(11,37,69,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-surface">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#627D98]">
              {mode === 'highlighted'
                ? `${visibleCount} highlights shown`
                : 'Original resume text'}
            </span>
            {mode === 'highlighted' && built.hiddenBySelectivity > 0 && (
              <span className="text-[10px] font-semibold text-[#627D98] bg-surface px-2 py-0.5 rounded-full">
                {built.hiddenBySelectivity} more not marked (kept the page readable)
              </span>
            )}
          </div>

          {mode === 'highlighted' && built.highlights.length === 0 && (
            <p className="text-xs text-[#627D98] mb-3 bg-canvas/80 border border-line/80 rounded-xl px-3 py-2">
              We didn’t find these role requirements in your resume. ResumeSetu will never add them for you.
            </p>
          )}

          <div className="text-[13px] leading-relaxed text-[#334E68] whitespace-pre-wrap break-words">
            {built.segments.map((segment, index) => {
              if (segment.highlightId === null || mode === 'normal' || !visibleIds.has(segment.highlightId)) {
                return <React.Fragment key={index}>{segment.text}</React.Fragment>;
              }
              const highlight = built.highlights.find((h) => h.id === segment.highlightId);
              if (!highlight) return <React.Fragment key={index}>{segment.text}</React.Fragment>;
              const isSelected = selectedId === highlight.id;
              const swatch = legend.find((l) => l.category === highlight.category)?.swatch ?? 'bg-[#FDE68A]';
              return (
                <mark
                  key={index}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${highlight.text} — ${highlight.label}. ${highlight.reason}`}
                  onClick={() => setSelectedId((prev) => (prev === highlight.id ? null : highlight.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId((prev) => (prev === highlight.id ? null : highlight.id));
                    }
                  }}
                  className={`${swatch} text-[#0B2545] rounded-sm px-0.5 -mx-0.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                    isSelected ? 'ring-2 ring-[#1D4ED8] shadow-[0_0_0_2px_rgba(29,78,216,0.25)]' : ''
                  }`}
                >
                  {segment.text}
                </mark>
              );
            })}
          </div>
        </div>

        {/* Explanation panel: beside the text on desktop, below it on mobile. */}
        <aside aria-live="polite" className="rounded-2xl border border-blue-pale bg-blue-wash/60 p-4 space-y-3 lg:sticky lg:top-24">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                  {selected.label}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-[11px] font-bold text-[#627D98] hover:text-[#0B2545]"
                >
                  Clear
                </button>
              </div>
              <p className="text-sm font-extrabold text-[#0B2545] break-words bg-white rounded-xl px-3 py-2 border border-blue-pale">
                “{selected.text}”
              </p>
              <p className="text-xs text-[#334E68] leading-relaxed">{selected.reason}</p>
              {selected.jdRequirement && (
                <p className="text-xs text-[#334E68] leading-relaxed">
                  <strong className="font-bold text-[#0B2545]">Connects to:</strong> “{selected.jdRequirement}” —{' '}
                  required by the posting and evidenced by your own resume.
                </p>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" aria-hidden />
                Already in your resume
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#1D4ED8]" aria-hidden />
                Choose a highlighted phrase
              </p>
              <p className="text-xs text-[#334E68] leading-relaxed">
                Choose a highlight to see how it connects to the role. Your resume text stays the same.
              </p>
            </div>
          )}

          {categoriesPresent.length > 0 && (
            <div className="pt-1 border-t border-blue-pale/70 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#627D98]">
                Highlights — choose what to show
              </span>
              <ul className="space-y-1">
                {legend
                  .filter((entry) => categoriesPresent.includes(entry.category))
                  .map((entry) => {
                    const count = built.highlights.filter((h) => h.category === entry.category).length;
                    const isMuted = muted.includes(entry.category);
                    return (
                      <li key={entry.category}>
                        <button
                          type="button"
                          onClick={() => toggleMute(entry.category)}
                          aria-pressed={!isMuted}
                          className={`w-full flex items-center gap-2 text-left text-[11px] rounded-lg px-2 py-1 border transition-colors ${
                            isMuted
                              ? 'border-line/80 bg-canvas/70 text-[#829AB1] line-through'
                              : 'border-blue-pale/60 bg-white/80 text-[#334E68] hover:border-[#1D4ED8]/40'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded ${entry.swatch} shrink-0 border border-black/5`} aria-hidden />
                          <span className="flex-1">{entry.label}</span>
                          <span className="font-bold">{count}</span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default ResumeHighlightPreview;
