import React, { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Target02Icon,
  CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import {
  ChevronDown,
  Check,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { HeroScanMockup } from '../components/HeroScanMockup.js';
import { GreekLightning, GreekLaurel, GreekTemple } from '../components/GreekOrnaments.js';
import { ThreeStepPipeline } from '../components/ThreeStepPipeline.js';
import { CapabilitiesBento } from '../components/CapabilitiesBento.js';
import { AtsPipelineDiagram } from '../components/AtsPipelineDiagram.js';
import { WordExportMockup } from '../components/WordExportMockup.js';
import { LandingCommandMenu } from '../components/LandingCommandMenu.js';
import { Logo } from '../components/Logo.js';
import { OwnerProfileCard, type OwnerProfileData } from '../components/OwnerProfile.js';
import { FREE_SCAN_LIMIT, PRO_PRICE_INR } from '../config.js';
import {
  KeywordMapIllustration,
  MatchScoreIllustration,
  ResumeDocumentIllustration,
} from '../components/AnalysisIllustrations.js';

interface LandingPageProps {
  onScanClick: () => void;
  onOpenPaywall: () => void;
  onOpenDeleteData: () => void;
}

const buildFaqs = (proPriceInr: number) => [
  {
    question: 'How does ResumeSetu identify gaps between my resume and the job?',
    answer:
      'Add your resume and a job description to get a match score, a list of skills the role asks for, and suggestions for areas to review. The score is a guide for comparing your documents, not a prediction of an employer’s screening result.',
  },
  {
    question: 'Does the system invent or fabricate career history?',
    answer:
      'Suggestions use the information in your resume, but you should review every change before using it. Keep only details that accurately reflect your experience; never add skills, results, dates, or credentials you cannot verify.',
  },
  {
    question: 'What file format do I get upon export?',
    answer:
      'You can export an editable Microsoft Word (.docx) resume draft and create a role-specific cover letter. Review the formatting and content before sending your application.',
  },
  {
    question: `Why ₹${proPriceInr}/month instead of pay-per-resume?`,
    answer:
      `Pro costs ₹${proPriceInr} per month and includes unlimited resume scans and tailoring while your membership is active. Payment and activation are handled manually for now; contact the team to request an upgrade.`,
  },
  {
    question: 'How do I upgrade to Pro?',
    answer:
      'Choose Request Pro activation to contact the team on Telegram. An admin checks the payment and activates Pro on your account. There is no automatic checkout or renewal in the current version.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onScanClick,
  onOpenPaywall,
  onOpenDeleteData,
}) => {
  const landingRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  // Owner identity for the footer contact card. Fetched from the server so the
  // handle and photo are deployment configuration, not hard-coded in the bundle.
  const [owner, setOwner] = useState<OwnerProfileData | null>(null);
  // Admin-configurable free-tier limit; the static default only applies until
  // the public config arrives (or if it is unreachable).
  const [freeScanLimit, setFreeScanLimit] = useState(FREE_SCAN_LIMIT);
  // Admin-configurable Pro price; the constant below is only the pre-load default.
  const [proPriceInr, setProPriceInr] = useState(PRO_PRICE_INR);
  const faqs = buildFaqs(proPriceInr);

  useEffect(() => {
    const root = landingRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('section:not(#hero), .landing-card'));
    if (!targets.length) return;
    root.classList.add('reveal-ready');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        element.dataset.revealed = 'true';
        observer.unobserve(element);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });

    targets.forEach((element, index) => {
      element.dataset.reveal = 'true';
      element.style.setProperty('--reveal-delay', `${(index % 3) * 55}ms`);
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      root.classList.remove('reveal-ready');
      targets.forEach((element) => {
        delete element.dataset.reveal;
        delete element.dataset.revealed;
        element.style.removeProperty('--reveal-delay');
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.owner) setOwner(data.owner as OwnerProfileData);
        const limit = Number(data?.freeTierMonthlyLimit);
        if (limit > 0) setFreeScanLimit(limit);
        const price = Number(data?.priceInr);
        if (Number.isFinite(price) && price > 0) setProPriceInr(price);
      })
      .catch(() => {
        // The footer is decorative; a missing contact card must not break the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={landingRef} className="landing-page relative w-full max-w-full min-h-screen bg-[#F7F7F3] text-[#173B36] selection:bg-[#173B36] selection:text-white overflow-x-hidden">
      {/* =========================================================================
          1. HERO SECTION: editorial introduction and document preview
         ========================================================================= */}
      <section id="hero" className="hero-stage relative isolate w-full overflow-hidden border-b">
        <GreekTemple />
        <div className="hero-copy relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-5 text-center sm:px-8" data-reveal>
            <GreekLaurel />
            <div className="hero-intro mb-5 text-xs font-semibold tracking-[0.04em] text-[#7B7B7B]">
              A calmer way to prepare your next application
            </div>

            <h1 className="max-w-4xl text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.04em] text-[#111111] sm:text-6xl lg:text-[4.25rem]">
              Make the right parts of your experience easier to see.
            </h1>
            <p className="mt-5 max-w-[42rem] text-base leading-7 text-[#7B7B7B] sm:text-lg sm:leading-8">
              Compare your resume with a job description, understand where you already fit, and decide what is worth improving before you apply.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <div className="hero-cta-wrap">
                <button type="button" onClick={onScanClick} className="hero-cta group inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:outline-none">
                  <GreekLightning />
                  See how your resume fits
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
              <a href="#how-it-works" className="hero-secondary inline-flex min-h-12 items-center justify-center px-5 py-3 text-sm font-medium text-[#3A3A3A] transition-colors">
                See how it works
              </a>
            </div>

            <div className="hero-trust mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4 text-xs font-medium text-[#7B7B7B]">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4" /> {freeScanLimit} free resume reviews each month</span>
              <span className="hidden h-1 w-1 rounded-full bg-[#BDBDBD] sm:block" />
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Your documents stay yours</span>
            </div>
        </div>
      </section>

      <section className="hero-proof border-b px-4 py-14 sm:px-6 sm:py-20" aria-label="Resume and job description comparison example">
        <div className="mx-auto w-full max-w-6xl" data-reveal>
          <HeroScanMockup onScanClick={onScanClick} />
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#7B7B7B]">
            <span className="font-semibold text-[#111111]">Clear, useful feedback</span>
            <span aria-hidden="true" className="text-[#9A9A9A]">·</span>
            <span>Based on your resume and target role</span>
          </p>
        </div>
      </section>

      {/* =========================================================================
          2. STRUCTURE: VISUAL 3-STEP PIPELINE (Upload -> Analyze -> Land Job)
         ========================================================================= */}
      <ThreeStepPipeline onScanClick={onScanClick} />

      {/* =========================================================================
          3. BENTO GRID FEATURES: gaps, reviewable edits, cover letters, and application tracking
         ========================================================================= */}
      <CapabilitiesBento onScanClick={onScanClick} />

      {/* =========================================================================
          4. HOW IT WORKS: Interactive overview
         ========================================================================= */}
      <AtsPipelineDiagram />

      {/* =========================================================================
          4b. WORD EXPORT MOCKUP: what the downloaded .docx actually looks like
         ========================================================================= */}
      <WordExportMockup onScanClick={onScanClick} />

      {/* =========================================================================
          5. WHAT THE PRODUCT REPORTS BACK
             Replaces a "verified case study" section whose candidates, offers and
             score lifts were invented, and which we cannot substantiate.
         ========================================================================= */}
      <section id="proof" className="relative border-b border-line-steel/30 bg-white py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-core mb-2">
              <HugeiconsIcon icon={Target02Icon} size={16} className="text-blue-core" />
              <span>Clear feedback, based on your documents</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B2545] tracking-tight">
              Helpful feedback, without the guesswork
            </h2>
            <p className="mt-3 text-base sm:text-lg text-[#334E68] leading-relaxed">
              See how your resume compares with a role, what already comes through, and what you may want to review.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: 'A clear resume match',
                body: 'A consistent guide to how your resume compares with the job posting you provide. It is not a hiring prediction.',
              },
              {
                title: 'What the role asks for',
                body: 'See which skills and experience already appear in your resume and which ones may be worth reviewing.',
              },
              {
                title: 'Suggestions you control',
                body: 'Get ideas for explaining your real experience more clearly. Review every suggestion and keep only what is true for you.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group rounded-2xl border border-[#E2EAF3] bg-[#F8FAFD] p-6 sm:p-7 transition-colors hover:border-[#C8DCF5] hover:bg-[#F4F8FE]"
              >
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid" />
                  <h3 className="text-base font-bold text-[#0B2545]">{item.title}</h3>
                </div>
                <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practical product visuals — editorial vector illustrations, no portraits. */}
      <section id="who-its-for" className="relative overflow-hidden border-b border-line-steel/30 py-20 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -left-36 top-12 h-80 w-80 rounded-full bg-blue-core/10 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <span className="mb-3 inline-flex items-center rounded-full border border-blue-pale/60 bg-white/65 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-core backdrop-blur">
                Built for real job searches
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#0B2545] sm:text-4xl">
                Make each application more intentional.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#334E68] sm:text-base">
                Whether you are changing direction or applying for a specialist role, start with the job description. ResumeSetu shows where your resume already aligns and what deserves a closer look before you apply.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  art: <ResumeDocumentIllustration />,
                  title: 'Read your resume clearly',
                  body: 'See the strengths and details extracted from your document.',
                },
                {
                  art: <MatchScoreIllustration />,
                  title: 'Understand your match',
                  body: 'Get a score based on the resume and job description you provide.',
                },
                {
                  art: <KeywordMapIllustration />,
                  title: 'See what to review',
                  body: 'Review relevant job skills and decide what reflects your experience.',
                },
              ].map((item) => (
                <article key={item.title} className="landing-card group overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1">
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-[#F7FAFF] via-[#EFF6FF] to-[#E8F1FF] sm:h-40">
                    <div className="absolute inset-0 opacity-80 transition-transform duration-500 group-hover:scale-[1.04]">
                      {item.art}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-[#0B2545]">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. PRICING LAYOUT: TWO SIDE-BY-SIDE 3D CARDS (Free vs Pro)
             Pro Card is Highly Prominent with Dark Navy Background & Electric Blue Button
         ========================================================================= */}
      <section id="pricing" className="py-20 sm:py-28 border-b border-line-steel/30 scroll-mt-16 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E765B] block mb-2">
              Simple, honest pricing
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#173B36] tracking-tight">
              A clear price for your job search
            </h2>
            <p className="mt-3 text-base sm:text-lg text-[#4C625B] leading-relaxed">
              Start free with {freeScanLimit} resume reviews each month. Upgrade only when a bigger job search needs more room.
            </p>
          </div>

          {/* Two Side-by-Side Pricing Cards with High 3D Elevation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* ----------------- FREE CARD (HIGH TRANSPARENCY GLASSMORPHISM) ----------------- */}
            <div className="p-8 sm:p-9 surface-panel-strong rounded-3xl hover:shadow-[0_28px_60px_-10px_rgba(29,78,216,0.22)] hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-8 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />

              <div className="space-y-4">
                <span className="text-xs font-bold text-[#627D98] uppercase tracking-wider block">
                  Free Forever
                </span>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#0B2545]">₹0</span>
                  <span className="text-xs text-[#627D98]">/ forever</span>
                </div>

                <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed">
                  Review your resume against up to {freeScanLimit} job postings each month.
                </p>

                <div className="pt-5 border-t border-surface/80 space-y-3.5 text-xs sm:text-sm text-[#0B2545]">
                  <div className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid shrink-0" />
                    <span>{freeScanLimit} resume reviews each month</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid shrink-0" />
                    <span>A clear guide to your resume match</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid shrink-0" />
                    <span>See what the job asks for</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid shrink-0" />
                    <span>An easy-to-read resume layout</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#627D98]">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-blue-mid shrink-0" />
                    <span>Encrypted at rest, delete your data on request</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onScanClick}
                className="w-full py-4 px-5 rounded-xl border border-line-steel/40 bg-gradient-to-b from-white/90 to-[#EEF4FB]/90 hover:from-[#EEF4FB] hover:to-[#E2ECF6] text-[#0B2545] font-bold text-xs uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(11,37,69,0.06),inset_0_1px_0_rgba(255,255,255,1)] hover:shadow-md cursor-pointer"
              >
                Start free · {freeScanLimit} reviews each month
              </button>
            </div>

            {/* ----------------- PRO CARD (HIGHLY PROMINENT WITH TRANSLUCENT NAVY GLASS & 3D SHADOW) ----------------- */}
            <div className="p-8 sm:p-9 rounded-3xl bg-[#173B36] text-white border border-[#173B36] shadow-[0_24px_60px_-24px_rgba(23,59,54,0.65)] relative overflow-hidden hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-8">
              {/* Luminous Ambient Radial Glow */}
              <div className="landing-pro-glow absolute top-0 right-0 w-72 h-72 bg-[#D7A66C]/14 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8DA9C4] uppercase tracking-wider">
                    ResumeSetu Pro
                  </span>
                  <span className="text-[11px] font-bold text-white bg-[#1D4ED8] px-3.5 py-1 rounded-full shadow-md tracking-wide">
                    FOR ACTIVE SEARCHES
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono text-white">₹{proPriceInr}</span>
                  <span className="text-xs text-[#8DA9C4]">/ month</span>
                </div>

                <p className="text-xs sm:text-sm text-[#8DA9C4] leading-relaxed">
                  Get unlimited resume reviews, reviewable edits, and role-specific cover letters while Pro is active.
                </p>

                <div className="pt-5 border-t border-white/10 space-y-3.5 text-xs sm:text-sm text-white">
                  <div className="flex items-center gap-2.5 font-medium">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Unlimited resume reviews</span>
                  </div>
                  <div className="flex items-center gap-2.5 font-medium">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>See what the role asks for</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Reviewable resume edits based on your experience</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Role-aligned custom Cover Letter generator</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Keep your applications organized</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1D4ED8] flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                    <span>Editable Word resume draft</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#8DA9C4]">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#8DA9C4]" />
                    </span>
                    <span>Manual payment review and Pro activation</span>
                  </div>
                </div>
              </div>

              {/* Primary Action Button in Electric Blue Gradient */}
              <div className="relative z-10 pt-2">
                <button
                  type="button"
                  onClick={onOpenPaywall}
                  className="w-full py-4 px-6 rounded-xl bg-[#D6814B] hover:bg-[#C36D39] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_10px_22px_-8px_rgba(0,0,0,0.45)] cursor-pointer active:translate-y-0.5 flex items-center justify-center gap-2.5"
                >
                  <span>Upgrade to Pro — ₹{proPriceInr}/mo</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </span>
                </button>
                <p className="text-[11px] text-[#8DA9C4] text-center mt-3 font-medium">
                  Contact the team to request activation · No automatic renewal
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FAQ ACCORDION
         ========================================================================= */}
      <section id="faq" className="py-20 sm:py-28 border-b border-line-steel/30 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2545] tracking-tight">
              Frequently Answered Questions
            </h2>
            <p className="mt-2 text-sm text-[#334E68]">
              Clear answers about resume reviews, exports, and Pro access.
            </p>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="surface-panel rounded-2xl overflow-hidden hover:shadow-md transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                  aria-controls={`faq-panel-${idx}`}
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between text-sm font-bold text-[#0B2545] hover:text-blue-core transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 text-[#8DA9C4] transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-blue-core' : ''
                    }`}
                  />
                </button>

                {openFaq === idx && (
                  <div
                    id={`faq-panel-${idx}`}
                    role="region"
                    aria-label={faq.question}
                    className="px-6 pb-5 text-xs sm:text-sm text-[#334E68] leading-relaxed border-t border-surface pt-3.5"
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. CORPORATE CLOUD FOOTER
         ========================================================================= */}
      <footer className="relative isolate overflow-hidden border-t border-[#315B50] bg-[#173B36] py-12 text-[#D5E2D9] sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 -z-10 h-96 w-96 rounded-full bg-[#D7A66C]/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-w-0">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Logo variant="dark" size="md" />
                <span className="text-xs text-[#8DA9C4]/80 hidden sm:inline">
                  · A clearer way to prepare your next application
                </span>
              </div>
              <p className="text-xs text-[#B8C9DA]/75 mt-3 max-w-sm leading-relaxed">
                Compare your resume with a job posting, decide what to improve, and prepare your next application with care.
              </p>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium lg:pt-2">
              <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
              <a href="#proof" className="transition-colors hover:text-white">What you get</a>
              <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            </nav>

            {/* Owner contact: who handles activation, and where to reach them. */}
            {owner && (
              <div className="w-full lg:w-auto lg:min-w-[340px] rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
                <OwnerProfileCard owner={owner} variant="dark" className="!p-0 !border-0 !bg-transparent w-full" />
                <button
                  type="button"
                  onClick={onOpenPaywall}
                  className="mt-3.5 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Request Pro activation
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={onOpenDeleteData}
                className="hover:text-white transition-colors cursor-pointer font-medium"
              >
                Purge Stored Data
              </button>
              <button
                type="button"
                onClick={onOpenPaywall}
                className="hover:text-white transition-colors cursor-pointer font-medium"
              >
                Pro Membership (₹{proPriceInr}/mo)
              </button>
              <span className="text-[#8DA9C4]/50">© 2026 ResumeSetu</span>
            </div>
            <p className="text-[#8DA9C4]/60 leading-relaxed">
              Pro is activated manually after payment is confirmed — never automatically.
            </p>
          </div>
        </div>
      </footer>
      <LandingCommandMenu onScanClick={onScanClick} />
    </div>
  );
};
