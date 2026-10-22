import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Target,
  PenLine,
  Mail,
  ShieldCheck,
  Check,
  ArrowRight,
  X,
  Download,
  Copy,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Briefcase,
  BarChart3,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useDialogA11y } from '../hooks/useDialogA11y.js';
import { ScoreGauge } from '../components/ScoreGauge.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { ResumeHighlightPreview } from '../components/ResumeHighlightPreview.js';
import { ScoreExplainer } from '../components/ScoreExplainer.js';
import { FREE_SCAN_LIMIT } from '../config.js';
import {
  ApplicationRecord,
  AtsAnalysis,
  DocumentCheck,
  DocumentCheckReport,
  GroundingReport,
  ResumeCheck,
  TailoredResult,
} from '../types/index.js';

interface DashboardProps {
  onOpenPaywall: () => void;
}

type WorkspaceTab = 'calibration' | 'tailored' | 'cover' | 'tracker' | 'intelligence';

/** Tracker rows are server records; the DB status enum is the source of truth. */
type TrackedStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

const STATUS_OPTIONS: Array<{ value: TrackedStatus; label: string }> = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Rejected' },
];

const STATUS_LABEL: Record<TrackedStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

const STATUS_BADGE: Record<TrackedStatus, string> = {
  SAVED: 'bg-[#F0F4F8] text-[#334E68] border border-[#CBD5E1]',
  APPLIED: 'bg-blue-wash text-[#0B2545] border border-[#93C5FD]/60',
  INTERVIEW: 'bg-warning-soft text-warning-strong border border-warning-border',
  OFFER: 'bg-success-soft text-success border border-success-border',
  REJECTED: 'bg-danger-soft text-danger-strong border border-danger-border',
};

interface TrackedJob {
  id: string;
  company: string;
  role: string;
  /** Real ATS score from a scan, or null when the row was entered by hand. */
  matchScore: number | null;
  status: TrackedStatus;
  appliedDate: string;
  notes: string;
}

interface StarSuggestion {
  original: string;
  suggestion: string;
  keyword: string;
}

const PRESET_JOB_DESCRIPTIONS = [
  {
    title: 'Full Stack Engineer',
    company: 'Fintech Scaleup',
    text: `Job Title: Senior Full Stack Engineer
Location: Remote / Hybrid
About the Role:
We are looking for a Senior Full Stack Engineer to lead architecture across our distributed microservices and frontend client applications.

Key Responsibilities:
- Build high-scale web apps using React, Next.js, TypeScript, and Node.js.
- Architect and optimize REST & GraphQL microservices backed by PostgreSQL and Redis.
- Deploy and monitor distributed cloud infrastructure on AWS.
- Drive CI/CD automation pipelines, automated end-to-end testing, and enforce strict TypeScript typings.
- Mentor engineers, participate in system design audits, and collaborate closely with Product and Design.

Requirements:
- 4+ years of production experience in React, TypeScript, and Node.js.
- Solid understanding of relational database indexing, query optimization, and caching.
- Hands-on experience with Docker, CI/CD pipelines, and cloud primitives.
- Strong communication and cross-functional leadership skills.`,
  },
  {
    title: 'Product Manager',
    company: 'B2B SaaS Unicorn',
    text: `Job Title: Lead Product Manager - Growth & Platform
About the Role:
We are searching for an experienced Product Manager to steer product roadmap, user acquisition funnels, and monetization strategy.

Responsibilities:
- Define product requirements, user stories, and acceptance criteria for core workflow tools.
- Partner with engineering, UX design, and data science to run rapid A/B experiments and optimize user onboarding.
- Analyze funnel metrics in SQL and analytics cohorts to identify conversion bottlenecks.
- Lead quarterly planning, stakeholder alignments, and Go-To-Market (GTM) launches.

Qualifications:
- 5+ years of PM experience in B2B SaaS or high-growth tech platforms.
- Deep proficiency with SQL, cohort analysis, and quantitative growth experiments.
- Demonstrated ability to synthesize customer feedback into intuitive feature roadmaps.`,
  },
];

/**
 * One labelled score with its own definition.
 *
 * The three ATS scores are rendered through this so a reader can never mistake
 * the blended score for keyword coverage, or a semantic estimate for a measured
 * fact.
 */
const ScoreBar: React.FC<{
  label: string;
  hint: string;
  value: number;
  tone?: 'navy' | 'blue' | 'steel';
  estimated?: boolean;
}> = ({ label, hint, value, tone = 'navy', estimated = false }) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill =
    tone === 'blue'
      ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB]'
      : tone === 'steel'
        ? 'bg-[#8DA9C4]'
        : 'bg-gradient-to-r from-[#0B2545] to-[#1D4ED8]';
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-semibold text-[#334E68] flex items-center gap-1.5">
          {label}
          {estimated && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-surface text-[#627D98] border border-line">
              Estimated
            </span>
          )}
        </span>
        <span className="text-xs font-bold text-[#0B2545] tabular-nums">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
        <div
          className={`${fill} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-[11px] text-[#627D98] leading-relaxed">{hint}</p>
    </div>
  );
};

/** Coloured status chip for a tracker row. */
const StatusBadge: React.FC<{ status: TrackedStatus }> = ({ status }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block ${
      STATUS_BADGE[status] ?? STATUS_BADGE.SAVED
    }`}
  >
    {STATUS_LABEL[status] ?? status}
  </span>
);

const TrackerMetric: React.FC<{
  label: string;
  value: number;
  tone?: 'navy' | 'blue' | 'purple' | 'green';
  secondary?: string;
}> = ({ label, value, tone = 'navy', secondary }) => {
  const color =
    tone === 'blue'
      ? 'text-blue-core'
      : tone === 'purple'
      ? 'text-warning'
      : tone === 'green'
      ? 'text-success'
      : 'text-[#0B2545]';
  return (
    <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xs">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#627D98] block">{label}</span>
      <span className={`text-2xl font-extrabold font-['Space_Grotesk'] mt-0.5 block tabular-nums ${color}`}>
        {value}
      </span>
      {secondary && <span className="text-[10px] text-[#627D98] block">{secondary}</span>}
    </div>
  );
};

const TrackerStatusSelect: React.FC<{
  job: TrackedJob;
  disabled: boolean;
  onChange: (id: string, status: TrackedStatus) => void;
}> = ({ job, disabled, onChange }) => (
  <select
    value={job.status}
    disabled={disabled}
    onChange={(event) => onChange(job.id, event.target.value as TrackedStatus)}
    aria-label={`Update status for ${job.role} at ${job.company}`}
    className="text-xs font-semibold text-[#0B2545] bg-white border border-line rounded-xl px-2.5 py-1.5 focus:border-[#1D4ED8] cursor-pointer disabled:opacity-50"
  >
    {STATUS_OPTIONS.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

/**
 * Notes are edited inline and persisted on blur, so a note is never silently lost
 * and the tracker has no hidden state.
 */
const TrackerNotes: React.FC<{
  job: TrackedJob;
  onSave: (id: string, notes: string) => void;
}> = ({ job, onSave }) => {
  const [value, setValue] = useState(job.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(job.notes);
  }, [job.id, job.notes]);

  return (
    <div className="min-w-0">
      <label htmlFor={`notes-${job.id}`} className="sr-only">
        Notes for {job.role} at {job.company}
      </label>
      <textarea
        id={`notes-${job.id}`}
        rows={2}
        value={value}
        placeholder="Add a note…"
        onChange={(event) => setValue(event.target.value)}
        onBlur={async () => {
          if (value === job.notes) return;
          setSaving(true);
          try {
            await onSave(job.id, value);
          } finally {
            setSaving(false);
          }
        }}
        className="w-full p-2 rounded-lg border border-line bg-canvas focus:bg-white text-xs text-[#0B2545] resize-y focus:outline-none focus:border-[#1D4ED8]"
      />
      {saving && <span className="text-[10px] text-[#627D98]">Saving…</span>}
    </div>
  );
};

const TrackerDelete: React.FC<{
  job: TrackedJob;
  onDelete: (id: string) => void;
}> = ({ job, onDelete }) => (
  <button
    type="button"
    onClick={() => onDelete(job.id)}
    aria-label={`Delete ${job.role} at ${job.company}`}
    title="Delete this application"
    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#627D98] hover:border-danger-border hover:bg-danger-soft hover:text-danger cursor-pointer"
  >
    <X className="w-3 h-3" />
    <span>Delete</span>
  </button>
);

/** Document-check chip, including the explicit "Not tested" state. */
const CHECK_STYLE: Record<DocumentCheck['status'], string> = {
  pass: 'bg-success-soft text-success border border-success-border',
  warn: 'bg-warning-soft text-warning border border-warning-border',
  fail: 'bg-danger-soft text-danger border border-danger-border',
  not_tested: 'bg-[#F0F4F8] text-[#627D98] border border-[#CBD5E1]',
};

const CHECK_LABEL: Record<DocumentCheck['status'], string> = {
  pass: 'Pass',
  warn: 'Review',
  fail: 'Fail',
  not_tested: 'Not tested',
};

/**
 * Final validation readout.
 *
 * Shows what ResumeSetu removed or flagged when it compared the generated
 * document against the candidate's uploaded resume. Anything still listed here
 * is unverified content the candidate must confirm before submitting.
 */
const GroundingPanel: React.FC<{
  grounding: { resume: GroundingReport; coverLetter: GroundingReport };
  only?: 'resume' | 'coverLetter';
}> = ({ grounding, only }) => {
  const reports =
    only === 'resume'
      ? [{ label: 'Tailored resume', report: grounding.resume }]
      : only === 'coverLetter'
      ? [{ label: 'Cover letter', report: grounding.coverLetter }]
      : [
          { label: 'Tailored resume', report: grounding.resume },
          { label: 'Cover letter', report: grounding.coverLetter },
        ];

  const unverified = reports.flatMap((entry) => entry.report.findings.filter((f) => f.kind !== 'fabricated_metric'));
  const redactions = reports.reduce((total, entry) => total + entry.report.redactions.length, 0);
  const itemsToReview = unverified.length + redactions;

  return (
    <div className="rounded-2xl border border-blue-pale bg-blue-wash/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0B2545] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
          Checked against your uploaded resume
        </h4>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-blue-pale bg-white text-[#1D4ED8]">
          {itemsToReview === 0
            ? 'No unsupported claims'
            : `${unverified.length} claim${unverified.length === 1 ? '' : 's'} to review${
                redactions > 0 ? ` · ${redactions} redacted` : ''
              }`}
        </span>
      </div>

      <ul className="space-y-1.5 text-xs text-[#334E68]">
        {reports.map((entry) => (
          <li key={entry.label} className="flex gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] shrink-0 mt-1.5" />
            <span className="break-words">
              <strong className="font-bold text-[#0B2545]">{entry.label}:</strong>{' '}
              {entry.report.note}
            </span>
          </li>
        ))}
      </ul>

      {unverified.length > 0 && (
        <ul className="space-y-1.5">
          {unverified.slice(0, 6).map((finding) => (
            <li
              key={finding.id}
              className="text-xs rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-warning-strong"
            >
              <strong className="font-bold break-words">{finding.excerpt}</strong> — {finding.explanation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ onOpenPaywall }) => {
  const { user, refreshUser, proPriceInr } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('calibration');
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'input' | 'results'>('input');

  // Input States
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [sampleType, setSampleType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Execution States
  const [loading, setLoading] = useState(false);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result States
  const [currentCheck, setCurrentCheck] = useState<ResumeCheck | null>(null);
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null);
  // The candidate's own resume text, echoed by /api/check so the highlighted
  // preview can be built locally. It is never rewritten — only pointed at.
  const [sourceResumeText, setSourceResumeText] = useState('');
  const [exportWithHighlights, setExportWithHighlights] = useState(false);
  const [documentReport, setDocumentReport] = useState<DocumentCheckReport | null>(null);
  const [grounding, setGrounding] = useState<{ resume: GroundingReport; coverLetter: GroundingReport } | null>(null);
  const [tailoredData, setTailoredData] = useState<TailoredResult | null>(null);
  const [historyChecks, setHistoryChecks] = useState<ResumeCheck[]>([]);
  // STAR guidance arrives on the `analysis` payload of /api/check, not on the
  // persisted `check` row, so it is held separately and reset on every new scan.
  const [starSuggestions, setStarSuggestions] = useState<StarSuggestion[]>([]);
  const [showRawAnalysis, setShowRawAnalysis] = useState(false);

  // Editable copies of the generated documents. Editing is local until the
  // candidate copies or downloads; nothing is silently written back to the DB.
  const [editedResume, setEditedResume] = useState('');
  const [editedCoverLetter, setEditedCoverLetter] = useState('');
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);

  // Application Tracker State — server-backed, so counts are real DB records.
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [newJobCompany, setNewJobCompany] = useState('');
  const [newJobRole, setNewJobRole] = useState('');
  const [newJobStatus, setNewJobStatus] = useState<TrackedStatus>('SAVED');
  const [newJobNotes, setNewJobNotes] = useState('');
  const [savingNewJob, setSavingNewJob] = useState(false);

  // Clipboard feedbacks
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const [copiedBulletIdx, setCopiedBulletIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (scrollTimerRef.current !== undefined) clearTimeout(scrollTimerRef.current);
    },
    []
  );

  const addJobModalRef = useDialogA11y(showAddJobModal, () => setShowAddJobModal(false));

  const isPro = user?.plan === 'pro';

  // Every figure rendered below is derived from these, so a number can never
  // appear on screen that the engine did not actually produce.
  //
  // `matchedCount` / `requiredCount` come from the analysis payload. The
  // previous code used `strengths.length` (a count of generated sentences) as
  // the numerator, which is how a resume covering 2 of 7 keywords (29%) could be
  // labelled an 86% "tracked keyword match".
  const matchedKeywordCount = analysis?.matchedCount ?? 0;
  const missingKeywordCount = analysis?.missingCount ?? 0;
  const requiredKeywordCount = analysis?.requiredCount ?? 0;
  const keywordCoveragePercent = analysis?.keywordCoveragePercent ?? 0;
  const semanticMatchPercent = analysis?.semanticMatchScore ?? 0;
  const overallScore = analysis?.matchScore ?? currentCheck?.match_score ?? 0;
  const missingShare = requiredKeywordCount > 0 ? (missingKeywordCount / requiredKeywordCount) * 100 : 0;
  const scoredScans = historyChecks.filter((c) => typeof c.match_score === 'number');
  const averageMatchScore = scoredScans.length
    ? Math.round(scoredScans.reduce((acc, c) => acc + (c.match_score || 0), 0) / scoredScans.length)
    : null;
  const bestMatchScore = scoredScans.length
    ? Math.max(...scoredScans.map((c) => c.match_score || 0))
    : null;
  const scoredApplications = trackedJobs.filter((job) => typeof job.matchScore === 'number');
  const averageApplicationScore = scoredApplications.length
    ? Math.round(
        scoredApplications.reduce((acc, job) => acc + (job.matchScore || 0), 0) / scoredApplications.length
      )
    : null;
  const countByStatus = (status: TrackedStatus) =>
    trackedJobs.filter((job) => job.status === status).length;

  const resumeText = editedResume || tailoredData?.tailored_resume_text || '';
  const coverLetterText = editedCoverLetter || tailoredData?.cover_letter_text || '';

  useEffect(() => {
    void fetchHistory();
    void fetchTrackedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchHistory = async () => {
    if (!user?.id || user.isAnonymous || user.id.startsWith('guest_')) return;
    try {
      const res = await fetch('/api/history', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setHistoryChecks(data.checks || []);
      // Document checks are re-measured server-side from the stored resume, so
      // the Intelligence tab still shows real numbers after a reload.
      if (!documentReport && data.documentChecks) setDocumentReport(data.documentChecks);
      // Same for the preview text: a reload must not blank the highlighter.
      if (data.latestResume?.parsedText) setSourceResumeText(data.latestResume.parsedText);
    } catch {
      // History is supplementary; a failure here must not block the workspace.
    }
  };

  const fetchTrackedJobs = async () => {
    if (!user?.id || user.isAnonymous || user.id.startsWith('guest_')) return;
    setTrackerLoading(true);
    setTrackerError(null);
    try {
      const res = await fetch('/api/applications', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrackerError(data?.error || `Could not load your applications (HTTP ${res.status}).`);
        return;
      }
      const applications: ApplicationRecord[] = Array.isArray(data.applications) ? data.applications : [];
      setTrackedJobs(
        applications.map((record) => ({
          id: record.id,
          company: record.company,
          role: record.role,
          matchScore: typeof record.matchScore === 'number' ? record.matchScore : null,
          status: (STATUS_LABEL as Record<string, TrackedStatus>)[record.status]
            ? record.status
            : 'SAVED',
          appliedDate: record.appliedDate,
          notes: record.notes || '',
        }))
      );
    } catch {
      setTrackerError('Could not reach ResumeSetu to load your applications. Check your connection and retry.');
    } finally {
      setTrackerLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('File size must be under 5MB.');
        return;
      }
      setResumeFile(file);
      setSampleType('');
      setErrorMessage(null);
    }
  };

  const handleSelectSampleResume = (type: string) => {
    setSampleType(type);
    setResumeFile(null);
    setErrorMessage(null);
  };

  const handleSelectPresetJob = (preset: (typeof PRESET_JOB_DESCRIPTIONS)[0]) => {
    setJobDescription(preset.text);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Duplicate-submission guard: the button is disabled while loading, but a
    // second Enter press or an impatient double-tap must not start a second scan.
    if (loading) return;
    if (!user?.id || user.isAnonymous || user.id.startsWith('guest_')) {
      setErrorMessage('Your account is not connected yet. Please sign in again before scanning.');
      return;
    }
    if (!jobDescription.trim()) {
      setErrorMessage('Please paste or select a target job description.');
      return;
    }
    if (!resumeFile && !sampleType) {
      setErrorMessage('Please upload your resume file or pick a sample candidate.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setCurrentCheck(null);
    setAnalysis(null);
    setSourceResumeText('');
    setTailoredData(null);
    setGrounding(null);
    setStarSuggestions([]);
    setEditedResume('');
    setEditedCoverLetter('');
    setIsEditingResume(false);
    setIsEditingCover(false);
    setShowRawAnalysis(false);
    setMobileWorkspaceTab('results');

    try {
      const formData = new FormData();
      formData.append('job_description', jobDescription);
      if (resumeFile) {
        formData.append('resume', resumeFile);
      } else if (sampleType) {
        formData.append('sample_type', sampleType);
      }

      const res = await fetch('/api/check', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402 || res.status === 403 || data.paywall_required || data.paywall) {
          onOpenPaywall();
          throw new Error(data.error || 'Free limit reached. Please upgrade to Pro.');
        }
        // 422 means the engine could not produce an honest score (empty resume,
        // empty JD, or a JD with no recognizable keywords). No scan row and no
        // quota were consumed.
        if (res.status === 422) {
          setErrorMessage(data.error || 'This job description could not be scored.');
          return;
        }
        throw new Error(data.error || `Failed to process resume check (HTTP ${res.status}).`);
      }

      setCurrentCheck(data.check);
      setAnalysis(data.analysis ?? null);
      setSourceResumeText(typeof data.resume_text === 'string' ? data.resume_text : '');
      setDocumentReport(data.documentChecks ?? null);
      setStarSuggestions(
        Array.isArray(data.analysis?.starSuggestions)
          ? data.analysis.starSuggestions
          : Array.isArray(data.analysis?.star_suggestions)
          ? data.analysis.star_suggestions
          : []
      );
      if (data.tailored) {
        setTailoredData(data.tailored);
        setEditedResume(data.tailored.tailored_resume_text || '');
        setEditedCoverLetter(data.tailored.cover_letter_text || '');
      }

      // Record the scan in the tracker as a real database row in SAVED state.
      // The gap count comes from THIS response, not from render-time state —
      // `missingKeywordCount` still describes the previous scan here.
      if (data.check) {
        await saveTrackedJob({
          company: data.check.company || 'Target Organization',
          role: data.check.job_title || 'Target Role',
          matchScore: data.check.match_score,
          notes: `${data.check.missing_keywords?.length ?? 0} keyword gap(s) identified in the ATS scan.`,
        });
      }

      await refreshUser();
      void fetchHistory();

      if (scrollTimerRef.current !== undefined) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      setMobileWorkspaceTab('input');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTailored = async () => {
    if (!currentCheck) return;
    if (!isPro) {
      onOpenPaywall();
      return;
    }
    if (tailorLoading) return;

    setTailorLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_id: currentCheck.id }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402 || res.status === 403) {
          onOpenPaywall();
          throw new Error('Pro membership required to tailor resumes.');
        }
        if (res.status === 409 && data.in_progress) {
          throw new Error(data.error || 'A tailored version of this scan is already being generated. Please wait a moment and retry.');
        }
        throw new Error(data.error || `Failed to generate tailored application (HTTP ${res.status}).`);
      }

      setTailoredData(data.tailored);
      setGrounding(data.grounding ?? null);
      setEditedResume(data.tailored?.tailored_resume_text || '');
      setEditedCoverLetter(data.tailored?.cover_letter_text || '');
      setIsEditingResume(false);
      setIsEditingCover(false);
      setCurrentCheck((prev) =>
        prev
          ? {
              ...prev,
              tailored_resume_text: data.tailored?.tailored_resume_text,
              cover_letter_text: data.tailored?.cover_letter_text,
            }
          : null
      );
      setActiveTab('tailored');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to tailor resume.';
      setErrorMessage(message);
    } finally {
      setTailorLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!currentCheck) return;
    if (!isPro) {
      onOpenPaywall();
      return;
    }
    if (downloadingDocx) return;

    setDownloadingDocx(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/download-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_id: currentCheck.id,
          include_highlights: exportWithHighlights,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to generate Word document (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${
        currentCheck.job_title ? currentCheck.job_title.replace(/[^\w.-]+/g, '_') : 'Tailored'
      }_Resume.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error downloading Word document';
      setErrorMessage(message);
    } finally {
      setDownloadingDocx(false);
    }
  };

  /** Cover letters are prose, so the download is a plain text file. */
  const handleDownloadCoverLetter = () => {
    const text = coverLetterText;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentCheck?.job_title || 'Cover_Letter').replace(/[^\w.-]+/g, '_')}_Cover_Letter.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const copyToClipboard = async (text: string, type: 'resume' | 'cover') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable (insecure context / denied): tell the user rather
      // than showing a "Copied" confirmation that did not happen.
      setErrorMessage('Your browser blocked clipboard access. Select the text and copy it manually.');
      return;
    }
    if (type === 'resume') {
      setCopiedResume(true);
      window.setTimeout(() => setCopiedResume(false), 2000);
    } else {
      setCopiedCoverLetter(true);
      window.setTimeout(() => setCopiedCoverLetter(false), 2000);
    }
  };

  const copyBullet = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBulletIdx(idx);
      window.setTimeout(() => setCopiedBulletIdx(null), 2000);
    } catch {
      setErrorMessage('Your browser blocked clipboard access. Select the text and copy it manually.');
    }
  };

  /** Persists a tracker row, then refreshes the list from the server. */
  const saveTrackedJob = async (payload: {
    company: string;
    role: string;
    matchScore: number | null;
    notes: string;
    status?: TrackedStatus;
    appliedDate?: string;
  }) => {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Could not save the application (HTTP ${res.status}).`);
    }
    await fetchTrackedJobs();
  };

  const handleAddTrackedJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingNewJob) return;
    if (!newJobCompany.trim() || !newJobRole.trim()) {
      setTrackerError('Company and role are both required.');
      return;
    }
    setSavingNewJob(true);
    setTrackerError(null);
    try {
      // No match score is invented for a manually added role: the row is stored
      // without one and the UI renders "—" instead of a fabricated percentage.
      await saveTrackedJob({
        company: newJobCompany.trim(),
        role: newJobRole.trim(),
        matchScore: null,
        notes: newJobNotes.trim(),
        status: newJobStatus,
      });
      setNewJobCompany('');
      setNewJobRole('');
      setNewJobNotes('');
      setNewJobStatus('SAVED');
      setShowAddJobModal(false);
    } catch (err: unknown) {
      setTrackerError(err instanceof Error ? err.message : 'Could not save the application.');
    } finally {
      setSavingNewJob(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: TrackedStatus) => {
    if (pendingStatusId) return;
    setPendingStatusId(id);
    setTrackerError(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Could not update that application (HTTP ${res.status}).`);
      }
      setTrackedJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status } : job)));
    } catch (err: unknown) {
      setTrackerError(err instanceof Error ? err.message : 'Could not update that application.');
      void fetchTrackedJobs();
    } finally {
      setPendingStatusId(null);
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Could not save the note.');
      setTrackedJobs((prev) => prev.map((job) => (job.id === id ? { ...job, notes } : job)));
    } catch {
      setTrackerError('Could not save that note. Your text is still on screen — retry in a moment.');
    }
  };

  const handleDeleteTrackedJob = async (id: string) => {
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data?.error || 'Could not delete that application.');
      }
      setTrackedJobs((prev) => prev.filter((job) => job.id !== id));
    } catch (err: unknown) {
      setTrackerError(err instanceof Error ? err.message : 'Could not delete that application.');
    }
  };

  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 overflow-x-hidden min-w-0">
      {/* Workspace Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-wash/80 border border-blue-pale/60 shadow-2xs mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
              Your job search workspace
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B2545] tracking-tight font-['Space_Grotesk'] break-words">
            {firstName ? `Welcome back, ${firstName}` : 'Your resume workspace'}
          </h1>
          <p className="text-xs sm:text-sm text-[#334E68] mt-1">
            Compare your resume with a role, shape a draft, and keep your applications organized.
          </p>
        </div>

        {historyChecks.length > 0 && (
          <span className="text-xs font-semibold text-[#627D98] hidden md:inline-block shrink-0">
            {historyChecks.length} checks logged
          </span>
        )}
      </div>

      {/* Primary Workspace Navigation Tabs (Smooth Horizontal Swipe Container) */}
      <nav aria-label="Workspace sections" className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel !bg-white/70 backdrop-blur-xl border border-white/80 shadow-xs mb-8 flex-nowrap overflow-x-auto scrollbar-none overscroll-x-contain touch-pan-x w-full max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('calibration')}
          aria-current={activeTab === 'calibration' ? 'page' : undefined}
          className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap shrink-0 ${
            activeTab === 'calibration'
              ? 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-md'
              : 'text-[#334E68] hover:text-[#0B2545] hover:bg-white/50'
          }`}
        >
          <Target className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Resume match</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tailored')}
          aria-current={activeTab === 'tailored' ? 'page' : undefined}
          className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap shrink-0 ${
            activeTab === 'tailored'
              ? 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-md'
              : 'text-[#334E68] hover:text-[#0B2545] hover:bg-white/50'
          }`}
        >
          <PenLine className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Resume draft</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cover')}
          aria-current={activeTab === 'cover' ? 'page' : undefined}
          className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap shrink-0 ${
            activeTab === 'cover'
              ? 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-md'
              : 'text-[#334E68] hover:text-[#0B2545] hover:bg-white/50'
          }`}
        >
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Cover letter</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracker')}
          aria-current={activeTab === 'tracker' ? 'page' : undefined}
          className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap shrink-0 ${
            activeTab === 'tracker'
              ? 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-md'
              : 'text-[#334E68] hover:text-[#0B2545] hover:bg-white/50'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Applications <span className="ml-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{trackedJobs.length}</span></span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('intelligence')}
          aria-current={activeTab === 'intelligence' ? 'page' : undefined}
          className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap shrink-0 ${
            activeTab === 'intelligence'
              ? 'bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-md'
              : 'text-[#334E68] hover:text-[#0B2545] hover:bg-white/50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Insights</span>
        </button>
      </nav>

      {/* =========================================================================
          TAB 1: ATS CALIBRATION
         ========================================================================= */}
      {activeTab === 'calibration' && (
        <div className="space-y-6">
          {/* Mobile view switcher */}
          {(currentCheck || loading) && (
            <div className="lg:hidden flex p-1.5 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xs text-xs font-bold">
              <button
                type="button"
                onClick={() => setMobileWorkspaceTab('input')}
                className={`flex-1 py-2 rounded-xl text-center transition-all ${
                  mobileWorkspaceTab === 'input'
                    ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-xs'
                    : 'text-[#334E68]'
                }`}
              >
                1. Input Data
              </button>
              <button
                type="button"
                onClick={() => setMobileWorkspaceTab('results')}
                className={`flex-1 py-2 rounded-xl text-center transition-all ${
                  mobileWorkspaceTab === 'results'
                    ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white shadow-xs'
                    : 'text-[#334E68]'
                }`}
              >
                2. Audit Results
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full min-w-0">
            {/* LEFT COLUMN: WORKSPACE FORM */}
            <div
              className={`lg:col-span-6 space-y-6 w-full min-w-0 ${
                mobileWorkspaceTab === 'results' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Job Description Textarea */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="jd-textarea"
                        className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5 uppercase tracking-wider"
                      >
                        <Target className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        <span>Target Job Description</span>
                      </label>
                      <span className="text-[11px] font-semibold text-[#1D4ED8]">Required</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className="text-[11px] text-[#627D98] self-center mr-1 font-medium">
                        Quick preset:
                      </span>
                      {PRESET_JOB_DESCRIPTIONS.map((preset) => (
                        <button
                          key={preset.title}
                          type="button"
                          onClick={() => handleSelectPresetJob(preset)}
                          className="text-xs px-3 py-1 rounded-full border border-line bg-white hover:bg-canvas text-[#334E68] transition-all cursor-pointer shadow-2xs font-medium"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>

                    <textarea
                      id="jd-textarea"
                      rows={6}
                      required
                      placeholder="Paste the target job description or requirements here..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-line/90 bg-canvas/70 focus:bg-white text-[#0B2545] text-xs font-mono focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 placeholder:text-[#8DA9C4] transition-all leading-relaxed"
                    />
                  </div>

                  {/* Resume Document Upload & Sample Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5 uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        <span>Resume Document (PDF or DOCX)</span>
                      </label>
                      <span className="text-[11px] text-[#627D98] font-medium">Max 5MB</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className="text-[11px] text-[#627D98] self-center mr-1 font-medium">
                        Or pick sample:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectSampleResume('software_engineer')}
                        className={`text-xs px-3 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                          sampleType === 'software_engineer'
                            ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white border-transparent shadow-xs'
                            : 'bg-white hover:bg-canvas text-[#334E68] border-line shadow-2xs'
                        }`}
                      >
                        Software Engineer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectSampleResume('product_manager')}
                        className={`text-xs px-3 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                          sampleType === 'product_manager'
                            ? 'bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white border-transparent shadow-xs'
                            : 'bg-white hover:bg-canvas text-[#334E68] border-line shadow-2xs'
                        }`}
                      >
                        Product Manager
                      </button>
                    </div>

                    {/* Drag and Drop Dropzone */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Upload resume document. Activate to browse for a PDF or DOCX file, or drag and drop a file into this area."
                      aria-busy={loading}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
                        // Space would otherwise scroll the page while the file picker opens.
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          if (file.size > 5 * 1024 * 1024) {
                            setErrorMessage('File size must be under 5MB.');
                            return;
                          }
                          setResumeFile(file);
                          setSampleType('');
                          setErrorMessage(null);
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]/50 ${
                        isDragging
                          ? 'border-[#1D4ED8] bg-blue-wash/50'
                          : resumeFile || sampleType
                          ? 'border-[#1D4ED8] bg-blue-wash/30'
                          : 'border-line hover:border-[#1D4ED8]/60 bg-canvas/50 hover:bg-blue-wash/20'
                      }`}
                    >
                      {/* sr-only (not display:none) keeps the input reachable by keyboard and screen readers */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileChange}
                        aria-label="Resume file"
                        className="sr-only"
                      />

                      {resumeFile ? (
                        <div className="flex items-center justify-center gap-2 text-[#0B2545] text-xs font-bold">
                          <Check className="w-4 h-4 text-[#1D4ED8]" strokeWidth={2.5} />
                          <span className="truncate max-w-xs">{resumeFile.name}</span>
                          <span className="text-[#627D98]">
                            ({(resumeFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ) : sampleType ? (
                        <div className="flex items-center justify-center gap-2 text-[#1D4ED8] text-xs font-bold">
                          <Check className="w-4 h-4 text-[#1D4ED8]" strokeWidth={2.5} />
                          <span>Sample loaded: {sampleType.replace('_', ' ')}</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="w-10 h-10 rounded-2xl bg-blue-wash flex items-center justify-center mx-auto mb-2 text-[#1D4ED8]">
                            <FileText className="w-5 h-5 text-[#1D4ED8]" strokeWidth={2} />
                          </div>
                          <p className="text-xs font-bold text-[#0B2545]">
                            {isDragging ? 'Drop resume file here' : 'Click to browse or drag & drop PDF/DOCX'}
                          </p>
                          <p className="text-[11px] text-[#627D98]">
                            Text is extracted from PDF/DOCX; image-only scans may need OCR first.
                          </p>
                        </div>
                      )}
                    </div>

                    <p className="mt-2.5 text-xs text-[#627D98] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-mid shrink-0" />
                      <span>
                        Your resume is stored encrypted in your own vault and never shared or sold. You
                        can delete it at any time.
                      </span>
                    </p>
                  </div>

                  {/* Error Banner */}
                  {errorMessage && (
                    <div className="p-4 rounded-2xl border border-danger-border bg-danger-soft text-xs text-danger flex items-start gap-2.5 shadow-2xs">
                      <X className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
                      <span className="flex-1 font-medium">{errorMessage}</span>
                      <button
                        type="button"
                        onClick={() => setErrorMessage(null)}
                        className="text-danger hover:opacity-75 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Bottom Primary Action Button (Single Main Trigger) */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-5 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-[0_8px_20px_rgba(29,78,216,0.35)]"
                  >
                    {loading ? (
                      <span>Evaluating resume against job description...</span>
                    ) : (
                      <>
                        <span>Scan Resume Compatibility</span>
                        <ArrowRight className="w-4 h-4 text-white" strokeWidth={2} />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Single Clean Upgrade Banner at Bottom of Workspace Card */}
              {!isPro && (
                <div className="p-4 sm:p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-blue-pale/80 shadow-[0_8px_24px_rgba(29,78,216,0.06)] flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      <span>Unlock Unlimited ATS Tailoring</span>
                    </span>
                    <p className="text-[11px] text-[#334E68]">
                      Free plan includes {user?.scanLimit ?? FREE_SCAN_LIMIT} scans per month. Pro adds unlimited tailored
                      Word (.docx) downloads & cover letters for ₹{proPriceInr}/month.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenPaywall}
                    className="py-2.5 px-4 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
                  >
                    Upgrade ₹{proPriceInr}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: CALIBRATION AUDIT RESULTS */}
            <div
              ref={resultsRef}
              className={`lg:col-span-6 space-y-6 w-full min-w-0 ${
                mobileWorkspaceTab === 'input' ? 'hidden lg:block' : 'block'
              }`}
            >
              {!currentCheck && !loading && (
                <div className="p-6 sm:p-10 text-center rounded-2xl bg-white/60 backdrop-blur-2xl border border-dashed border-line/90 shadow-[0_12px_32px_rgba(11,37,69,0.04)]">
                  <div className="w-12 h-12 rounded-2xl bg-blue-wash text-[#1D4ED8] flex items-center justify-center mx-auto mb-3 border border-blue-pale/60">
                    <Target className="w-6 h-6 text-[#1D4ED8]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                    Awaiting Candidate Profile
                  </h3>
                  <p className="text-xs sm:text-sm text-[#334E68] max-w-sm mx-auto mt-1.5 leading-relaxed">
                    Paste a job description on the left and upload your resume to evaluate keyword alignment, gap diagnostics, and match percentage.
                  </p>
                </div>
              )}

              {loading && (
                <div className="p-6 sm:p-10 text-center rounded-2xl bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)]">
                  <div className="w-10 h-10 rounded-full border-3 border-[#1D4ED8] border-t-transparent animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                    Calibrating resume against ATS rubrics...
                  </h3>
                  <p className="text-xs sm:text-sm text-[#334E68] mt-1.5 max-w-sm mx-auto">
                    Tokenizing your resume, matching it against the job description's required
                    keywords, and flagging the terms you are missing.
                  </p>
                </div>
              )}

              {currentCheck && (
                <div className="space-y-6">
                  {/* SCORE GAUGE & CRISP METRIC PILLS */}
                  <div className="p-4 sm:p-6 rounded-2xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface">
                      <div className="min-w-0">
                        {/* Status Tag & Metric Pill */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              keywordCoveragePercent >= 75
                                ? 'bg-blue-wash text-blue-core border border-blue-pale'
                                : 'bg-warning-soft text-warning border border-warning-border'
                            }`}
                          >
                            {keywordCoveragePercent >= 75
                              ? 'High Keyword Coverage'
                              : 'More Keywords To Review'}
                          </span>
                          <span className="text-[11px] font-semibold text-[#627D98] bg-surface px-2 py-0.5 rounded-full">
                            Blended ATS score
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-extrabold text-[#0B2545] font-['Space_Grotesk'] break-words">
                          {currentCheck.job_title || 'Role Match'}
                        </h3>
                        {currentCheck.company && (
                          <p className="text-xs text-[#627D98] font-medium mt-0.5">
                            Target: {currentCheck.company}
                          </p>
                        )}
                      </div>

                      <div className="self-center sm:self-auto shrink-0">
                        <ScoreGauge score={overallScore} size={110} />
                      </div>
                    </div>

                    {/*
                      The three numbers are shown separately and explicitly.

                      Previously one bar labelled "Tracked Keyword Match" rendered
                      the blended score while the counts underneath came from
                      `strengths.length` (a count of generated sentences), which
                      produced contradictory figures such as "86% match" next to
                      "2 of 7 keywords". These three lines cannot disagree because
                      each has its own definition and its own denominator.
                    */}
                    <div className="space-y-3">
                      <ScoreBar
                        label="Overall ATS score"
                        hint="Blended: 55% keyword coverage + 45% semantic proximity. Not a recruiter judgement."
                        value={overallScore}
                      />
                      <ScoreBar
                        label="Keyword coverage"
                        hint={`${matchedKeywordCount} of ${requiredKeywordCount} required keywords found in your resume.`}
                        value={keywordCoveragePercent}
                        tone="blue"
                      />
                      <ScoreBar
                        label="Semantic proximity"
                        hint="Vocabulary overlap between your resume and the job description. Estimates similarity, not interview fit."
                        value={semanticMatchPercent}
                        tone="steel"
                        estimated
                      />
                    </div>

                    {/* Score clarity: what each component measures and what moves it */}
                    {analysis && (
                      <ScoreExplainer
                        scoreBreakdown={analysis.scoreBreakdown}
                        matchedCount={analysis.matchedCount}
                        requiredCount={analysis.requiredCount}
                        missingCount={analysis.missingCount}
                        inputQuality={analysis.inputQuality}
                      />
                    )}

                    {/* Alignment Summary Callout */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545] mb-2">
                        Alignment Summary
                      </h4>
                      <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed bg-canvas/80 p-4 rounded-2xl border border-line/80">
                        {currentCheck.summary}
                      </p>
                    </div>

                    {/* COMPACT METRIC PILLS BAR — every value is engine-derived */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1">
                      <div className="p-2.5 rounded-xl bg-canvas/90 border border-line/80 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                          Keyword coverage
                        </span>
                        <span className="text-sm font-extrabold text-[#0B2545]">
                          {matchedKeywordCount}/{requiredKeywordCount}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-canvas/90 border border-line/80 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                          Skill delta
                        </span>
                        <span className="text-sm font-extrabold text-[#0B2545]">
                          {analysis ? `${analysis.skillsMatched.length} matched / ${analysis.skillsMissing.length} missing` : '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-canvas/90 border border-line/80 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                          ATS parser test
                        </span>
                        <span className="text-sm font-extrabold text-[#627D98]">Not tested</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-canvas/90 border border-line/80 text-center">
                        <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                          Word export
                        </span>
                        <span className="text-sm font-extrabold text-[#1D4ED8]">Single-column .docx</span>
                      </div>
                    </div>

                    {/* Raw structured payload, highlighted and copyable */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowRawAnalysis((prev) => !prev)}
                        aria-expanded={showRawAnalysis}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8] hover:text-[#1E40AF]"
                      >
                        <span>{showRawAnalysis ? 'Hide' : 'Show'} raw analysis JSON</span>
                        <ArrowRight className={`h-3 w-3 transition-transform ${showRawAnalysis ? 'rotate-90' : ''}`} />
                      </button>
                      {showRawAnalysis && analysis && (
                        <div className="mt-2.5">
                          <CodeBlock
                            label="ats-analysis.json"
                            language="json"
                            code={JSON.stringify(
                              {
                                matchScore: analysis.matchScore,
                                scoreBreakdown: analysis.scoreBreakdown,
                                matchedCount: analysis.matchedCount,
                                missingCount: analysis.missingCount,
                                requiredCount: analysis.requiredCount,
                                keywordsMatched: analysis.keywordsMatched,
                                keywordsMissing: analysis.keywordsMissing,
                                skillsMatched: analysis.skillsMatched,
                                skillsMissing: analysis.skillsMissing,
                                inputQuality: analysis.inputQuality,
                                documentChecks: documentReport?.checks ?? null,
                              },
                              null,
                              2
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* COLOR-CODED SKILL DELTA: Matched vs Missing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Matched Keywords */}
                      <div className="p-3.5 rounded-2xl bg-blue-wash/50 border border-blue-pale/70 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-deep flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-mid" strokeWidth={2.5} />
                            <span>Matched keywords ({matchedKeywordCount})</span>
                          </span>
                          <span className="text-[10px] font-semibold text-blue-core text-right">
                            Found in your resume
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {matchedKeywordCount > 0 ? (
                            (analysis?.keywordsMatched ?? []).map((keyword) => (
                              <span
                                key={keyword}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-blue-deep border border-blue-pale shadow-2xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-bright" />
                                <span className="break-words">{keyword}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-blue-deep italic">
                              No required keywords from this job description were found in your resume.
                            </span>
                          )}
                        </div>
                        {analysis && analysis.skillsMatched.length > 0 && (
                          <p className="text-[11px] text-blue-deep">
                            Tools and technologies matched: {analysis.skillsMatched.join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Missing Keyword Gaps */}
                      <div className="p-3.5 rounded-2xl bg-danger-soft/50 border border-danger-border/70 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-danger-strong flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-danger" />
                            <span>Missing keyword gaps ({missingKeywordCount})</span>
                          </span>
                          <span className="text-[10px] font-semibold text-danger text-right">Gaps, not claims</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {missingKeywordCount > 0 ? (
                            (analysis?.keywordsMissing ?? currentCheck.missing_keywords).map((keyword) => (
                              <span
                                key={keyword}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-danger-strong border border-danger-border shadow-2xs"
                              >
                                <span className="text-danger font-bold">+</span>
                                <span className="break-words">{keyword}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-danger-strong italic">
                              No required keywords from this posting are missing.
                            </span>
                          )}
                        </div>
                        {missingKeywordCount > (analysis?.keywordsMissing.length ?? 0) && (
                          <p className="text-[11px] text-danger-strong">
                            Showing the {analysis?.keywordsMissing.length} highest-priority gaps of {missingKeywordCount} total.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* HIGHLIGHTED RESUME PREVIEW — presentation only */}
                    <ResumeHighlightPreview
                      resumeText={sourceResumeText}
                      matchedKeywords={analysis?.keywordsMatched ?? []}
                      missingKeywords={analysis?.keywordsMissing ?? currentCheck.missing_keywords}
                      jobTitle={currentCheck.job_title}
                    />

                    {/* INTERACTIVE STAR BULLET REWRITER CARD */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-wash/80 via-blue-wash/60 to-blue-wash/80 border border-blue-pale/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#1D4ED8]" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                            Interactive STAR Bullet Rewriter
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#1D4ED8] border border-blue-pale shadow-2xs">
                            STAR framework
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (isPro) {
                              if (!tailoredData) handleGenerateTailored();
                              setActiveTab('tailored');
                            } else {
                              onOpenPaywall();
                            }
                          }}
                          className="text-[11px] font-bold text-[#1D4ED8] hover:text-[#1E40AF] flex items-center gap-1 cursor-pointer"
                        >
                          <span>Full Tailored Resume</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {starSuggestions.length === 0 ? (
                          <p className="text-xs text-[#334E68] italic bg-white/70 border border-blue-wash rounded-xl p-3.5">
                            No keyword gaps were found for this scan, so there is nothing to close.
                            If you still want sharper bullets, open the Tailored Resume tab.
                          </p>
                        ) : (
                          starSuggestions.map((item, idx) => (
                            <div key={idx} className="bg-white/95 p-3.5 rounded-xl border border-blue-wash shadow-2xs space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-[#627D98] flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-line-steel" />
                                  <span>Existing Bullet</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                                  Gap keyword: {item.keyword}
                                </span>
                              </div>
                              <p className="text-xs text-[#627D98] italic pl-2.5 border-l-2 border-line">
                                {item.original}
                              </p>

                              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-surface">
                                <span className="font-bold text-[#1D4ED8] flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-mid" />
                                  <span>How to write it yourself</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyBullet(item.suggestion, idx)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#0B2545] bg-canvas hover:bg-surface border border-line transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedBulletIdx === idx ? (
                                    <>
                                      <CheckCheck className="w-3 h-3 text-blue-mid" />
                                      <span className="text-blue-core">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-[#627D98]" />
                                      <span>Copy Guidance</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-xs text-[#0B2545] font-medium pl-2.5 border-l-2 border-[#1D4ED8] leading-relaxed">
                                {item.suggestion}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Quick Link to Tailored Resume Tab */}
                    <div className="pt-2 border-t border-surface flex items-center justify-between">
                      <span className="text-xs text-[#627D98]">
                        Ready to incorporate missing keywords?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isPro) {
                            if (!tailoredData) {
                              handleGenerateTailored();
                            } else {
                              setActiveTab('tailored');
                            }
                          } else {
                            onOpenPaywall();
                          }
                        }}
                        className="text-xs font-bold text-[#1D4ED8] hover:text-[#1E40AF] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Tailored Resume</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TAILORED RESUME (STAR BULLET REWRITER)
         ========================================================================= */}
      {activeTab === 'tailored' && (
        <div className="space-y-6">
          {!currentCheck ? (
            <div className="p-8 sm:p-14 text-center rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] max-w-xl mx-auto">
              <PenLine className="w-10 h-10 text-[#8DA9C4] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                No Resume Evaluated Yet
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] mt-1 mb-5">
                Run an ATS calibration in the first tab to generate tailored STAR bullet points for your target job.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('calibration')}
                className="px-6 py-2.5 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md cursor-pointer"
              >
                Go to ATS Calibration
              </button>
            </div>
          ) : !isPro ? (
            /* Pro Upgrade Feature Card */
            <div className="p-8 sm:p-12 rounded-3xl bg-white/70 backdrop-blur-2xl border border-blue-pale/80 shadow-[0_12px_32px_rgba(29,78,216,0.08)] max-w-2xl mx-auto space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-wash text-[#1D4ED8] flex items-center justify-center mx-auto mb-2 border border-blue-pale/60 shadow-2xs">
                <Sparkles className="w-6 h-6 text-[#1D4ED8]" />
              </div>
              <h3 className="text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                Unlock Tailored Resume for {currentCheck.job_title || 'Your Target Role'}
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed max-w-lg mx-auto">
                ResumeSetu Pro suggests role-specific edits based on your experience and creates an editable single-column Word (.docx) draft. Review every suggestion before using it.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenPaywall}
                  className="py-3.5 px-7 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] transition-all cursor-pointer shadow-[0_8px_20px_rgba(29,78,216,0.35)] inline-flex items-center gap-2"
                >
                  <span>Unlock Tailored Word Document — ₹{proPriceInr}/mo</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            /* Tailored Content Active View */
            <div className="space-y-6">
              {!tailoredData ? (
                <div className="p-8 sm:p-12 rounded-3xl text-center bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] max-w-xl mx-auto space-y-4">
                  <PenLine className="w-10 h-10 text-[#1D4ED8] mx-auto" />
                  <h3 className="text-xl font-bold text-[#0B2545] font-['Space_Grotesk']">
                    Generate Tailored Resume Copy
                  </h3>
                  <p className="text-xs sm:text-sm text-[#334E68] max-w-md mx-auto">
                    Transform your experience bullets to incorporate missing tokens and align directly with recruiter rubrics.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateTailored}
                    disabled={tailorLoading}
                    className="py-3 px-6 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    {tailorLoading ? (
                      <span>Tailoring resume bullets...</span>
                    ) : (
                      <>
                        <span>Generate Tailored Resume</span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="glass-panel p-6 sm:p-8 rounded-3xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] space-y-5">
                  {/* Action Toolbar with Metric Pills & Single-line Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                          Grounded rewrite
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface text-[#334E68] border border-line">
                          Source scan {keywordCoveragePercent}% keyword coverage
                        </span>
                        {tailoredData?.synthetic && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-warning-soft text-warning border border-warning-border">
                            Local fallback — no model ran
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-[#0B2545]">
                        Tailored Resume Text
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingResume((prev) => !prev)}
                        aria-pressed={isEditingResume}
                        disabled={!resumeText}
                        className="px-3 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-bold text-[#0B2545] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        <span>{isEditingResume ? 'Done editing' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(resumeText, 'resume')}
                        disabled={!resumeText}
                        className="px-3.5 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-bold text-[#0B2545] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {copiedResume ? <CheckCheck className="w-3.5 h-3.5 text-blue-mid" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedResume ? 'Copied' : 'Copy Text'}</span>
                      </button>

                      <label
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#334E68] cursor-pointer select-none px-2.5 py-2 rounded-xl border border-line bg-white/80 hover:bg-canvas transition-colors"
                        title="Shade the same phrases the preview highlights. The wording of the document does not change."
                      >
                        <input
                          type="checkbox"
                          checked={exportWithHighlights}
                          onChange={(event) => setExportWithHighlights(event.target.checked)}
                          className="w-3.5 h-3.5 accent-[#1D4ED8] cursor-pointer"
                        />
                        <span>Mark matches in Word file</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleDownloadDocx}
                        disabled={downloadingDocx || !currentCheck.tailored_resume_text}
                        className="px-4 py-2 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-white shrink-0" />
                        <span>{downloadingDocx ? 'Generating…' : 'Word (.docx)'}</span>
                      </button>
                    </div>
                  </div>

                  {!currentCheck.tailored_resume_text && (
                    <p className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-xs text-warning">
                      Nothing has been generated for this scan yet, so there is no Word file to
                      download. ResumeSetu will not build one out of your missing keywords.
                    </p>
                  )}

                  {grounding && <GroundingPanel grounding={grounding} />}

                  {tailoredData?.synthetic && (
                    <p className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-xs text-warning">
                      No AI provider responded, so your original resume text is shown unchanged
                      plus a checklist. Nothing was rewritten and no content was invented.
                    </p>
                  )}

                  {isEditingResume ? (
                    <div className="space-y-2">
                      <label htmlFor="tailored-resume-editor" className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                        Editable draft — changes stay in this browser until you copy or download
                      </label>
                      <textarea
                        id="tailored-resume-editor"
                        value={editedResume}
                        onChange={(event) => setEditedResume(event.target.value)}
                        rows={18}
                        className="w-full p-4 rounded-2xl border border-line bg-canvas/70 focus:bg-white font-mono text-xs text-[#0B2545] leading-relaxed focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20"
                      />
                    </div>
                  ) : (
                    <pre className="text-xs font-mono text-[#0B2545] bg-canvas/70 p-5 rounded-2xl border border-line/80 max-h-[500px] overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words max-w-full leading-relaxed">
                      {resumeText}
                    </pre>
                  )}

                  {Array.isArray(tailoredData?.key_changes_made) && tailoredData.key_changes_made.length > 0 && (
                    <div className="rounded-2xl border border-line bg-canvas/70 p-4 space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                        What actually changed
                      </h4>
                      <ul className="space-y-1.5">
                        {tailoredData.key_changes_made.map((change, index) => (
                          <li key={index} className="text-xs text-[#334E68] flex gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-mid shrink-0 mt-0.5" />
                            <span className="break-words">{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: COVER LETTER GENERATOR
         ========================================================================= */}
      {activeTab === 'cover' && (
        <div className="space-y-6">
          {!currentCheck ? (
            <div className="p-6 sm:p-10 text-center rounded-2xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] max-w-xl mx-auto">
              <Mail className="w-10 h-10 text-[#8DA9C4] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                No Application Selected
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] mt-1 mb-5">
                Run an initial ATS calibration in the first tab to generate a targeted cover letter matching this role.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('calibration')}
                className="px-6 py-2.5 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md cursor-pointer"
              >
                Start with ATS Calibration
              </button>
            </div>
          ) : !isPro ? (
            <div className="p-5 sm:p-8 rounded-2xl bg-white/70 backdrop-blur-2xl border border-blue-pale/80 shadow-[0_12px_32px_rgba(29,78,216,0.08)] max-w-2xl mx-auto space-y-4 text-center">
              <Mail className="w-10 h-10 text-[#1D4ED8] mx-auto mb-2" />
              <h3 className="text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                Role-Specific Cover Letter Generator
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed max-w-md mx-auto">
                Craft a tailored, non-generic cover letter that highlights your exact qualification match for {currentCheck.company || 'the hiring team'}.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenPaywall}
                  className="py-3.5 px-7 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
                >
                  <span>Unlock Custom Cover Letters — ₹{proPriceInr}/mo</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                      Role-Specific Narrative
                    </span>
                    {tailoredData ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface text-[#334E68] border border-line">
                        {tailoredData.cover_letter_synthetic ?? tailoredData.synthetic
                          ? 'Local outline — no model ran'
                          : 'AI-generated draft'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface text-[#627D98] border border-line">
                        Not generated yet
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#0B2545] break-words">
                    Cover Letter for {currentCheck.job_title || 'Target Role'}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {tailoredData && (
                    <button
                      type="button"
                      onClick={() => setIsEditingCover((prev) => !prev)}
                      aria-pressed={isEditingCover}
                      disabled={!coverLetterText}
                      className="px-3 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-bold text-[#0B2545] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>{isEditingCover ? 'Done editing' : 'Edit'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!coverLetterText}
                    onClick={() => copyToClipboard(coverLetterText, 'cover')}
                    className="px-4 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-bold text-[#0B2545] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copiedCoverLetter ? <CheckCheck className="w-3.5 h-3.5 text-blue-mid" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCoverLetter ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!coverLetterText}
                    onClick={handleDownloadCoverLetter}
                    className="px-4 py-2 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>

              {!tailoredData ? (
                <div className="space-y-4">
                  <div className="text-xs sm:text-sm text-[#334E68] bg-canvas/70 p-5 rounded-2xl border border-line/80 leading-relaxed">
                    No cover letter has been generated for this role. ResumeSetu only shows a
                    letter once one has actually been written from your own resume — open the
                    Tailored Resume tab and generate it.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('tailored');
                      void handleGenerateTailored();
                    }}
                    disabled={tailorLoading}
                    className="py-3 px-6 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50 cursor-pointer shadow-md"
                  >
                    <span>{tailorLoading ? 'Generating…' : 'Generate resume & cover letter'}</span>
                  </button>
                </div>
              ) : !coverLetterText ? (
                <div className="text-xs sm:text-sm text-[#334E68] bg-canvas/70 p-5 rounded-2xl border border-line/80 leading-relaxed">
                  The resume was generated but no cover letter came back from the model, so there
                  is nothing to show. Retry the generation, or write it yourself using the keyword
                  gaps listed on the ATS Calibration tab.
                </div>
              ) : (
                <>
                  {tailoredData.cover_letter_synthetic ?? tailoredData.synthetic ? (
                    <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-xs text-warning">
                      This is a local outline, not an AI-written cover letter. Add only claims that
                      match your experience.
                    </p>
                  ) : null}
                  {grounding && <GroundingPanel grounding={grounding} only="coverLetter" />}
                  {isEditingCover ? (
                    <textarea
                      id="cover-letter-editor"
                      aria-label="Edit cover letter draft"
                      value={editedCoverLetter}
                      onChange={(event) => setEditedCoverLetter(event.target.value)}
                      rows={16}
                      className="w-full p-4 rounded-2xl border border-line bg-canvas/70 focus:bg-white text-xs text-[#0B2545] leading-relaxed focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20"
                    />
                  ) : (
                    <pre className="text-xs text-[#0B2545] bg-canvas/70 p-5 rounded-2xl border border-line/80 max-h-[450px] overflow-y-auto whitespace-pre-wrap break-words max-w-full leading-relaxed">
                      {coverLetterText}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: APPLICATION TRACKER (CRM)
         ========================================================================= */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold font-['Space_Grotesk'] text-[#0B2545]">
                Application Tracking CRM
              </h2>
              <p className="text-xs sm:text-sm text-[#334E68] mt-0.5">
                Saved on your ResumeSetu account, so these counts follow you across devices. Every
                scan you run is added here automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddJobModal(true)}
              className="px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] flex items-center gap-2 shadow-xs hover:shadow-md cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Track New Application</span>
            </button>
          </div>

          {/* Quick Metrics Bar — every count is derived from the loaded rows */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <TrackerMetric label="Total tracked" value={trackedJobs.length} />
            <TrackerMetric label="Applied" value={countByStatus('APPLIED')} tone="blue" />
            <TrackerMetric label="Interviews" value={countByStatus('INTERVIEW')} tone="purple" />
            <TrackerMetric
              label="Offers"
              value={countByStatus('OFFER')}
              tone="green"
              secondary={`${countByStatus('REJECTED')} rejected`}
            />
          </div>

          <p className="text-[11px] text-[#627D98] -mt-2">
            Average match across the {scoredApplications.length} tracked role
            {scoredApplications.length === 1 ? '' : 's'} that came from a real scan:{' '}
            <strong className="font-bold text-[#0B2545]">
              {averageApplicationScore === null ? 'not available' : `${averageApplicationScore}%`}
            </strong>
            . Manually added roles have no score and are excluded rather than guessed.
          </p>

          {trackerError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl border border-danger-border bg-danger-soft text-xs text-danger flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span className="flex-1 font-medium break-words">{trackerError}</span>
              <button
                type="button"
                onClick={() => void fetchTrackedJobs()}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-danger-border bg-white px-2.5 py-1 font-bold uppercase tracking-wider hover:bg-danger-soft cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Table Container & Mobile Stack Cards */}
          <div className="glass-panel rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] p-4 sm:p-6 overflow-hidden max-w-full space-y-4">
            {trackerLoading && trackedJobs.length === 0 ? (
              <div className="p-10 text-center space-y-3" aria-busy="true">
                <div className="w-9 h-9 rounded-full border-3 border-[#1D4ED8] border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-[#334E68]">Loading your applications…</p>
              </div>
            ) : trackedJobs.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-line/90 bg-canvas/50">
                <div className="w-12 h-12 rounded-2xl bg-blue-wash text-[#1D4ED8] flex items-center justify-center mx-auto mb-3 border border-blue-pale/60">
                  <Briefcase className="w-6 h-6 text-[#1D4ED8]" />
                </div>
                <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                  No Applications Tracked Yet
                </h3>
                <p className="text-xs sm:text-sm text-[#334E68] max-w-md mx-auto mt-1.5 leading-relaxed">
                  Nothing has been saved to your account yet. Every scan you run is added here
                  automatically, or add a role manually to record an application you made elsewhere.
                </p>
                <div className="pt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('calibration')}
                    className="px-5 py-2.5 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md cursor-pointer"
                  >
                    Run a Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddJobModal(true)}
                    className="px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider text-[#0B2545] bg-white hover:bg-canvas border border-line transition-all cursor-pointer shadow-2xs"
                  >
                    Add Manually
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile stack layout */}
                <div className="block md:hidden space-y-3">
                  {trackedJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 rounded-2xl bg-white/90 border border-line/80 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-[#0B2545] break-words leading-snug">
                            {job.role}
                          </h3>
                          <div className="text-xs text-[#627D98] flex items-center gap-1.5 mt-1 font-medium">
                            <Building className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                            <span className="break-words">{job.company}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shrink-0 bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                          {job.matchScore === null ? '—' : `${job.matchScore}%`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={job.status} />
                          <span className="text-[11px] text-[#627D98]">{job.appliedDate}</span>
                        </div>
                        <TrackerStatusSelect
                          job={job}
                          disabled={pendingStatusId === job.id}
                          onChange={handleUpdateStatus}
                        />
                      </div>

                      <TrackerNotes job={job} onSave={handleUpdateNotes} />
                      <TrackerDelete job={job} onDelete={handleDeleteTrackedJob} />
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto max-w-full">
                  <table className="w-full min-w-[760px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-line/80 bg-canvas/50 text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                        <th scope="col" className="py-3.5 px-5">
                          Role & Company
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          ATS score
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          Status
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          Date
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          Notes
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-muted text-xs">
                      {trackedJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-canvas/60 transition-colors align-top">
                          <td className="py-4 px-5 max-w-[240px]">
                            <div className="font-bold text-[#0B2545] break-words">{job.role}</div>
                            <div className="text-[#627D98] flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-[#1D4ED8] shrink-0" />
                              <span className="break-words">{job.company}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-['Space_Grotesk'] font-bold text-sm">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-wash text-[#1D4ED8] border border-blue-pale/80">
                              {job.matchScore === null ? '—' : `${job.matchScore}%`}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="py-4 px-4 text-[#627D98] whitespace-nowrap">{job.appliedDate}</td>
                          <td className="py-4 px-4 max-w-[260px]">
                            <TrackerNotes job={job} onSave={handleUpdateNotes} />
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <TrackerStatusSelect
                                job={job}
                                disabled={pendingStatusId === job.id}
                                onChange={handleUpdateStatus}
                              />
                              <TrackerDelete job={job} onDelete={handleDeleteTrackedJob} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Add Job Modal */}
          {showAddJobModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#0B2545]/50 backdrop-blur-sm">
              <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
                <div
                  ref={addJobModalRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-job-modal-title"
                  tabIndex={-1}
                  className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl border border-line space-y-4 text-left my-auto focus:outline-none"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-surface gap-3">
                    <h3 id="add-job-modal-title" className="text-base font-bold text-[#0B2545]">
                      Track Application
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddJobModal(false)}
                      aria-label="Close"
                      className="p-1 rounded-full text-[#627D98] hover:text-[#0B2545] cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleAddTrackedJob} className="space-y-4 text-xs">
                    <div>
                      <label htmlFor="new-job-company" className="font-bold text-[#0B2545] block mb-1">
                        Company name
                      </label>
                      <input
                        id="new-job-company"
                        required
                        placeholder="e.g. Google, Stripe, Zepto"
                        value={newJobCompany}
                        onChange={(e) => setNewJobCompany(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-line bg-canvas focus:bg-white text-[#0B2545]"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-job-role" className="font-bold text-[#0B2545] block mb-1">
                        Target role
                      </label>
                      <input
                        id="new-job-role"
                        required
                        placeholder="e.g. Senior Frontend Engineer"
                        value={newJobRole}
                        onChange={(e) => setNewJobRole(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-line bg-canvas focus:bg-white text-[#0B2545]"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-job-status" className="font-bold text-[#0B2545] block mb-1">
                        Current status
                      </label>
                      <select
                        id="new-job-status"
                        value={newJobStatus}
                        onChange={(e) => setNewJobStatus(e.target.value as TrackedStatus)}
                        className="w-full p-2.5 rounded-xl border border-line bg-canvas focus:bg-white font-medium text-[#0B2545]"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="new-job-notes" className="font-bold text-[#0B2545] block mb-1">
                        Notes
                      </label>
                      <textarea
                        id="new-job-notes"
                        rows={3}
                        placeholder="Recruiter name, referral source, follow-up date…"
                        value={newJobNotes}
                        onChange={(e) => setNewJobNotes(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-line bg-canvas focus:bg-white text-[#0B2545]"
                      />
                      <p className="mt-1.5 text-[11px] text-[#627D98]">
                        No ATS score is invented for this row — it stays blank until a real scan
                        supplies one.
                      </p>
                    </div>
                    {trackerError && (
                      <p role="alert" className="text-[11px] font-semibold text-danger break-words">
                        {trackerError}
                      </p>
                    )}
                    <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddJobModal(false)}
                        className="px-4 py-2.5 rounded-xl text-ink-soft hover:bg-surface font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingNewJob}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-white font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {savingNewJob && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>{savingNewJob ? 'Saving…' : 'Save Application'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* =========================================================================
          TAB 5: RESUME INTELLIGENCE & ATS AUDIT METRICS
         ========================================================================= */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-['Space_Grotesk'] text-[#0B2545]">
                Resume Intelligence & Deep Diagnostic
              </h2>
              <p className="text-xs sm:text-sm text-[#334E68] mt-0.5">
                Every figure below is computed from your own scan history. Diagnostics the engine does
                not yet measure are labelled instead of estimated.
              </p>
            </div>
          </div>

          {!currentCheck && historyChecks.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-white/60 backdrop-blur-2xl border border-dashed border-line/90 shadow-[0_12px_32px_rgba(11,37,69,0.04)]">
              <div className="w-12 h-12 rounded-2xl bg-blue-wash text-[#1D4ED8] flex items-center justify-center mx-auto mb-3 border border-blue-pale/60">
                <BarChart3 className="w-6 h-6 text-[#1D4ED8]" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                No Scan Data Yet
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] max-w-sm mx-auto mt-1.5 leading-relaxed">
                These diagnostics are calculated from real scans. Run an ATS Calibration to generate
                your first report.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('calibration')}
                className="mt-5 px-6 py-2.5 rounded-full text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md cursor-pointer"
              >
                Run a Scan
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scan record — every figure derived from /api/history */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-xs space-y-3 lg:col-span-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1D4ED8] uppercase tracking-wider">
                      Your Scan Record
                    </span>
                    <span className="text-xs font-bold text-[#0B2545] font-['Space_Grotesk']">
                      {historyChecks.length} scan{historyChecks.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-canvas/90 border border-line/80">
                      <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                        Scans performed
                      </span>
                      <span className="text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk'] block tabular-nums">
                        {historyChecks.length}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-canvas/90 border border-line/80">
                      <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                        Average blended score
                      </span>
                      <span className="text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk'] block tabular-nums">
                        {averageMatchScore === null ? 'Not available' : `${averageMatchScore}%`}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-canvas/90 border border-line/80">
                      <span className="text-[10px] uppercase font-bold text-[#627D98] block">
                        Best blended score
                      </span>
                      <span className="text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk'] block tabular-nums">
                        {bestMatchScore === null ? 'Not available' : `${bestMatchScore}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/*
                  These three diagnostics were previously rendered as invented
                  percentages ("OCR 92%", "Impact verb ratio 78%", "Quantified
                  metrics 85%") that no code computed. They are gone, replaced by
                  the measured Document Checks panel below. Writing-style and
                  per-role metric counting are genuinely out of scope for a keyword
                  matcher, so no number is shown for them at all.
                */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-xs space-y-3 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[#0B2545]">
                      Diagnostics ResumeSetu does not compute
                    </h3>
                    <span className="text-xs font-bold text-[#627D98] bg-surface px-2.5 py-0.5 rounded-full border border-line">
                      Not measured
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#334E68] leading-relaxed">
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-line-steel shrink-0 mt-1.5" />
                      <span>
                        <strong className="font-bold text-[#0B2545]">OCR / scan quality.</strong> Not
                        scored. ResumeSetu only checks whether a selectable text layer exists and how
                        many words it yields — see Text extraction under Document Checks.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-line-steel shrink-0 mt-1.5" />
                      <span>
                        <strong className="font-bold text-[#0B2545]">Impact verb ratio.</strong> Not
                        scored. The engine compares keywords, not writing style, so it does not judge
                        passive or executive verbs in your bullets.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-line-steel shrink-0 mt-1.5" />
                      <span>
                        <strong className="font-bold text-[#0B2545]">Quantified metrics per role.</strong>{' '}
                        Not scored. Counting numbers reliably would mean guessing what your bullets are
                        claiming, so ResumeSetu does not produce this figure.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-line-steel shrink-0 mt-1.5" />
                      <span>
                        <strong className="font-bold text-[#0B2545]">Third-party ATS parser result.</strong>{' '}
                        Not tested. Nothing is submitted to Greenhouse, Workday, Taleo or Lever, so there
                        is no parser pass/fail to report.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>


              {/* Keyword balance, derived from the current scan only */}
              <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_12px_32px_rgba(11,37,69,0.06)] space-y-4">
                <h3 className="text-base font-bold text-[#0B2545] font-['Space_Grotesk']">
                  Keyword Balance — {currentCheck?.job_title || 'Latest Scan'}
                </h3>
                {!analysis ? (
                  <p className="text-xs text-[#334E68] italic">
                    {currentCheck
                      ? 'This scan predates per-keyword counters, so only the blended score is available for it. Run the scan again for the matched/missing breakdown.'
                      : 'Run a scan to see this breakdown.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-2xl bg-white/80 border border-line/80 space-y-2">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-[#0B2545]">
                        <span>Keywords matched</span>
                        <span className="text-[#1D4ED8] tabular-nums">
                          {matchedKeywordCount} of {requiredKeywordCount} · {keywordCoveragePercent}%
                        </span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#1D4ED8] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${keywordCoveragePercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#627D98] break-words">
                        {matchedKeywordCount > 0
                          ? analysis.keywordsMatched.join(', ')
                          : 'No required keywords from this job description were found in your resume.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/80 border border-line/80 space-y-2">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold text-[#0B2545]">
                        <span>Missing keyword gaps</span>
                        <span className="text-danger tabular-nums">
                          {missingKeywordCount} of {requiredKeywordCount} · {Math.round(missingShare)}%
                        </span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-danger h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${missingShare}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#627D98] break-words">
                        {missingKeywordCount > 0
                          ? analysis.keywordsMissing.join(', ')
                          : 'No required keywords are missing from this job description.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/*
                Real document checks.

                ResumeSetu cannot submit anything to a third-party ATS, so there is
                no parser pass/fail to claim. The four checks below are measured
                from the document text itself (or explicitly labelled "Not tested"
                where measurement is impossible).
              */}
              <div className="glass-panel p-4 sm:p-6 rounded-2xl !bg-white/70 backdrop-blur-2xl border border-white/80 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-[#0B2545] font-['Space_Grotesk']">
                    Document Checks
                  </h3>
                  <span className="text-[11px] font-semibold text-[#627D98]">
                    {documentReport
                      ? `${documentReport.measuredCount} measured · ${documentReport.notTestedCount} not tested${
                          documentReport.sourceName ? ` · ${documentReport.sourceName}` : ''
                        }`
                      : 'Nothing measured yet'}
                  </span>
                </div>

                {!documentReport ? (
                  <p className="text-xs text-[#334E68] italic">
                    No document has been measured yet. Upload a resume on the ATS Calibration tab and
                    ResumeSetu will check it.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {documentReport.checks.map((check) => (
                      <div
                        key={check.id}
                        className="p-3.5 rounded-2xl bg-white/80 border border-line/80 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#0B2545] break-words">
                            {check.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              CHECK_STYLE[check.status]
                            }`}
                          >
                            {CHECK_LABEL[check.status]}
                            {check.estimated ? ' · Estimated' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-[#334E68] leading-relaxed break-words">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
