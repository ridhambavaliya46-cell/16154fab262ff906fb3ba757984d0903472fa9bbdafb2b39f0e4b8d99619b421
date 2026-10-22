import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type Plan = 'FREE' | 'PRO';
/**
 * Application lifecycle: a row exists from the moment the candidate saves a role,
 * so SAVED is a real state rather than something inferred in the browser.
 * `public.application_status` gained 'SAVED' in migration 202610030001.
 */
export type ApplicationStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

export const OWNER_EMAIL = 'anjana2771patel@gmail.com';

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  authProviderId: string | null;
  currentPlan: Plan;
  monthlyScansUsed: number;
  creditResetDate: string;
  isAdmin?: boolean;
  role?: 'OWNER' | 'ADMIN' | 'USER';
  isBanned?: boolean;
  banReason?: string;
  totalTimeSpentSeconds?: number;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt?: string;
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
    | 'USER_EDITED'
    | 'GUEST_MIGRATED'
    | 'PRO_UPGRADE_REQUESTED'
    | 'PAYMENT_CONFIRMED'
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
  confirmedRevenueInr: number;
  confirmedPaymentCount: number;
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

export interface Resume {
  id: string;
  userId: string;
  originalFileName: string;
  fileUrl: string;
  /** Basename of the encrypted envelope in the local vault. */
  storageKey?: string;
  storageProvider?: 'local_encrypted' | 'supabase';
  /** Public, authorization-gated download path for the original document. */
  downloadUrl?: string;
  mimeType?: string;
  parsedText: string;
  starFormattedBullets?: Array<{ bullet: string; category: string; impact: string }> | null;
  createdAt: string;
}


export interface JobScan {
  id: string;
  userId: string;
  jobTitle?: string | null;
  companyName?: string | null;
  jobDescriptionText: string;
  matchScore: number;
  missingKeywords: string[];
  strengths?: string[];
  summary?: string;
  starSuggestions?: Array<{ original: string; suggestion: string; keyword: string }> | null;
  tailoredResumeText?: string | null;
  coverLetterText?: string | null;
  /** True when the stored tailored text came from the local fallback, not a model. */
  tailoredSynthetic?: boolean;
  tailoredNotice?: string;
  /** The resume this scan was run against, so tailor/export resolve the right document. */
  resumeId?: string | null;
  createdAt: string;
}

export interface ApplicationTracker {
  id: string;
  userId: string;
  company: string;
  role: string;
  matchScore: number | null;
  status: ApplicationStatus;
  appliedDate: string;
  notes?: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: Record<string, User>;
  resumes: Record<string, Resume>;
  jobScans: Record<string, JobScan>;
  applications: Record<string, ApplicationTracker>;
  llmConfigs: Record<string, LLMConfig>;
  taskBindings: Record<string, TaskBinding>;
  systemSettings: SystemSettings;
  securityLogs: SecurityLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

const DEFAULT_LLM_CONFIGS: Record<string, LLMConfig> = {
  'llm_groq_llama70b': {
    id: 'llm_groq_llama70b',
    name: 'Groq GPT-OSS 120B',
    provider: 'groq',
    modelId: 'openai/gpt-oss-120b',
    apiKeyEnv: 'GROQ_API_KEY',
    contextWindow: '128k',
    latencyTier: 'sub-second',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  'llm_gemini_25_flash': {
    id: 'llm_gemini_25_flash',
    name: 'Google Gemini 2.5 Flash',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    contextWindow: '1M',
    latencyTier: 'sub-second',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  'llm_gemini_15_pro': {
    id: 'llm_gemini_15_pro',
    name: 'Google Gemini 1.5 Pro',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    apiKeyEnv: 'GEMINI_API_KEY',
    contextWindow: '2M',
    latencyTier: 'deep-reasoning',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  'llm_openai_gpt4o': {
    id: 'llm_openai_gpt4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    contextWindow: '128k',
    latencyTier: 'standard',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  'llm_anthropic_claude35': {
    id: 'llm_anthropic_claude35',
    name: 'Anthropic Claude 3.5 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    contextWindow: '200k',
    latencyTier: 'deep-reasoning',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  'llm_deepseek_v3': {
    id: 'llm_deepseek_v3',
    name: 'DeepSeek V3 Chat / Reasoner',
    provider: 'custom',
    modelId: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    contextWindow: '64k',
    latencyTier: 'standard',
    enabled: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
};

const DEFAULT_TASK_BINDINGS: Record<string, TaskBinding> = {
  score: {
    task: 'score',
    taskLabel: 'ATS Match Calibration & Skill Delta Scoring',
    primaryModelId: 'llm_groq_llama70b',
    fallbackModelId: 'llm_gemini_25_flash',
  },
  tailor: {
    task: 'tailor',
    taskLabel: 'Targeted Resume Alignment & Recruiter Rubrics',
    primaryModelId: 'llm_gemini_15_pro',
    fallbackModelId: 'llm_groq_llama70b',
  },
  cover_letter: {
    task: 'cover_letter',
    taskLabel: 'Executive Cover Letter Synthesis',
    // Gemini is the better writer, so it stays primary; Groq is the fallback
    // because it is the provider this deployment actually has a key for.
    //
    // This used to fall back to OpenAI, which meant that with only a Groq key
    // configured BOTH models were unusable and every cover letter silently
    // degraded to the local outline (see the fallback at the end of runModel).
    // getModelPipeline skips providers whose key is missing, so an unconfigured
    // primary already falls through — but only if something behind it is
    // configured. Keep at least one reachable provider in every chain.
    primaryModelId: 'llm_gemini_25_flash',
    fallbackModelId: 'llm_groq_llama70b',
  },
  star_bullet: {
    task: 'star_bullet',
    taskLabel: 'STAR Metric & Impact Statement Suggestions',
    primaryModelId: 'llm_groq_llama70b',
    fallbackModelId: 'llm_gemini_25_flash',
  },
  resume_parse: {
    task: 'resume_parse',
    taskLabel: 'Resume Entity & Work History Parsing',
    primaryModelId: 'llm_gemini_25_flash',
    fallbackModelId: 'llm_groq_llama70b',
  },
};

const DEFAULT_SETTINGS: SystemSettings = {
  promptInjectionShield: true,
  maxUploadSizeMb: 5,
  freeTierMonthlyLimit: 3,
  proPriceInr: 249,
  rateLimitWindowDays: 30,
  maintenanceMode: false,
  allowedFileExtensions: ['.pdf', '.docx'],
};

const DEFAULT_SECURITY_LOGS: SecurityLog[] = [
  {
    id: 'sec_001',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    event: 'ADMIN_LOGIN',
    severity: 'info',
    details: 'System Owner authenticated via Google Workspace (anjana2771patel@gmail.com).',
    actorEmail: 'anjana2771patel@gmail.com',
  },
  {
    id: 'sec_002',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    event: 'RATE_LIMIT_HIT',
    severity: 'info',
    details: 'Client IP rate-limiter verified: all active incoming connections within healthy thresholds.',
  },
  {
    id: 'sec_003',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    event: 'LLM_ROUTED',
    severity: 'info',
    details: 'Dynamic Task Router dispatched job to Groq Llama-3.3-70b (Latency 340ms).',
  },
];

function getNextResetDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DatabaseSchema = {
      users: {
        'user_demo_free': {
          id: 'user_demo_free',
          email: 'demo-user@resumesetu.ai',
          displayName: 'Demo Free Candidate',
          authProviderId: null,
          currentPlan: 'FREE',
          monthlyScansUsed: 1,
          creditResetDate: getNextResetDate(),
          totalTimeSpentSeconds: 1420,
          lastActiveAt: new Date().toISOString(),
          createdAt: '2026-09-23T12:25:13.356Z',
        },
        'user_demo_pro': {
          id: 'user_demo_pro',
          email: 'pro-member@resumesetu.ai',
          displayName: 'Pro Subscriber',
          authProviderId: null,
          currentPlan: 'PRO',
          monthlyScansUsed: 4,
          creditResetDate: getNextResetDate(),
          totalTimeSpentSeconds: 3840,
          lastActiveAt: new Date().toISOString(),
          createdAt: '2026-09-23T12:25:13.356Z',
        },
      },
      resumes: {},
      jobScans: {},
      applications: {},
      llmConfigs: DEFAULT_LLM_CONFIGS,
      taskBindings: DEFAULT_TASK_BINDINGS,
      systemSettings: DEFAULT_SETTINGS,
      securityLogs: DEFAULT_SECURITY_LOGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Normalize jobScans (handle both array and object format)
    let normalizedScans: Record<string, JobScan> = {};
    if (Array.isArray(parsed.jobScans)) {
      for (const item of parsed.jobScans) {
        const id = item.id || `scan_${crypto.randomUUID()}`;
        normalizedScans[id] = {
          id,
          userId: item.user_id || item.userId || 'user_demo_free',
          jobTitle: item.job_title || item.jobTitle || 'Target Role',
          companyName: item.company || item.companyName || 'Target Company',
          jobDescriptionText: item.job_description || item.jobDescriptionText || '',
          matchScore: coerceCounter(item.match_score ?? item.matchScore),
          missingKeywords: item.missing_keywords || item.missingKeywords || [],
          strengths: item.strengths || [],
          summary: item.summary || '',
          starSuggestions: item.starSuggestions || item.star_suggestions || null,
          tailoredResumeText: item.tailored_resume_text || item.tailoredResumeText || null,
          coverLetterText: item.cover_letter_text || item.coverLetterText || null,
          createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        };
      }
    } else if (parsed.jobScans && typeof parsed.jobScans === 'object') {
      normalizedScans = parsed.jobScans;
    }

    const dbData: DatabaseSchema = {
      users: parsed.users || {},
      resumes: parsed.resumes || {},
      jobScans: normalizedScans,
      applications: parsed.applications || {},
      llmConfigs: parsed.llmConfigs || DEFAULT_LLM_CONFIGS,
      taskBindings: parsed.taskBindings || DEFAULT_TASK_BINDINGS,
      systemSettings: parsed.systemSettings || DEFAULT_SETTINGS,
      securityLogs: parsed.securityLogs || DEFAULT_SECURITY_LOGS,
    };

    // Guarantee system owner is registered with OWNER role and Pro plan
    const ownerEntry = Object.values(dbData.users).find(
      (u) => u.email.toLowerCase().trim() === OWNER_EMAIL
    );
    if (ownerEntry) {
      ownerEntry.isAdmin = true;
      ownerEntry.role = 'OWNER';
      ownerEntry.currentPlan = 'PRO';
    } else {
      const ownerId = 'usr_owner_anjana';
      dbData.users[ownerId] = {
        id: ownerId,
        email: OWNER_EMAIL,
        displayName: 'Anjana Patel (System Owner)',
        authProviderId: null,
        currentPlan: 'PRO',
        monthlyScansUsed: 0,
        creditResetDate: getNextResetDate(),
        isAdmin: true,
        role: 'OWNER',
        totalTimeSpentSeconds: 4200,
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      saveDb(dbData);
    }

    return dbData;
  } catch (err) {
    console.error('Error reading db.json, creating clean store:', err);
    const fallbackDb: DatabaseSchema = {
      users: {},
      resumes: {},
      jobScans: {},
      applications: {},
      llmConfigs: DEFAULT_LLM_CONFIGS,
      taskBindings: DEFAULT_TASK_BINDINGS,
      systemSettings: DEFAULT_SETTINGS,
      securityLogs: DEFAULT_SECURITY_LOGS,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(fallbackDb, null, 2), 'utf-8');
    return fallbackDb;
  }
}

function saveDb(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

const MAX_SECURITY_LOGS = 200;

/**
 * Appends an audit entry to an in-memory state object WITHOUT persisting it.
 *
 * Audit-writing methods must use this instead of db.addSecurityLog():
 * addSecurityLog() re-reads the file into a fresh object and saves on its own,
 * so the caller's subsequent saveDb(state) would overwrite the entry with a
 * stale snapshot and silently discard the audit trail.
 */
function appendSecurityLog(
  state: DatabaseSchema,
  logData: Omit<SecurityLog, 'id' | 'timestamp'>
): SecurityLog {
  const log: SecurityLog = {
    ...logData,
    id: `sec_${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
  };
  if (!Array.isArray(state.securityLogs)) state.securityLogs = [];
  state.securityLogs.push(log);
  if (state.securityLogs.length > MAX_SECURITY_LOGS) {
    state.securityLogs = state.securityLogs.slice(-MAX_SECURITY_LOGS);
  }
  return log;
}

/**
 * Normalizes a persisted scan counter. Legacy records predate monthlyScansUsed
 * and other numeric fields; without coercion `undefined + 1` becomes NaN, which
 * serializes to JSON null and then defeats every `>= limit` quota comparison.
 */
function coerceCounter(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export const db = {
  // ---------------------------------------------------------------------------
  // USER METHODS
  // ---------------------------------------------------------------------------
  getUser(id: string): User | null {
    const state = ensureDb();
    const user = state.users[id];
    if (!user) return null;

    if (user.email.toLowerCase().trim() === OWNER_EMAIL) {
      user.isAdmin = true;
      user.role = 'OWNER';
      user.currentPlan = 'PRO';
    }

    // Check credit reset cycle (30-day rolling window)
    const now = new Date();
    const resetDate = new Date(user.creditResetDate || 0);
    if (now > resetDate && user.currentPlan === 'FREE') {
      user.monthlyScansUsed = 0;
      user.creditResetDate = getNextResetDate();
      state.users[id] = user;
      saveDb(state);
    }
    return user;
  },

  getUserByEmail(email: string): User | null {
    const state = ensureDb();
    const lowerEmail = email.toLowerCase().trim();
    for (const u of Object.values(state.users)) {
      if (u.email.toLowerCase().trim() === lowerEmail) {
        if (lowerEmail === OWNER_EMAIL) {
          u.isAdmin = true;
          u.role = 'OWNER';
          u.currentPlan = 'PRO';
        }
        return u;
      }
    }
    return null;
  },

  getUserByAuthProviderId(authProviderId: string): User | null {
    const state = ensureDb();
    for (const u of Object.values(state.users)) {
      if (u.authProviderId === authProviderId) {
        if (u.email.toLowerCase().trim() === OWNER_EMAIL) {
          u.isAdmin = true;
          u.role = 'OWNER';
          u.currentPlan = 'PRO';
        }
        return u;
      }
    }
    return null;
  },

  getOrCreateUser(id: string, email: string, authProviderId?: string | null): User {
    const state = ensureDb();
    const isOwnerUser = email.toLowerCase().trim() === OWNER_EMAIL;
    let existing = state.users[id];
    if (existing) {
      if (authProviderId && !existing.authProviderId) {
        existing.authProviderId = authProviderId;
      }
      if (isOwnerUser) {
        existing.isAdmin = true;
        existing.role = 'OWNER';
        existing.currentPlan = 'PRO';
      }
      state.users[id] = existing;
      saveDb(state);
      return existing;
    }

    // Check if email already matches another user record
    const byEmail = this.getUserByEmail(email);
    if (byEmail) {
      if (authProviderId && !byEmail.authProviderId) {
        byEmail.authProviderId = authProviderId;
      }
      if (isOwnerUser) {
        byEmail.isAdmin = true;
        byEmail.role = 'OWNER';
        byEmail.currentPlan = 'PRO';
      }
      state.users[byEmail.id] = byEmail;
      saveDb(state);
      return byEmail;
    }

    const newUser: User = {
      id,
      email,
      authProviderId: authProviderId || null,
      currentPlan: isOwnerUser ? 'PRO' : 'FREE',
      monthlyScansUsed: 0,
      creditResetDate: getNextResetDate(),
      isAdmin: isOwnerUser ? true : false,
      role: isOwnerUser ? 'OWNER' : 'USER',
      createdAt: new Date().toISOString(),
    };

    state.users[id] = newUser;
    saveDb(state);
    return newUser;
  },

  updateUserProfile(
    id: string,
    updates: Pick<User, 'email' | 'displayName' | 'authProviderId'>
  ): User | null {
    const state = ensureDb();
    const user = state.users[id];
    if (!user) return null;

    const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
    state.users[id] = updated;
    saveDb(state);
    return updated;
  },

  getAllUsers(): User[] {
    const state = ensureDb();
    return Object.values(state.users).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  toggleUserPro(userId: string): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    user.currentPlan = user.currentPlan === 'PRO' ? 'FREE' : 'PRO';
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    appendSecurityLog(state, {
      event: 'PRO_TOGGLED',
      severity: 'info',
      details: `Plan for user ${user.email} toggled to ${user.currentPlan}.`,
      targetUserId: userId,
    });
    saveDb(state);
    return user;
  },

  setUserPlan(userId: string, plan: Plan): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    user.currentPlan = plan;
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    appendSecurityLog(state, {
      event: 'PRO_TOGGLED',
      severity: 'info',
      details: `Plan for user ${user.email} updated to ${plan}.`,
      targetUserId: userId,
    });
    saveDb(state);
    return user;
  },

  makeUserAdmin(userId: string, isAdmin: boolean, role: 'ADMIN' | 'USER' = 'ADMIN'): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    if (user.email.toLowerCase().trim() === OWNER_EMAIL) {
      user.isAdmin = true;
      user.role = 'OWNER';
      user.currentPlan = 'PRO';
    } else {
      user.isAdmin = isAdmin;
      user.role = isAdmin ? role : 'USER';
    }
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    appendSecurityLog(state, {
      event: 'ROLE_CHANGED',
      severity: 'warning',
      details: `User ${user.email} role updated to ${user.role} (isAdmin: ${user.isAdmin}).`,
      targetUserId: userId,
    });
    saveDb(state);
    return user;
  },

  banUser(userId: string, isBanned: boolean, banReason: string = 'Administrative policy violation'): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    // Prevent banning the owner
    if (user.email.toLowerCase().trim() === OWNER_EMAIL) {
      throw new Error('System Owner cannot be banned.');
    }

    user.isBanned = isBanned;
    user.banReason = isBanned ? banReason : undefined;
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;

    appendSecurityLog(state, {
      event: isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
      severity: isBanned ? 'critical' : 'info',
      details: isBanned
        ? `Account ${user.email} suspended. Reason: ${banReason}`
        : `Account ${user.email} reinstated.`,
      targetUserId: userId,
    });

    saveDb(state);
    return user;
  },

  editUser(userId: string, updates: Partial<User>): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    const isOwner = user.email.toLowerCase().trim() === OWNER_EMAIL;

    // Explicit allow-list. A blind {...user, ...updates} let any caller rewrite
    // identity fields (including the primary key `id`) through the admin API.
    const EDITABLE_FIELDS = [
      'displayName',
      'currentPlan',
      'role',
      'isAdmin',
      'monthlyScansUsed',
      'isBanned',
      'banReason',
    ] as const;

    const sanitized: Partial<User> = {};
    for (const key of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        (sanitized as Record<string, unknown>)[key] = (
          updates as Record<string, unknown>
        )[key];
      }
    }

    if (sanitized.currentPlan && !['FREE', 'PRO'].includes(String(sanitized.currentPlan))) {
      throw new Error(`Invalid plan: ${sanitized.currentPlan}. Expected FREE or PRO.`);
    }
    if (sanitized.role && !['OWNER', 'ADMIN', 'USER'].includes(String(sanitized.role))) {
      throw new Error(`Invalid role: ${sanitized.role}.`);
    }
    if (sanitized.monthlyScansUsed !== undefined) {
      sanitized.monthlyScansUsed = coerceCounter(sanitized.monthlyScansUsed);
    }
    if (typeof sanitized.displayName === 'string') {
      sanitized.displayName = sanitized.displayName.slice(0, 120);
    }

    // Preserve owner protection: these three are never admin-editable.
    if (isOwner) {
      sanitized.isAdmin = true;
      sanitized.role = 'OWNER';
      sanitized.isBanned = false;
      sanitized.currentPlan = 'PRO';
    }

    const updatedUser: User = {
      ...user,
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };

    state.users[userId] = updatedUser;
    appendSecurityLog(state, {
      event: 'USER_EDITED',
      severity: 'info',
      details: `User ${user.email} updated. Fields: ${
        Object.keys(sanitized).join(', ') || 'none'
      }.`,
      targetUserId: userId,
    });
    saveDb(state);
    return updatedUser;
  },

  addUserCredits(userId: string, credits: number = 3): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    user.monthlyScansUsed = Math.max(0, user.monthlyScansUsed - credits);
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    appendSecurityLog(state, {
      event: 'CREDITS_UPDATED',
      severity: 'info',
      details: `Added ${credits} scan credits to user ${user.email}.`,
      targetUserId: userId,
    });
    saveDb(state);
    return user;
  },

  recordUserSessionPing(userId: string, seconds: number = 30, _page: string = 'workspace'): void {
    if (!userId || userId === 'guest_user') return;
    const state = ensureDb();
    const user = state.users[userId];
    if (user) {
      user.totalTimeSpentSeconds = (user.totalTimeSpentSeconds || 0) + seconds;
      user.lastActiveAt = new Date().toISOString();
      state.users[userId] = user;
      saveDb(state);
    }
  },

  getStats(): AdminAnalytics {
    const state = ensureDb();
    const users = Object.values(state.users);
    const resumes = Object.values(state.resumes);
    const jobScans = Object.values(state.jobScans);
    const applications = Object.values(state.applications);

    const proUsers = users.filter((u) => u.currentPlan === 'PRO').length;
    const freeUsers = users.length - proUsers;
    const bannedUsers = users.filter((u) => u.isBanned).length;
    const adminUsers = users.filter((u) => u.isAdmin || u.role === 'OWNER').length;
    const proAdoptionRate = users.length > 0 ? Math.round((proUsers / users.length) * 100) : 0;

    const totalScans = jobScans.length;
    const totalDocuments = resumes.length;

    // Real average ATS score calculation
    let avgScore = 0;
    if (totalScans > 0) {
      const sum = jobScans.reduce((acc, s) => acc + (s.matchScore || 0), 0);
      avgScore = Math.round(sum / totalScans);
    } else {
      avgScore = 0;
    }

    // Real total time spent — users with no recorded pings contribute 0, and an
    // empty user list reports 0 minutes instead of an invented floor.
    const totalTimeSpentSeconds = users.reduce(
      (acc, u) => acc + (u.totalTimeSpentSeconds || 0),
      0
    );
    const avgSessionDurationMinutes =
      users.length > 0
        ? Math.round(totalTimeSpentSeconds / users.length / 60)
        : 0;

    // Scans by target role distribution
    const scansByRole: Record<string, number> = {};
    for (const scan of jobScans) {
      const role = scan.jobTitle || 'General Engineering';
      scansByRole[role] = (scansByRole[role] || 0) + 1;
    }

    // Applications by status
    const applicationsByStatus: Record<string, number> = {
      SAVED: 0,
      APPLIED: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
    };
    for (const app of applications) {
      applicationsByStatus[app.status] = (applicationsByStatus[app.status] || 0) + 1;
    }

    // Real token estimates
    return {
      totalUsers: users.length,
      activeProMembers: proUsers,
      confirmedRevenueInr: 0,
      confirmedPaymentCount: 0,
      freeMembers: freeUsers,
      bannedUsers,
      adminUsers,
      proAdoptionRate,
      totalDocumentsParsed: totalDocuments,
      totalScansPerformed: totalScans,
      totalApplicationsTracked: applications.length,
      avgAtsScore: avgScore,
      totalTimeSpentSeconds,
      avgSessionDurationMinutes,
      scansByRole,
      applicationsByStatus,
      llmMetrics: {
        groqTokens: null,
        geminiTokens: null,
        totalTokens: null,
        estimatedCostUsd: 'Not measured',
      },
    };
  },

  // ---------------------------------------------------------------------------
  // LLM ORCHESTRATION & TASK BINDINGS
  // ---------------------------------------------------------------------------
  getLLMConfigs(): LLMConfig[] {
    const state = ensureDb();
    return Object.values(state.llmConfigs || {});
  },

  addLLMConfig(data: Omit<LLMConfig, 'id' | 'createdAt'>): LLMConfig {
    const state = ensureDb();
    const id = `llm_${crypto.randomUUID().slice(0, 8)}`;
    const newConfig: LLMConfig = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    state.llmConfigs[id] = newConfig;
    saveDb(state);
    return newConfig;
  },

  updateLLMConfig(id: string, updates: Partial<LLMConfig>): LLMConfig {
    const state = ensureDb();
    const current = state.llmConfigs[id];
    if (!current) throw new Error(`LLM configuration not found: ${id}`);
    const updated = { ...current, ...updates };
    state.llmConfigs[id] = updated;
    saveDb(state);
    return updated;
  },

  deleteLLMConfig(id: string): boolean {
    const state = ensureDb();
    if (!state.llmConfigs[id]) return false;
    delete state.llmConfigs[id];
    saveDb(state);
    return true;
  },

  getTaskBindings(): Record<string, TaskBinding> {
    const state = ensureDb();
    return state.taskBindings || {};
  },

  saveTaskBinding(task: string, primaryModelId: string, fallbackModelId: string): TaskBinding {
    const state = ensureDb();
    const current = state.taskBindings[task];
    const updated: TaskBinding = {
      task: (task as any),
      taskLabel: current?.taskLabel || task,
      primaryModelId,
      fallbackModelId,
    };
    state.taskBindings[task] = updated;
    appendSecurityLog(state, {
      event: 'LLM_ROUTED',
      severity: 'info',
      details: `Task binding for '${task}' updated to primary: ${primaryModelId}, fallback: ${fallbackModelId}.`,
    });
    saveDb(state);
    return updated;
  },

  // ---------------------------------------------------------------------------
  // SYSTEM SETTINGS & SECURITY LOGS
  // ---------------------------------------------------------------------------
  getSystemSettings(): SystemSettings {
    const state = ensureDb();
    return state.systemSettings || DEFAULT_SETTINGS;
  },

  updateSystemSettings(updates: Partial<SystemSettings>): SystemSettings {
    const state = ensureDb();
    const current = state.systemSettings || DEFAULT_SETTINGS;
    const updated = { ...current, ...updates };
    state.systemSettings = updated;
    saveDb(state);
    return updated;
  },

  getSecurityLogs(limit: number = 50): SecurityLog[] {
    const state = ensureDb();
    return (state.securityLogs || [])
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  addSecurityLog(logData: Omit<SecurityLog, 'id' | 'timestamp'>): SecurityLog {
    const state = ensureDb();
    const log = appendSecurityLog(state, logData);
    saveDb(state);
    return log;
  },

  incrementScanUsage(userId: string): { allowed: boolean; remaining: number } {
    const state = ensureDb();
    const freeLimit = Number(state.systemSettings?.freeTierMonthlyLimit) > 0
      ? Number(state.systemSettings?.freeTierMonthlyLimit)
      : 3;
    // Sentinel for "effectively unlimited" on PRO plans. Mirrored client-side.
    const PRO_UNLIMITED = 9999;

    let user = state.users[userId];

    if (!user) {
      // Provision the record so the counter actually persists. Returning
      // {allowed:true} without writing let every guest browser scan forever.
      user = {
        id: userId,
        email: `${userId}@guest.resumesetu.app`,
        authProviderId: null,
        currentPlan: 'FREE',
        monthlyScansUsed: 0,
        creditResetDate: getNextResetDate(),
        isAdmin: false,
        role: 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.users[userId] = user;
    }

    // Repair legacy/invalid counters before any comparison.
    user.monthlyScansUsed = coerceCounter(user.monthlyScansUsed);
    if (!user.creditResetDate || Number.isNaN(new Date(user.creditResetDate).getTime())) {
      user.creditResetDate = getNextResetDate();
    }

    // Rolling window reset for free plans.
    if (user.currentPlan === 'FREE' && new Date() > new Date(user.creditResetDate)) {
      user.monthlyScansUsed = 0;
      user.creditResetDate = getNextResetDate();
    }

    if (user.currentPlan === 'PRO') {
      user.monthlyScansUsed += 1;
      user.updatedAt = new Date().toISOString();
      state.users[userId] = user;
      saveDb(state);
      return { allowed: true, remaining: PRO_UNLIMITED };
    }

    if (user.monthlyScansUsed >= freeLimit) {
      saveDb(state);
      return { allowed: false, remaining: 0 };
    }

    user.monthlyScansUsed += 1;
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    saveDb(state);
    return { allowed: true, remaining: Math.max(0, freeLimit - user.monthlyScansUsed) };
  },

  upgradeToPro(userId: string): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    user.currentPlan = 'PRO';
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    saveDb(state);
    return user;
  },

  downgradeToFree(userId: string): User {
    const state = ensureDb();
    const user = state.users[userId];
    if (!user) throw new Error(`User not found: ${userId}`);

    user.currentPlan = 'FREE';
    user.updatedAt = new Date().toISOString();
    state.users[userId] = user;
    saveDb(state);
    return user;
  },

  deleteUser(userId: string): boolean {
    const state = ensureDb();
    if (!state.users[userId]) return false;

    delete state.users[userId];

    // Delete user resumes, job scans, and applications
    for (const [id, r] of Object.entries(state.resumes)) {
      if (r.userId === userId) delete state.resumes[id];
    }
    for (const [id, s] of Object.entries(state.jobScans)) {
      if (s.userId === userId) delete state.jobScans[id];
    }
    for (const [id, a] of Object.entries(state.applications)) {
      if (a.userId === userId) delete state.applications[id];
    }

    saveDb(state);
    return true;
  },

  // ---------------------------------------------------------------------------
  // RESUME METHODS
  // ---------------------------------------------------------------------------
  createResume(data: Omit<Resume, 'id' | 'createdAt'>): Resume {
    const state = ensureDb();
    const id = `res_${crypto.randomUUID()}`;
    const resume: Resume = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    state.resumes[id] = resume;
    saveDb(state);
    return resume;
  },

  getResume(id: string): Resume | null {
    const state = ensureDb();
    return state.resumes[id] || null;
  },

  updateResume(id: string, updates: Partial<Resume>): Resume | null {
    const state = ensureDb();
    const resume = state.resumes[id];
    if (!resume) return null;
    const updated: Resume = { ...resume, ...updates };
    state.resumes[id] = updated;
    saveDb(state);
    return updated;
  },

  getResumesByUser(userId: string): Resume[] {
    const state = ensureDb();
    return Object.values(state.resumes)
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // ---------------------------------------------------------------------------
  // JOB SCAN METHODS
  // ---------------------------------------------------------------------------
  createJobScan(data: Omit<JobScan, 'id' | 'createdAt'>): JobScan {
    const state = ensureDb();
    const id = `scan_${crypto.randomUUID()}`;
    const scan: JobScan = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    state.jobScans[id] = scan;
    saveDb(state);
    return scan;
  },

  getJobScan(id: string): JobScan | null {
    const state = ensureDb();
    return state.jobScans[id] || null;
  },

  getJobScansByUser(userId: string): JobScan[] {
    const state = ensureDb();
    return Object.values(state.jobScans)
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  updateJobScan(id: string, updates: Partial<JobScan>): JobScan | null {
    const state = ensureDb();
    const scan = state.jobScans[id];
    if (!scan) return null;

    const updated = { ...scan, ...updates };
    state.jobScans[id] = updated;
    saveDb(state);
    return updated;
  },

  // ---------------------------------------------------------------------------
  // APPLICATION TRACKER METHODS
  // ---------------------------------------------------------------------------
  createApplication(data: Omit<ApplicationTracker, 'id' | 'createdAt'>): ApplicationTracker {
    const state = ensureDb();
    const id = `app_${crypto.randomUUID()}`;
    const application: ApplicationTracker = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    state.applications[id] = application;
    saveDb(state);
    return application;
  },

  getApplicationsByUser(userId: string): ApplicationTracker[] {
    const state = ensureDb();
    return Object.values(state.applications)
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
  },

  updateApplication(id: string, updates: Partial<ApplicationTracker>): ApplicationTracker | null {
    const state = ensureDb();
    const app = state.applications[id];
    if (!app) return null;

    const updated = { ...app, ...updates };
    state.applications[id] = updated;
    saveDb(state);
    return updated;
  },

  deleteApplication(id: string): boolean {
    const state = ensureDb();
    if (!state.applications[id]) return false;
    delete state.applications[id];
    saveDb(state);
    return true;
  },

  // ---------------------------------------------------------------------------
  // GUEST MIGRATION ENGINE (Dual-mode session management)
  // ---------------------------------------------------------------------------
  migrateGuestData(
    guestId: string,
    authenticatedUserId: string
  ): {
    resumesMigrated: number;
    scansMigrated: number;
    applicationsMigrated: number;
  } {
    if (!guestId || !authenticatedUserId || guestId === authenticatedUserId) {
      return { resumesMigrated: 0, scansMigrated: 0, applicationsMigrated: 0 };
    }

    // Only anonymous guest tokens may be migrated. Without this guard a caller
    // could hand over any arbitrary userId and take over that account's data.
    if (!/^guest_[A-Za-z0-9_-]+$/.test(guestId)) {
      throw new Error('Invalid guest token: not a recognized guest session id.');
    }

    const state = ensureDb();

    // The destination must be a real, provisioned account.
    if (!state.users[authenticatedUserId]) {
      throw new Error(`Cannot migrate to unknown user: ${authenticatedUserId}.`);
    }

    let resumesMigrated = 0;
    let scansMigrated = 0;
    let applicationsMigrated = 0;

    // Migrate Resumes
    for (const r of Object.values(state.resumes)) {
      if (r.userId === guestId) {
        r.userId = authenticatedUserId;
        resumesMigrated++;
      }
    }

    // Migrate JobScans
    for (const s of Object.values(state.jobScans)) {
      if (s.userId === guestId) {
        s.userId = authenticatedUserId;
        scansMigrated++;
      }
    }

    // Migrate ApplicationTracker records
    for (const a of Object.values(state.applications)) {
      if (a.userId === guestId) {
        a.userId = authenticatedUserId;
        applicationsMigrated++;
      }
    }

    appendSecurityLog(state, {
      event: 'GUEST_MIGRATED',
      severity: 'info',
      details: `Guest session ${guestId} merged into ${authenticatedUserId} (Resumes: ${resumesMigrated}, Scans: ${scansMigrated}, Apps: ${applicationsMigrated}).`,
      targetUserId: authenticatedUserId,
    });
    saveDb(state);
    console.log(
      `[Auth Migration] Migrated guest ${guestId} -> ${authenticatedUserId} (Resumes: ${resumesMigrated}, Scans: ${scansMigrated}, Apps: ${applicationsMigrated})`
    );

    return { resumesMigrated, scansMigrated, applicationsMigrated };
  },
};
