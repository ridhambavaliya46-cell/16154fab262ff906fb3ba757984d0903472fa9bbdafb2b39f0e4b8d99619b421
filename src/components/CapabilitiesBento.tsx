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
    'Project planning',
    'Team leadership',
    'Product launches',
  ]);

  const testKeywords = [
    { name: 'Project planning', weight: 15 },
    { name: 'Team leadership', weight: 14 },
    { name: 'Product launches', weight: 16 },
    { name: 'Customer research', weight: 18 },
    { name: 'Budget ownership', weight: 12 },
    { name: 'Data analysis', weight: 15 },
  ];

  const currentScore = Math.min(
    98,
    30 +
      testKeywords
        .filter((k) => activeKeywords.includes(k.name))
        .reduce((acc, curr) => acc + curr.weight, 0)
  );

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
  const [letterTone, setLetterTone] = useState<'direct' | 'warm' | 'growth'>('direct');

  const toneSnippets = {
    direct:
      'I’m interested in this role because my experience in customer research and project delivery fits what your team is looking for.',
    warm:
      'I’m excited to bring my background in product planning and teamwork to a company whose work I admire.',
    growth:
      'In my current role, I’ve helped bring new ideas from planning through launch and learned to work well across teams.',
  };

  // Card 4: Application Tracker active filter
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'interview' | 'offers'>('all');

  const trackedApplications = [
    {
      company: 'Northstar Studio',
      role: 'Project coordinator',
      matchScore: 78,
      status: 'Interview',
      statusClass: 'bg-blue-wash text-blue-core border-blue-pale',
      isOffer: false,
    },
    {
      company: 'Field & Form',
      role: 'Product associate',
      matchScore: 72,
      status: 'Interview',
      statusClass: 'bg-blue-wash text-blue-core border-blue-pale',
      isOffer: false,
    },
    {
      company: 'Cedar Works',
      role: 'Operations lead',
      matchScore: 86,
      status: 'Offer',
      statusClass: 'bg-blue-wash text-blue-deep border-blue-pale font-bold',
      isOffer: true,
    },
  ];

  const filteredApplications = trackedApplications.filter((app) => {
    if (trackerFilter === 'offers') return app.isOffer;
    if (trackerFilter === 'interview') return !app.isOffer;
    return true;
  });

  return (
    <section id="capabilities" className="py-20 sm:py-28 border-b border-[#8DA9C4]/30 scroll-mt-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-xs mb-3">
            <HugeiconsIcon icon={FilterIcon} size={14} className="text-[#8B7045]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B7045]">
              Practical tools
            </span>
          </div>

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
                  <div className="w-11 h-11 rounded-2xl bg-[#111111] p-0.5 shadow-[0_6px_16px_rgba(17,17,17,0.16)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#111111] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={FilterIcon} size={20} className="text-white relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">What the role asks for</h3>
                    <p className="text-[11px] text-[#627D98]">Skills and experience to review</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono px-3 py-1.5 rounded-xl bg-white/80 border border-[#8DA9C4]/30 shadow-xs">
                  <span className="text-[11px] text-[#627D98]">Example match:</span>
                  <span
                    className={`text-xl font-black tabular-nums ${
                      currentScore >= 80 ? 'text-blue-core' : 'text-[#1D4ED8]'
                    }`}
                  >
                    {currentScore}%
                  </span>
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
                    </button>
                  );
                })}
              </div>

              {/*
                Interactive demo, not a live scan. The score below is derived from
                the chips you toggle here and has nothing to do with your real
                documents. The workspace shows the actual engine output instead.
              */}
              <div className="p-3.5 rounded-2xl bg-white/70 border border-[#8DA9C4]/30 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-[#0B2545] flex items-center gap-1.5 font-bold">
                    <HugeiconsIcon icon={Shield01Icon} size={14} className="text-blue-mid" />
                    How the resume lines up
                  </span>
                  <span className="font-mono font-bold text-blue-core">
                    Example only — not a hiring prediction
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentScore >= 80
                        ? 'bg-gradient-to-r from-blue-mid to-blue-light'
                        : 'bg-gradient-to-r from-[#1D4ED8] to-[#60A5FA]'
                    }`}
                    style={{ width: `${currentScore}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-surface/80 flex items-center justify-between text-xs text-[#627D98]">
                  <span>Example only · your real review uses your documents</span>
              <button
                onClick={onScanClick}
                className="font-bold text-[#1D4ED8] hover:text-blue-core flex items-center gap-1 cursor-pointer"
              >
                <span>See how your resume fits</span>
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
                  <div className="w-11 h-11 rounded-2xl bg-[#111111] p-0.5 shadow-[0_6px_16px_rgba(17,17,17,0.16)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#111111] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={FileValidationIcon} size={20} className="text-white relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">A clearer resume draft</h3>
                    <p className="text-[11px] text-[#627D98]">You review every change</p>
                  </div>
                </div>

                {/* Switcher */}
                <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-xl border border-[#8DA9C4]/35 shadow-xs">
                  <button
                    onClick={() => setBulletMode('raw')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      bulletMode === 'raw'
                        ? 'bg-[#0B2545] text-white'
                        : 'text-[#627D98]'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setBulletMode('tailored')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      bulletMode === 'tailored'
                        ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-xs'
                        : 'text-[#627D98]'
                    }`}
                  >
                    Clearer
                  </button>
                </div>
              </div>

              {/* Bullet Comparison Display */}
              <div className="p-3.5 rounded-2xl bg-white/70 border border-[#8DA9C4]/30 space-y-2 mb-3 shadow-inner">
                <div className="text-[10px] font-mono text-[#627D98] flex items-center justify-between">
                  <span>{bulletMode === 'raw' ? 'Original wording' : 'A clearer version'}</span>
                  <span
                    className={`font-bold ${
                      bulletMode === 'raw' ? 'text-warning' : 'text-blue-core'
                    }`}
                  >
                    {bulletMode === 'raw' ? 'Before' : 'After'}
                  </span>
                </div>

                <p className="text-[11px] sm:text-xs text-[#0B2545] leading-relaxed font-mono">
                  {bulletMode === 'raw'
                    ? 'Helped plan weekly promotions and shared campaign updates with the sales team.'
                    : 'Coordinated weekly promotions with the sales team and kept everyone updated on campaign progress.'}
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
                  <span>Easy-to-read layout</span>
                  <span className="font-bold text-blue-core flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Editable Word draft
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
                  <div className="w-11 h-11 rounded-2xl bg-[#111111] p-0.5 shadow-[0_6px_16px_rgba(17,17,17,0.16)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#111111] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={Mail01Icon} size={20} className="text-white relative z-10" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B2545]">Cover Letter</h3>
                    <p className="text-[11px] text-[#627D98]">A first draft, in your voice</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold text-[#1D4ED8] bg-[#1D4ED8]/10 px-2 py-0.5 rounded-full border border-[#1D4ED8]/25">
                  Draft for review
                </span>
              </div>

              {/* Tone Selection Tabs */}
              <div className="flex items-center gap-1.5 mb-3">
                {(['direct', 'warm', 'growth'] as const).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setLetterTone(tone)}
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
              <span>Make it yours</span>
              <span className="font-bold text-[#1D4ED8]">Ready to review</span>
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
                  <div className="w-11 h-11 rounded-2xl bg-[#111111] p-0.5 shadow-[0_6px_16px_rgba(17,17,17,0.16)] flex items-center justify-center shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#111111] flex items-center justify-center relative overflow-hidden">
                      <HugeiconsIcon icon={Briefcase01Icon} size={20} className="text-white relative z-10" />
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
                      onClick={() => setTrackerFilter(filter)}
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
                        {app.matchScore}%
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
                <span>Open Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
