import React, { useState } from 'react';
import {
  FileText,
  Target,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  Search,
  Check,
} from 'lucide-react';

interface Stage {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tag: string;
  inputLabel: string;
  inputValue: string;
  outputLabel: string;
  outputValue: string;
  highlights: string[];
}

const STAGES: Stage[] = [
  {
    id: 'parse',
    step: '01',
    title: 'Start with your resume',
    subtitle: 'Choose a PDF or Word file and we’ll read the text for you.',
    icon: FileText,
    tag: 'Your experience',
    inputLabel: 'Your resume',
    inputValue: 'The experience, skills, and education you already shared',
    outputLabel: 'Easy-to-read details',
    outputValue: 'Your work history and skills, ready to compare with a role',
    highlights: ['Your own experience stays yours', 'No achievements are added', 'Your original resume is kept intact'],
  },
  {
    id: 'matrix',
    step: '02',
    title: 'Choose a job posting',
    subtitle: 'Paste the role you’re interested in, from any job site.',
    icon: Search,
    tag: 'The role you want',
    inputLabel: 'Job posting',
    inputValue: 'The responsibilities and experience the employer describes',
    outputLabel: 'What the role asks for',
    outputValue: 'Skills and experience mentioned in the posting',
    highlights: ['Key skills are easy to review', 'Role details stay tied to the posting', 'Nothing is assumed about the employer'],
  },
  {
    id: 'radar',
    step: '03',
    title: 'See where you fit',
    subtitle: 'Compare the job with your resume and choose what to work on.',
    icon: Target,
    tag: 'A clear comparison',
    inputLabel: 'Your resume and the role',
    inputValue: 'See which skills and experience already come through',
    outputLabel: 'Your resume match',
    outputValue: 'A helpful comparison of your documents — never a hiring prediction',
    highlights: ['See what is already in your resume', 'Review what could be clearer', 'No invented skills or achievements'],
  },
  {
    id: 'compile',
    step: '04',
    title: 'Prepare your application',
    subtitle: 'Make a draft you can review, edit, and feel comfortable sending.',
    icon: FileCheck,
    tag: 'Your editable draft',
    inputLabel: 'Your experience',
    inputValue: 'Your career history and the details you can stand behind',
    outputLabel: 'Resume and cover letter',
    outputValue: 'Editable Word documents to review before you send',
    highlights: ['You review every suggestion', 'Your original facts stay intact', 'Make the final version your own'],
  },
];

export const AtsPipelineDiagram: React.FC = () => {
  const [activeStageId, setActiveStageId] = useState<string>('radar');
  const activeStage = STAGES.find((s) => s.id === activeStageId) || STAGES[2];

  return (
    <section id="pipeline" className="py-16 sm:py-24 border-b border-[#8DA9C4]/30 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] mb-2">
            A clear, simple process
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0B2545] tracking-tight">
            From your resume to your next application
          </h2>
          <p className="mt-2 text-base text-[#334E68]">
            Add your resume and a job posting. We’ll help you see what fits and what to review.
          </p>
        </div>

        {/* 4 Stage Interactive Selector Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.id === activeStageId;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageId(stage.id)}
                className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer backdrop-blur-xl ${
                  isActive
                    ? 'bg-white/80 border-[#1D4ED8] shadow-[0_8px_20px_rgba(29,78,216,0.15)] ring-2 ring-[#1D4ED8]/20'
                    : 'bg-white/40 border-white/70 hover:border-[#8DA9C4] hover:bg-white/70 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-mono font-bold ${isActive ? 'text-[#1D4ED8]' : 'text-[#627D98]'}`}>
                    {stage.step}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-[#F0F4F8] text-[#334E68]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-[#0B2545]">
                  {stage.title}
                </h3>
                <p className="text-xs text-[#627D98] mt-1 line-clamp-2 leading-relaxed">
                  {stage.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Stage detail panel */}
        <div className="rounded-3xl bg-white/45 backdrop-blur-2xl border border-white/70 p-6 sm:p-8 shadow-[0_20px_50px_-10px_rgba(11,37,69,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface">
            <div>
              <span className="text-xs font-semibold text-[#1D4ED8]">
                Step {activeStage.step} · {activeStage.tag}
              </span>
              <h3 className="text-xl font-bold text-[#0B2545] mt-0.5">
                {activeStage.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] mt-0.5">
                {activeStage.subtitle}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-wash border border-blue-pale text-xs text-blue-deep font-medium self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-mid" />
                <span>Made for you to review and edit</span>
            </div>
          </div>

          {/* Transformation Flow: Input -> Output */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 my-6 items-center">
            {/* Input Box */}
            <div className="md:col-span-5 p-4 rounded-xl bg-canvas border border-line space-y-1.5">
              <span className="text-[11px] font-medium text-ink-faint uppercase tracking-wide block">
                Start with
              </span>
              <p className="text-xs font-semibold text-ink">
                {activeStage.inputLabel}
              </p>
              <p className="text-xs text-ink-soft leading-relaxed">
                {activeStage.inputValue}
              </p>
            </div>

            {/* Connecting Visual Arrow */}
            <div className="md:col-span-2 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-surface border border-line flex items-center justify-center text-ink-soft shadow-xs">
                <ArrowRight className="w-4 h-4" />
              </div>
              <span className="text-[11px] text-ink-faint mt-1.5 font-medium">
                Then see
              </span>
            </div>

            {/* Output Box */}
            <div className="md:col-span-5 p-4 rounded-xl bg-blue-wash/40 border border-blue-pale space-y-1.5">
              <span className="text-[11px] font-medium text-blue-core uppercase tracking-wide block">
                What you get
              </span>
              <p className="text-xs font-semibold text-ink">
                {activeStage.outputLabel}
              </p>
              <p className="text-xs text-ink-soft leading-relaxed">
                {activeStage.outputValue}
              </p>
            </div>
          </div>

          {/* Key Stage Verifications */}
          <div className="pt-4 border-t border-surface flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-faint">Helpful to know:</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeStage.highlights.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-soft bg-canvas px-2.5 py-1 rounded-md border border-line"
                >
                  <Check className="w-3.5 h-3.5 text-blue-mid" />
                  <span>{h}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
