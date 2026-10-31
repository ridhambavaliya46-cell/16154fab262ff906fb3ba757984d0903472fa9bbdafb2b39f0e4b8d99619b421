import React, { useEffect, useState } from 'react';
import { FileText, Download, ShieldCheck, Check, Columns, ScanLine } from 'lucide-react';

/**
 * Word export mockup.
 *
 * The pricing and hero copy promise a "single-column editable Word (.docx)
 * export", but nothing on the page ever showed what that document looks like
 * or why the layout matters. This renders a fictional single-column resume and
 * annotates the structural choices applicant-tracking parsers tolerate — it is
 * clearly labelled as illustrative and never claims a third-party parser test.
 */
export const WordExportMockup: React.FC<{ onScanClick?: () => void }> = ({ onScanClick }) => {
  const [parseView, setParseView] = useState(true);

  // Reduced motion: no looping highlight sweep; static parse view is fine.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setParseView(false);
    }
  }, []);

  return (
    <section
      id="export-preview"
      className="py-20 sm:py-28 border-b border-line-steel/30 relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-blue-core/10 blur-3xl"
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-core block mb-2">
            What You Download
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            A clear, single-column Word document
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-soft leading-relaxed">
            Exports use a straightforward reading order with standard headings and editable text.
            This preview explains the layout; third-party parser compatibility has not been tested.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Document page mockup */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-blue-wash via-canvas to-white border border-line/60" aria-hidden="true" />
            <div className="relative bg-white rounded-2xl border border-line shadow-[0_24px_60px_-18px_rgba(11,37,69,0.25)] overflow-hidden">
              <div className="absolute right-4 top-14 z-10 rounded-full border border-line bg-canvas px-2.5 py-1 text-[10px] font-semibold text-ink-soft shadow-sm">
                Illustrative sample resume
              </div>

              {/* Window bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line/70 bg-canvas/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/60 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-core/70 inline-block" />
                  <span className="ml-2 text-[11px] font-mono font-bold text-ink truncate">
                    a_sharma_resume_tailored.docx
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                    parseView
                      ? 'bg-blue-wash text-blue-core border-blue-pale'
                      : 'bg-surface text-ink-soft border-line'
                  }`}
                >
                  <ScanLine className="w-3 h-3" />
                  {parseView ? 'Reading order view' : 'Clean view'}
                </span>
              </div>

              {/* Page body — deliberately plain, single column */}
              <div className="relative p-5 sm:p-7 space-y-4">
                <div className="border-b-2 border-line pb-3">
                  <div className="text-lg font-extrabold text-ink tracking-tight">Ananya Sharma</div>
                  <div className="text-xs font-semibold text-blue-core mt-0.5">
                    Staff Backend Engineer · Bengaluru
                  </div>
                  <div className="text-[11px] text-ink-faint font-mono mt-1">
                    ananya.sharma@example.com · +91 98xxx xxxxx · github.com/asharma
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
                    Experience
                  </div>
                  <div className="text-xs font-bold text-ink">
                    Payments Platform · Senior Engineer{' '}
                    <span className="font-normal text-ink-faint">— 2022–Present</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-ink-soft leading-relaxed list-disc pl-4">
                    <li>
                      Built payment services in TypeScript and worked with the team to improve
                      request handling.
                    </li>
                    <li>
                      Led PostgreSQL indexing programme that removed the checkout service's two
                      largest query bottlenecks.
                    </li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink">
                    Skills
                  </div>
                  <p className="text-[11px] text-ink-soft leading-relaxed font-mono">
                    TypeScript · Node.js · PostgreSQL · Kafka · Kubernetes · AWS ECS · Terraform
                  </p>
                </div>

                {/* Parse annotations — only in parse view */}
                {parseView && (
                  <div className="absolute inset-x-5 sm:inset-x-7 bottom-4 space-y-1.5 pointer-events-none">
                    {[
                      { top: '18%', label: 'Single column — clear reading order' },
                      { top: '46%', label: 'Standard section heading' },
                      { top: '72%', label: 'Editable bullet list' },
                    ].map((note) => (
                      <div
                        key={note.label}
                        className="flex items-center gap-2 rounded-lg bg-blue-core/95 text-white px-2.5 py-1.5 text-[10px] font-semibold shadow-[0_8px_20px_rgba(29,78,216,0.35)] animate-in fade-in slide-in-from-left-2 duration-300"
                      >
                        <Check className="w-3 h-3 shrink-0" />
                        <span>{note.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* View toggle */}
            <button
              type="button"
              onClick={() => setParseView((v) => !v)}
              className="mt-4 mx-auto flex items-center gap-2 px-4 py-2 rounded-full border border-line bg-white hover:bg-canvas text-xs font-bold text-ink transition-colors cursor-pointer shadow-xs"
              aria-pressed={parseView}
            >
              <Columns className="w-3.5 h-3.5 text-blue-core" />
              {parseView ? 'Hide layout notes' : 'Show layout notes'}
            </button>
          </div>

          {/* Export contents panel */}
          <div className="glass-panel rounded-3xl !bg-white/70 backdrop-blur-xl border border-white/80 p-6 sm:p-7 space-y-5 shadow-[0_16px_40px_-18px_rgba(11,37,69,0.25)]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-wash text-blue-core flex items-center justify-center border border-blue-pale/60 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Every tailored export includes</h3>
                <p className="text-[11px] text-ink-faint">Generated from your scan, editable by you</p>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-ink-soft">
              {[
                {
                    title: 'Single-column .docx',
                    body: 'One flowing column with standard headings and editable text. Third-party parser compatibility is not tested.',
                },
                {
                  title: 'Keyword-aligned rewrite',
                  body: 'Your own experience, restructured with the STAR formula around the terms this posting asks for.',
                },
                {
                  title: 'Matching cover letter',
                  body: 'A role-aligned first draft in the same voice, with placeholders where only you know the facts.',
                },
                {
                  title: 'Honest gaps stay gaps',
                  body: 'Keywords you never worked with are reported as gaps, never silently written into the document.',
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-2.5">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-wash text-blue-core flex items-center justify-center shrink-0 border border-blue-pale/60">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span>
                    <strong className="font-bold text-ink block leading-snug">{item.title}</strong>
                    {item.body}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-start gap-2 rounded-xl bg-canvas border border-line px-3 py-2.5 text-[11px] text-ink-soft leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-blue-mid shrink-0 mt-px" />
              <span>
                ResumeSetu does not submit your file to Greenhouse, Workday or Lever, so no vendor
                pass rate is claimed — only the document structure is under our control, and it is.
              </span>
            </div>

            <button
              type="button"
              onClick={onScanClick}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-blue-core via-blue-mid to-blue-bright hover:from-blue-deep hover:via-blue-core hover:to-[#2563EB] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_10px_24px_-4px_rgba(29,78,216,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Generate Yours Free</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
