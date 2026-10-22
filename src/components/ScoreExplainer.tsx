import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { buildScoreExplanation, type ScoreExplanationInput } from '../../lib/score-explainer.js';

type ScoreExplainerProps = ScoreExplanationInput & {
  defaultOpen?: boolean;
};

/**
 * Collapsible "how this number was computed" panel.
 *
 * Every sentence comes from `lib/score-explainer.ts`, which is unit-tested
 * against the engine's weights, so the UI cannot drift into a friendlier story
 * than the scorer actually tells.
 */
export const ScoreExplainer: React.FC<ScoreExplainerProps> = ({ defaultOpen = false, ...input }) => {
  const [open, setOpen] = useState(defaultOpen);
  const explanation = buildScoreExplanation(input);

  return (
    <div className="rounded-2xl border border-line/80 bg-canvas/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="score-explainer-body"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-white/60 transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-[#0B2545] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#1D4ED8]" aria-hidden />
          How this score was calculated
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#627D98] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div id="score-explainer-body" className="px-4 pb-4 space-y-3 border-t border-line/70 pt-3">
          <p className="text-[11px] font-mono font-semibold text-[#334E68] bg-white border border-line/80 rounded-xl px-3 py-2">
            {explanation.formula}
          </p>

          {!explanation.scorable && explanation.unscoreableReason && (
            <p className="text-xs rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-warning-strong">
              {explanation.unscoreableReason}
            </p>
          )}

          <ul className="space-y-2.5">
            {explanation.rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-blue-pale/60 bg-white/80 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[#0B2545]">{row.label}</span>
                  <span className="text-xs font-extrabold text-[#1D4ED8]">{row.value}%</span>
                </div>
                <p className="text-xs text-[#334E68] leading-relaxed">{row.definition}</p>
                <p className="text-xs text-[#627D98] leading-relaxed mt-1">
                  <strong className="font-bold text-[#334E68]">What moves it:</strong> {row.movesIt}
                </p>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line/80 bg-white/70 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#627D98] block mb-1.5">
                This number does not measure
              </span>
              <ul className="space-y-1 text-xs text-[#334E68]">
                {explanation.notMeasured.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="text-[#829AB1] shrink-0">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-blue-pale/60 bg-blue-wash/50 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8] block mb-1.5">
                What to do with it
              </span>
              <ul className="space-y-1.5 text-xs text-[#334E68]">
                {explanation.advice.length > 0 ? (
                  explanation.advice.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="leading-relaxed">
                    Nothing is missing for this posting’s recognised terms — read the summary below for the
                    qualitative picture.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreExplainer;
