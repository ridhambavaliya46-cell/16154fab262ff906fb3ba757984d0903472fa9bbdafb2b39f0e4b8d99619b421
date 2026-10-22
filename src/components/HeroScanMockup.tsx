import React from 'react';
import {
  FileText,
  Target,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Check,
} from 'lucide-react';

export const HeroScanMockup: React.FC<{ onScanClick?: () => void }> = ({ onScanClick }) => {
  // This is an illustrative, static preview. A fake live scan and animated
  // score would suggest a real result before the user has supplied documents.
  const displayScore = 86;

  return (
    <div className="relative w-full pt-3">
      {/* Paper-like preview: clear and useful without pretending to be live telemetry. */}
      <div className="glass-panel w-full relative rounded-3xl !bg-white border border-[#DFE5E0] shadow-[0_30px_60px_-28px_rgba(23,59,54,0.42)] overflow-hidden transition-all duration-300 hover:shadow-[0_34px_70px_-28px_rgba(23,59,54,0.5)] hover:-translate-y-1">

        {/* Top Window Bar: Clean, authentic SaaS window */}
        <div className="bg-[#FCFCF9] px-4 py-3 border-b border-[#E6EBE6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/70 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8]/80 inline-block" />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-tight text-[#173B36] ml-2">
              resume-review.docx
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E4EEE7] text-[#24584F] text-[10px] font-bold border border-[#C9D8CF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E765B]" />
              Example review
            </span>
          </div>
        </div>

        {/* Main Scanner Workspace Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Split View: Left (Resume) vs Right (Job Spec Match) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LEFT: CANDIDATE RESUME MOCKUP with 3D shadow */}
            <div className="glass-panel relative p-4 rounded-2xl !bg-white border border-[#DFE5E0] shadow-[0_8px_24px_rgba(23,59,54,0.06)] flex flex-col justify-between overflow-hidden">

              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between border-b border-surface pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#E4EEE7] text-[#24584F] flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[#24584F]" />
                    </div>
                    <span className="text-xs font-bold text-[#0B2545]">
                      Candidate Experience
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#627D98]">6 Yrs Exp</span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#0B2545]">
                    Staff Software Engineer
                  </div>
                  <div className="text-[10px] text-[#334E68] bg-[#F7F9FC]/90 p-2.5 rounded-xl border border-[#8DA9C4]/25 leading-relaxed font-mono shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)]">
                    Architected idempotent payment microservices in TypeScript, reducing p99 latency by 38% under 99.99% availability SLAs.
                  </div>
                </div>

                {/* Extracted tokens */}
                <div>
                  <span className="text-[10px] font-bold text-[#627D98] block mb-1">
                    Details found in the resume:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['TypeScript', 'Microservices', 'p99 Latency', 'Idempotency'].map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/25 shadow-2xs"
                      >
                        <Check className="w-2.5 h-2.5 text-[#1D4ED8]" />
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 mt-3 border-t border-surface flex items-center justify-between text-[10px] text-[#627D98]">
                <span>Format: Single Column</span>
                <span className="text-blue-core font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-mid inline" /> Text extraction
                </span>
              </div>
            </div>

            {/* RIGHT: JOB SPECIFICATION & MATCH CRITERIA with 3D shadow */}
            <div className="glass-panel p-4 rounded-2xl !bg-white border border-[#DFE5E0] shadow-[0_8px_24px_rgba(23,59,54,0.06)] flex flex-col justify-between space-y-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-surface pb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[#F3EBDD] text-[#8E5B2D] flex items-center justify-center shrink-0">
                      <Target className="w-3.5 h-3.5 text-[#8E5B2D]" />
                    </div>
                    <span className="text-xs font-bold text-[#0B2545] truncate">
                      Target Job Description
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-core bg-blue-wash px-3 py-1 rounded-full border border-blue-pale font-bold whitespace-nowrap shrink-0">
                    Stripe • Tech Lead
                  </span>
                </div>

                {/* Skill Matching Checklist */}
                <div className="space-y-2">
                  {[
                    { text: 'Distributed Microservices', match: 'found' },
                    { text: 'TypeScript & Node.js', match: 'found' },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-blue-wash/80 border border-blue-pale shadow-2xs"
                    >
                      <span className="text-ink font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-mid shrink-0" />
                        {item.text}
                      </span>
                      <span className="font-mono font-bold text-blue-core">{item.match}</span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-warning-soft/90 border border-warning-border shadow-2xs">
                    <span className="text-warning-strong font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      AWS ECS Canaries
                    </span>
                    <span className="font-mono font-bold text-warning">Gap — not added</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-surface flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#627D98]">
                <span className="w-full sm:w-auto">
                  Fictional candidate. Keyword gaps are shown as gaps — ResumeSetu never adds a
                  keyword you have not evidenced.
                </span>
                  <span>Next step:</span>
                  <span className="font-mono font-bold text-[#0B2545]">Review the gaps</span>
              </div>
            </div>
          </div>

          {/* BOTTOM TELEMETRY BAR with Generous Un-cramped Layout */}
          <div className="relative p-4 sm:p-5 rounded-2xl bg-[#173B36] text-white shadow-[0_22px_50px_-24px_rgba(23,59,54,0.7)] overflow-hidden space-y-3.5">

            {/* Top Info Row */}
            <div className="flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#F3EBDD] flex items-center justify-center font-mono font-extrabold text-lg text-[#8E5B2D] shrink-0">
                  {displayScore}%
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Role fit review
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#D5E2D9] border border-white/20 font-semibold shrink-0">
                      Example only
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8DA9C4] mt-0.5 font-medium truncate sm:whitespace-normal">
                    A starting point for your own review
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Button Row */}
            <button
              onClick={onScanClick}
              className="w-full py-3 px-5 rounded-xl bg-[#D6814B] hover:bg-[#C36D39] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer relative z-10"
            >
              <span>Start with your resume</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
