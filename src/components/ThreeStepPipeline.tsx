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
    title: 'Share your resume and the role',
    description:
      'Choose a PDF or Word file and paste the job posting you’re interested in.',
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
    <section id="how-it-works" className="pipeline-section py-20 sm:py-28 border-b scroll-mt-16 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="process-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E765B]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
              A simple, honest process
            </span>
          </div>
          <h2 className="pipeline-title text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            Three steps to{' '}
            <span className="pipeline-title-accent">
              a clearer application
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#334E68] leading-relaxed">
            Start with the documents you already have. Leave with a clearer view of what to keep, change, and verify.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="pipeline-card relative rounded-[1.5rem] p-7 sm:p-8 transition-all duration-300 flex flex-col justify-between group overflow-hidden cursor-default"
              >
                {/* Top Specular Sheen Line */}
                <div className="pipeline-topline absolute inset-x-0 top-0 h-[2px]" />

                <div>
                  {/* Step Top Bar: Icon + Number Badge */}
                  <div className="flex items-center justify-between pb-5 mb-5 border-b">
                    <div className="pipeline-icon-shell w-12 h-12 rounded-2xl p-[2px] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                      <div className="pipeline-icon-face w-full h-full rounded-[14px] flex items-center justify-center">
                        <Icon className="pipeline-icon w-5 h-5" strokeWidth={2} />
                      </div>
                    </div>

                    <span className="pipeline-step font-mono text-xs font-bold px-3 py-1 rounded-full border">
                      STEP {step.number}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="pipeline-card-title text-xl font-semibold mb-2.5 transition-colors duration-200">
                    {step.title}
                  </h3>

                  <p className="pipeline-card-copy text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Footer Sub-indicator */}
                <div className="pipeline-card-footer pt-5 mt-6 border-t flex items-center justify-between gap-3 text-xs font-semibold">
                  <span className="pipeline-hint text-xs font-medium">{step.actionHint}</span>
                  {step.number === '01' ? (
                    <button
                      type="button"
                      onClick={onScanClick}
                      aria-label="Start a resume scan"
                      className="pipeline-arrow w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2"
                    >
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="pipeline-arrow w-9 h-9 rounded-xl flex items-center justify-center"
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
