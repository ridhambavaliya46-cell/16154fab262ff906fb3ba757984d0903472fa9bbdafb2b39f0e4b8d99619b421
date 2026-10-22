import React from 'react';
import { FileText, Target, CheckCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ThreeStepPipelineProps {
  onScanClick: () => void;
}

interface StepItem {
  number: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  actionHint: string;
}

const STEPS: StepItem[] = [
  {
    number: '01',
    icon: FileText,
    title: 'Bring your resume and job description',
    description:
      'Upload your current PDF or DOCX file and paste any job listing from Workday, Greenhouse, or Lever.',
    actionHint: 'Supports PDF & DOCX up to 5MB',
  },
  {
    number: '02',
    icon: Target,
    title: 'See what lines up',
    description:
      'Review the overlap, the missing requirements, and the parts worth checking against your real experience.',
    actionHint: 'Clear, document-based feedback',
  },
  {
    number: '03',
    icon: CheckCheck,
    title: 'Prepare a version you can stand behind',
    description:
      'Download an editable Word draft built from your original resume. Read it once, make it yours, then send it.',
    actionHint: 'Editable single-column .DOCX',
  },
];

export const ThreeStepPipeline: React.FC<ThreeStepPipelineProps> = ({ onScanClick }) => {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 border-b border-[#8DA9C4]/30 scroll-mt-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 surface-panel rounded-full mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E765B]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
              A simple, honest process
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B2545] tracking-tight">
            Three steps to{' '}
            <span className="text-blue-core">
              a clearer application
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#334E68] leading-relaxed">
            Start with the documents you already have. Leave with a clearer view of what to keep, change, and verify.
          </p>
        </div>

        {/* 3 Elevated Glassmorphic Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative surface-panel rounded-3xl p-7 sm:p-8 hover:shadow-[0_24px_50px_rgba(29,78,216,0.14)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group overflow-hidden cursor-default"
              >
                {/* Top Specular Sheen Line */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

                <div>
                  {/* Step Top Bar: Icon + Number Badge */}
                  <div className="flex items-center justify-between pb-5 mb-5 border-b border-surface/90">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#0B2545] p-0.5 shadow-[0_6px_16px_rgba(29,78,216,0.25)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                      <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[#1D4ED8]" strokeWidth={2} />
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-[#1D4ED8] px-3 py-1 rounded-xl bg-blue-wash border border-[#93C5FD]/60 shadow-2xs">
                      STEP {step.number}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-[#0B2545] mb-2.5 group-hover:text-[#1D4ED8] transition-colors duration-200">
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Footer Sub-indicator */}
                <div className="pt-5 mt-6 border-t border-surface/90 flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
                  <span className="text-xs text-[#627D98] font-medium">{step.actionHint}</span>
                  {step.number === '01' ? (
                    <button
                      type="button"
                      onClick={onScanClick}
                      aria-label="Start a resume scan"
                      className="w-7 h-7 rounded-lg bg-blue-wash flex items-center justify-center text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white transition-all duration-200 shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/40"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="w-7 h-7 rounded-lg bg-blue-wash flex items-center justify-center text-[#1D4ED8]"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
