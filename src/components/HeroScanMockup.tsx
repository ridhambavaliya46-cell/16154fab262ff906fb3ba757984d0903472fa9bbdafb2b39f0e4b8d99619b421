import React from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
  Target,
} from 'lucide-react';

const resumeEvidence = ['Node.js', 'Payment APIs', 'Database queries'];
const roleRequirements = [
  { label: 'Payment services', found: true },
  { label: 'Node.js', found: true },
  { label: 'AWS ECS', found: false },
];

export const HeroScanMockup: React.FC<{ onScanClick?: () => void }> = ({ onScanClick }) => (
  <div className="hero-preview relative w-full pt-3">
    <div className="relative overflow-hidden rounded-[1.65rem] border border-[#DFE5E0] bg-[#FFFEFA] shadow-[0_28px_60px_-34px_rgba(26,52,46,.42)] transition-transform duration-500 hover:-translate-y-1">
      <div className="flex items-center justify-between gap-4 border-b border-line bg-[#FCFCF9] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E6EEE5] text-[#28664F]">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">Resume review</p>
            <p className="text-[11px] text-ink-faint">A sample, not a live scan</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#C9D8CF] bg-[#F1F5EF] px-2.5 py-1 text-[10px] font-semibold text-[#315B50]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4B8A69]" />
          Illustrative
        </span>
      </div>

      <div className="grid gap-3 p-3.5 sm:grid-cols-[1fr_1fr] sm:gap-4 sm:p-5">
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
            <h3 className="text-xs font-semibold text-ink">Resume evidence</h3>
            <span className="text-[10px] font-medium text-ink-faint">Example text</span>
          </div>
          <p className="rounded-xl bg-[#F6F4EE] p-3 text-[11px] leading-relaxed text-ink-soft sm:text-xs">
            Built internal payment services in Node.js and helped the team investigate slow database queries.
          </p>
          <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-ink-faint">
            Details in the sample
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumeEvidence.map((item) => (
              <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[#E6EEE5] px-2.5 py-1 text-[10px] font-medium text-[#315B50]">
                <Check className="h-3 w-3" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#28664F]" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-ink">Role requirements</h3>
            </div>
            <span className="text-[10px] font-medium text-ink-faint">Example role</span>
          </div>
          <div className="space-y-2">
            {roleRequirements.map((item) => (
              <div key={item.label} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[11px] ${item.found ? 'border-[#C9D8CF] bg-[#F1F5EF]' : 'border-[#EAD1A8] bg-[#FBF3E7]'}`}>
                <span className="flex items-center gap-2 font-medium text-ink-soft">
                  {item.found ? <Check className="h-3.5 w-3.5 text-[#28664F]" aria-hidden="true" /> : <AlertCircle className="h-3.5 w-3.5 text-[#9B5C1F]" aria-hidden="true" />}
                  {item.label}
                </span>
                <span className={`shrink-0 text-[10px] font-semibold ${item.found ? 'text-[#28664F]' : 'text-[#74441B]'}`}>
                  {item.found ? 'In sample' : 'Review gap'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
            A gap is a prompt to review your experience. It is never added to your resume for you.
          </p>
        </section>
      </div>

      <div className="mx-3.5 mb-3.5 flex flex-col gap-3 rounded-2xl bg-[#1A342E] p-4 text-white sm:mx-5 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#DDE8DB]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white">Evidence first</p>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-[#D2DED4]">
              Sample content only. A match describes document alignment, not hiring outcomes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onScanClick}
          className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#B96643] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#A85535] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4B098]"
        >
          Start with your resume
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>

      <div className="pointer-events-none absolute -bottom-3 -left-3 hidden h-12 w-12 items-center justify-center rounded-2xl border border-line bg-[#FFFEFA] text-[#28664F] shadow-[0_10px_24px_-14px_rgba(26,52,46,.45)] sm:flex">
        <ArrowDownRight className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
  </div>
);
