export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  plan: 'free' | 'pro';
  credits_remaining: number;
  /** Admin-configured free-tier monthly scan limit this credit count was computed against. */
  scanLimit?: number;
  isAnonymous?: boolean;
  isAdmin?: boolean;
  role?: 'OWNER' | 'ADMIN' | 'USER';
  isBanned?: boolean;
  banReason?: string;
  totalTimeSpentSeconds?: number;
  lastActiveAt?: string;
  razorpay_subscription_id?: string | null;
  created_at: string;
}

export interface LLMConfig {
  id: string;
  name: string;
  provider: 'groq' | 'gemini' | 'openai' | 'anthropic' | 'custom';
  modelId: string;
  apiKeyEnv?: string;
  contextWindow: string;
  latencyTier: 'sub-second' | 'standard' | 'deep-reasoning';
  enabled: boolean;
  createdAt: string;
}

export interface TaskBinding {
  task: 'score' | 'tailor' | 'cover_letter' | 'star_bullet' | 'resume_parse';
  taskLabel: string;
  primaryModelId: string;
  fallbackModelId: string;
}

export interface SystemSettings {
  promptInjectionShield: boolean;
  maxUploadSizeMb: number;
  freeTierMonthlyLimit: number;
  proPriceInr: number;
  rateLimitWindowDays: number;
  maintenanceMode: boolean;
  allowedFileExtensions: string[];
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  event:
    | 'USER_BANNED'
    | 'USER_UNBANNED'
    | 'ROLE_CHANGED'
    | 'PRO_TOGGLED'
    | 'PROMPT_INJECTION_BLOCKED'
    | 'RATE_LIMIT_HIT'
    | 'LLM_ROUTED'
    | 'ADMIN_LOGIN'
    | 'CREDITS_UPDATED'
    | 'PRO_UPGRADE_REQUESTED'
    | 'USER_REGISTERED'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'PASSWORD_CHANGED'
    | 'PASSWORD_SET';
  severity: 'info' | 'warning' | 'critical';
  details: string;
  ip?: string;
  actorEmail?: string;
  targetUserId?: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  activeProMembers: number;
  freeMembers: number;
  bannedUsers: number;
  adminUsers: number;
  proAdoptionRate: number;
  totalScansPerformed: number;
  totalDocumentsParsed: number;
  totalApplicationsTracked: number;
  avgAtsScore: number;
  totalTimeSpentSeconds: number;
  avgSessionDurationMinutes: number;
  scansByRole: Record<string, number>;
  applicationsByStatus: Record<string, number>;
  llmMetrics: {
    groqTokens: number | null;
    geminiTokens: number | null;
    totalTokens: number | null;
    estimatedCostUsd: string;
  };
}

export interface ResumeCheck {
  id: string;
  user_id: string;
  job_title?: string;
  company?: string;
  job_description: string;
  resume_file_name?: string;
  resume_file_url: string;
  match_score: number;
  missing_keywords: string[];
  strengths: string[];
  summary: string;
  tailored_resume_text?: string | null;
  cover_letter_text?: string | null;
  created_at: string;
}

export interface TailoredResult {
  tailored_resume_text: string;
  cover_letter_text: string;
  key_changes_made?: string[];
  synthetic?: boolean;
  notice?: string | null;
  cover_letter_synthetic?: boolean;
  cover_letter_notice?: string | null;
}

export interface ApplicationTrackerItem {
  id: string;
  company: string;
  role: string;
  /** Real ATS score from a scan, or null when the row was added manually. */
  matchScore: number | null;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  appliedDate: string;
  notes: string;
  createdAt?: string;
}

/** Shape returned by GET/POST/PATCH /api/applications. */
export interface ApplicationRecord {
  id: string;
  userId: string;
  company: string;
  role: string;
  matchScore: number;
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  appliedDate: string;
  notes?: string | null;
  createdAt?: string;
}

export type DocumentCheckStatus = 'pass' | 'warn' | 'fail' | 'not_tested';

export interface DocumentCheck {
  id: string;
  label: string;
  status: DocumentCheckStatus;
  /** True only when ResumeSetu really measured this. */
  measured: boolean;
  /** True when the result is a heuristic rather than a direct fact. */
  estimated: boolean;
  detail: string;
}

export interface DocumentCheckReport {
  checks: DocumentCheck[];
  measuredCount: number;
  notTestedCount: number;
  wordCount: number;
  characterCount: number;
  sourceName: string | null;
  generatedByResumeSetu: boolean;
}

/** Separated ATS scoring components. Never collapse these into one number. */
export interface ScoreBreakdown {
  keywordCoverage: number;
  semanticProximity: number;
  overall: number;
}

export interface GroundingFinding {
  id: string;
  kind:
    | 'fabricated_metric'
    | 'unsupported_credential'
    | 'unsupported_employer'
    | 'unsupported_skill'
    | 'unsupported_date'
    | 'source_unavailable';
  severity: 'high' | 'medium';
  excerpt: string;
  explanation: string;
}

export interface GroundingReport {
  grounded: boolean;
  findings: GroundingFinding[];
  redactions: Array<{ original: string; replacement: string }>;
  checkedSentences: number;
  note: string;
}

export interface AtsAnalysis {
  matchScore: number;
  semanticMatchScore: number;
  cosineSimilarity: number;
  keywordCoverageRatio: number;
  keywordCoveragePercent: number;
  scoreBreakdown: ScoreBreakdown;
  keywordsMatched: string[];
  keywordsMissing: string[];
  matchedCount: number;
  missingCount: number;
  requiredCount: number;
  skillsMatched: string[];
  skillsMissing: string[];
  presentKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  summary: string;
  inputQuality: {
    resumeChars: number;
    jobDescriptionChars: number;
    scorable: boolean;
    reason: 'ok' | 'empty_resume' | 'empty_job_description' | 'no_keyword_signal';
    explanation: string;
  };
  starSuggestions: Array<{ original: string; suggestion: string; keyword: string }>;
}
