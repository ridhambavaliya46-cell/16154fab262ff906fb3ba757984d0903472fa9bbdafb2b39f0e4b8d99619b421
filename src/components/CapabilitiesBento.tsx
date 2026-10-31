import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FilterIcon,
  FileValidationIcon,
  Mail01Icon,
  Briefcase01Icon,
  Shield01Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import {
  Check,
  AlertTriangle,
  ArrowRight,
  Download,
} from 'lucide-react';

interface CapabilitiesBentoProps {
  onScanClick: () => void;
}

export const CapabilitiesBento: React.FC<CapabilitiesBentoProps> = ({ onScanClick }) => {
  // Card 1: Gap Finder interactive state
  const [activeKeywords, setActiveKeywords] = useState<string[]>([
    'TypeScript',
    'PostgreSQL',
    'Distributed caching',
  ]);

  const testKeywords = [
    { name: 'TypeScript' },
    { name: 'PostgreSQL' },
    { name: 'Distributed caching' },
    { name: 'Kubernetes' },
    { name: 'CI/CD pipelines' },
    { name: 'System design' },
  ];
  const selectedKeywordCount = testKeywords.filter((keyword) => activeKeywords.includes(keyword.name)).length;

  const toggleKeyword = (name: string) => {
    if (activeKeywords.includes(name)) {
      setActiveKeywords(activeKeywords.filter((k) => k !== name));
    } else {
      setActiveKeywords([...activeKeywords, name]);
    }
  };

  // Card 2: reviewable resume edit state
  const [bulletMode, setBulletMode] = useState<'raw' | 'tailored'>('tailored');

  // Card 3: Cover Letter tone state
  const [letterTone, setLetterTone] = useState<'direct' | 'technical' | 'growth'>('direct');

  const toneSnippets = {
    direct:
      'I have worked on Node.js payment services and helped investigate database queries with a backend team.',
    technical:
      'My experience includes Node.js services, payment workflows, and collaborative query troubleshooting.',
    growth:
      'I am looking to bring my experience with payment services and practical problem-solving to a growing team.',
  };

  // Card 4: Application Tracker active filter
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'interview' | 'offers'>('all');

  const trackedApplications = [
    {
      company: 'Company A',
      role: 'Backend engineer',
      status: 'Interview',
      statusClass: 'bg-blue-wash text-blue-core border-blue-pale',
      isOffer: false,
    },
    {
      company: 'Company B',
      role: 'Platform engineer',
      status: 'Applied',
      statusClass: 'bg-blue-wash text-blue-core border-blue-pale',
      isOffer: false,
    },
    {
      company: 'Company C',
      role: 'Software engineer',
      status: 'Offer',
      statusClass: 'bg-blue-wash text-blue-deep border-blue-pale font-bold',
      isOffer: true,
    },
  ];

  const filteredApplications = trackedApplications.filter((app) => {
    if (trackerFilter === 'offers') return app.isOffer;
    if (trackerFilter === 'interview') return app.status === 'Interview';
    return true;
  });

  return (
    <section id="capabilities" className="py-20 sm:py-28 border-b border-[#8DA9C4]/30 scroll-mt-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B2545] tracking-tight">
            A workspace for{' '}
            <span className="text-[#2E765B]">
              better decisions
            </span>
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#334E68]">
            Understand the role, keep your claims accurate, and make each application easier to review.
          </p>
        </div>

        {/* Asymmetric Bento Grid with Enhanced Glassmorphism & Visual Information */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* ==============================================================
              FEATURE 1: GAP FINDER (SPANS 7 COLS)
             ============================================================== */}
          <div className="landing-card md:col-span-7 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0B2545] p-0.5 shadow-[0_6px_16px_rgba(29,78,216,0.35)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0B2545] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={FilterIcon} size={20} className="text-[#93C5FD] relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">Gap Finder</h3>
                    <p className="text-[11px] text-[#627D98]">Relevant gaps</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono px-3 py-1.5 rounded-xl bg-white/80 border border-[#8DA9C4]/30 shadow-xs">
                  <span className="text-[11px] text-[#627D98]">Example</span>
                  <span className="text-sm font-bold tabular-nums text-[#28664F]">{selectedKeywordCount} of {testKeywords.length}</span>
                </div>
              </div>

              {/* Interactive Keyword Chips Matrix */}
              <div className="flex flex-wrap gap-2 mb-4">
                {testKeywords.map((k) => {
                  const isPresent = activeKeywords.includes(k.name);
                  return (
                    <button
                      key={k.name}
                      onClick={() => toggleKeyword(k.name)}
                      type="button"
                      aria-pressed={isPresent}
                      aria-label={`${k.name}: ${isPresent ? 'included in the sample resume' : 'shown as an example gap'}`}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border shadow-xs active:scale-95 ${
                        isPresent
                          ? 'bg-[#0B2545] text-white border-[#0B2545]'
                          : 'bg-white/80 hover:bg-white text-[#627D98] border-[#8DA9C4]/40 hover:text-[#0B2545]'
                      }`}
                    >
                      {isPresent ? (
                        <Check className="w-3 h-3 text-blue-light" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-warning" />
                      )}
                      <span>{k.name}</span>
                      <span className="text-[9px] opacity-80">{isPresent ? 'Found' : 'Review'}</span>
                    </button>
                  );
                })}
              </div>

              {/*
                Interactive demo, not a live scan. The sample indicator below is derived from
                the chips you toggle here and has nothing to do with your real
                documents. The workspace shows the actual engine output instead.
              */}
              <div className="p-3.5 rounded-2xl bg-white/70 border border-[#8DA9C4]/30 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-[#0B2545] flex items-center gap-1.5 font-bold">
                    <HugeiconsIcon icon={Shield01Icon} size={14} className="text-blue-mid" />
                    Illustrative keyword coverage
                  </span>
                  <span className="font-mono font-bold text-blue-core">
                    {selectedKeywordCount} of {testKeywords.length} sample terms selected
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      'bg-[#28664F]'
                    }`}
                    style={{ width: `${(selectedKeywordCount / testKeywords.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-surface/80 flex items-center justify-between text-xs text-[#627D98]">
              <span>Illustrative sample — real results use your documents</span>
              <button
                onClick={onScanClick}
                className="font-bold text-[#1D4ED8] hover:text-blue-core flex items-center gap-1 cursor-pointer"
              >
                <span>Run Gap Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ==============================================================
              FEATURE 2: REVIEWABLE RESUME EDITS (SPANS 5 COLS)
             ============================================================== */}
          <div className="landing-card md:col-span-5 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0B2545] p-0.5 shadow-[0_6px_16px_rgba(29,78,216,0.35)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0B2545] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={FileValidationIcon} size={20} className="text-[#93C5FD] relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">Tailored Resume</h3>
                    <p className="text-[11px] text-[#627D98]">STAR bullet rewriter</p>
                  </div>
                </div>

                {/* Switcher */}
                <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-xl border border-[#8DA9C4]/35 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBulletMode('raw')}
                    aria-pressed={bulletMode === 'raw'}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      bulletMode === 'raw'
                        ? 'bg-[#0B2545] text-white'
                        : 'text-[#627D98]'
                    }`}
                  >
                    Raw
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulletMode('tailored')}
                    aria-pressed={bulletMode === 'tailored'}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      bulletMode === 'tailored'
                        ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-xs'
                        : 'text-[#627D98]'
                    }`}
                  >
                    STAR
                  </button>
                </div>
              </div>

              {/* Bullet Comparison Display */}
              <div className="p-3.5 rounded-2xl bg-white/70 border border-[#8DA9C4]/30 space-y-2 mb-3 shadow-inner">
                <div className="text-[10px] font-mono text-[#627D98] flex items-center justify-between">
                  <span>{bulletMode === 'raw' ? 'Original note' : 'Structured suggestion'}</span>
                  <span
                    className={`font-bold ${
                      bulletMode === 'raw' ? 'text-warning' : 'text-blue-core'
                    }`}
                  >
                    {bulletMode === 'raw' ? 'Source text' : 'No new facts added'}
                  </span>
                </div>

                <p className="text-[11px] sm:text-xs text-[#0B2545] leading-relaxed font-mono">
                  {bulletMode === 'raw'
                    ? 'Built internal payment microservices in Node and fixed slow queries for the backend team.'
                    : 'Built internal payment services in Node.js and partnered with the backend team to investigate slow database queries.'}
                </p>
              </div>

              {/* Visual badges */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-[#0B2545]">
                <div className="p-2 rounded-xl bg-white/80 border border-line/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-bright" />
                  <span>Review the source</span>
                </div>
                <div className="p-2 rounded-xl bg-white/80 border border-line/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
                  <span>.DOCX Formatted</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-surface/80 flex items-center justify-between text-xs text-[#627D98]">
              <span>Single-column format</span>
              <span className="font-bold text-blue-core flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Word .docx Ready
              </span>
            </div>
          </div>

          {/* ==============================================================
              FEATURE 3: COVER LETTER (SPANS 5 COLS)
             ============================================================== */}
          <div className="landing-card md:col-span-5 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0B2545] p-0.5 shadow-[0_6px_16px_rgba(29,78,216,0.35)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0B2545] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={Mail01Icon} size={20} className="text-[#93C5FD] relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">Cover Letter</h3>
                    <p className="text-[11px] text-[#627D98]">Targeted executive pitch</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold text-[#1D4ED8] bg-[#1D4ED8]/10 px-2 py-0.5 rounded-full border border-[#1D4ED8]/25">
                  Draft for review
                </span>
              </div>

              {/* Tone Selection Tabs */}
              <div className="flex items-center gap-1.5 mb-3">
                {(['direct', 'technical', 'growth'] as const).map((tone) => (
                  <button
                    key={tone}
                      type="button"
                    onClick={() => setLetterTone(tone)}
                      aria-pressed={letterTone === tone}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer capitalize border shadow-2xs ${
                      letterTone === tone
                        ? 'bg-[#0B2545] text-white border-[#0B2545]'
                        : 'bg-white/80 hover:bg-white text-[#627D98] border-[#8DA9C4]/35'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>

              {/* Dynamic Cover Letter Snippet */}
              <div className="p-3.5 rounded-2xl bg-white/70 border border-[#8DA9C4]/30 mb-3 shadow-inner">
                <span className="text-[9px] uppercase font-bold text-[#627D98] block mb-1">
                  Opening direction:
                </span>
                <p className="text-[11px] sm:text-xs text-[#334E68] italic leading-relaxed">
                  "{toneSnippets[letterTone]}"
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-blue-deep font-semibold bg-blue-wash/80 p-2 rounded-xl border border-blue-pale">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className="text-blue-mid shrink-0" />
                  <span>Check every line against your resume</span>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-surface/80 flex items-center justify-between text-xs text-[#627D98]">
              <span>Zero boilerplate fluff</span>
              <span className="font-bold text-[#1D4ED8]">Export Ready</span>
            </div>
          </div>

          {/* ==============================================================
              FEATURE 4: APPLICATION TRACKER (SPANS 7 COLS)
             ============================================================== */}
          <div className="landing-card md:col-span-7 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0B2545] p-0.5 shadow-[0_6px_16px_rgba(29,78,216,0.35)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0B2545] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={Briefcase01Icon} size={20} className="text-[#93C5FD] relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">Application Tracker</h3>
                    <p className="text-[11px] text-[#627D98]">Example tracker · keep applications moving</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-xl border border-[#8DA9C4]/35 shadow-xs">
                  {(['all', 'interview', 'offers'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTrackerFilter(filter)}
                      aria-pressed={trackerFilter === filter}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                        trackerFilter === filter
                          ? 'bg-[#0B2545] text-white'
                          : 'text-[#627D98]'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Pipeline Applications List */}
              <div className="space-y-2 mb-4">
                {filteredApplications.map((app) => (
                  <div
                    key={app.company}
                    className="p-3 rounded-2xl bg-white/80 border border-[#8DA9C4]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:border-[#1D4ED8]/40 transition-colors min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-[#0B2545] text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {app.company[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-[#0B2545] shrink-0">{app.company}</span>
                          <span className="text-[11px] sm:text-[10px] text-[#627D98] sm:shrink break-words">
                            <span className="hidden sm:inline">· </span>
                            {app.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-surface">
                      <span className="font-mono text-xs font-bold text-[#1D4ED8]">
                          <span className="text-[10px] font-semibold text-[#63766D]">Example</span>
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${app.statusClass}`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-surface/80 flex items-center justify-between text-xs text-[#627D98]">
              <span>Your application list at a glance</span>
              <button
                onClick={onScanClick}
                className="font-bold text-[#1D4ED8] hover:text-blue-core flex items-center gap-1 cursor-pointer"
              >
                <span>Open workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
