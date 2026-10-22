import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type {
  AdminAnalytics,
  ApplicationTracker,
  LLMConfig,
  Plan,
  Resume,
  SecurityLog,
  SystemSettings,
  TaskBinding,
  User,
  JobScan,
} from './db.js';
import { OWNER_EMAIL } from './db.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_STORAGE_URL;
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseSecret) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase database adapter.');
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_SETTINGS: SystemSettings = {
  promptInjectionShield: true,
  maxUploadSizeMb: 5,
  freeTierMonthlyLimit: 3,
  proPriceInr: 249,
  rateLimitWindowDays: 30,
  maintenanceMode: false,
  allowedFileExtensions: ['.pdf', '.docx'],
};

function toSnake(value: string): string {
  if (value === 'photoURL') return 'photo_url';
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamel(value: string): string {
  if (value === 'photo_url') return 'photoURL';
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toRow<T extends object>(value: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
      .map(([key, field]) => [toSnake(key), field])
  );
}

function fromRow<T>(value: Record<string, any> | null): T | null {
  if (!value) return null;
  const mapped = Object.fromEntries(Object.entries(value).map(([key, field]) => [toCamel(key), field]));
  if (typeof mapped.totalTimeSpentSeconds === 'string') {
    mapped.totalTimeSpentSeconds = Number(mapped.totalTimeSpentSeconds);
  }
  return mapped as T;
}

function fail(error: { message: string; code?: string } | null, operation: string): void {
  if (error) throw new Error(`Supabase ${operation} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
}

/**
 * True when PostgREST rejected the statement because an enum lacks a value the
 * application expects (PostgreSQL SQLSTATE 22P02, "invalid input value for enum").
 *
 * This is the signature of an unapplied migration. Surfacing it as an actionable
 * message matters: the alternative was the user seeing
 * "Supabase insert application failed (22P02): invalid input value for enum
 * application_status: \"SAVED\"" with no indication that a schema change was
 * pending, or that they had to paste SQL into the Supabase dashboard.
 */
function isMissingEnumValue(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '22P02' ||
    /invalid input value for enum/i.test(error.message || '')
  );
}

/**
 * Runs a mutation, translating an unapplied-migration failure into an error the
 * API can present verbatim to the user.
 */
async function assertNoPendingMigration<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingEnumValue({ message })) {
      throw new Error(
        `This feature needs a database migration that has not been applied yet (${operation}). ` +
          `Run "npm run db:check" for the exact SQL, or paste it into Supabase -> SQL Editor.`
      );
    }
    throw err;
  }
}

async function one<T>(query: PromiseLike<{ data: any; error: any }>, operation: string): Promise<T | null> {
  const { data, error } = await query;
  fail(error, operation);
  return fromRow<T>(data);
}

async function many<T>(query: PromiseLike<{ data: any[] | null; error: any }>, operation: string): Promise<T[]> {
  const { data, error } = await query;
  fail(error, operation);
  return (data || []).map((row) => fromRow<T>(row)!).filter(Boolean);
}

function getNextResetDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

function createLog(logData: Omit<SecurityLog, 'id' | 'timestamp'>): SecurityLog {
  return {
    ...logData,
    id: `sec_${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
  };
}

async function addSecurityLog(logData: Omit<SecurityLog, 'id' | 'timestamp'>): Promise<SecurityLog> {
  const log = createLog(logData);
  const { error } = await supabase.from('security_logs').insert(toRow(log));
  fail(error, 'insert security log');
  return log;
}

async function findUserByEmail(email: string): Promise<User | null> {
  return one<User>(supabase.from('users').select('*').eq('email', email.toLowerCase().trim()).maybeSingle(), 'get user by email');
}

function enforceOwner(user: User): User {
  if (user.email.toLowerCase().trim() === OWNER_EMAIL) {
    return { ...user, isAdmin: true, role: 'OWNER', currentPlan: 'PRO' };
  }
  return user;
}

export const supabaseDb = {
  async verifyConnection(): Promise<void> {
    const tables = ['users', 'resumes', 'job_scans', 'applications', 'llm_configs', 'task_bindings', 'system_settings', 'security_logs', 'api_rate_limits', 'manual_payment_records'];
    const results = await Promise.all(tables.map(async (table) => {
      const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
      return { table, error };
    }));
    const failed = results.find((result) => result.error);
    if (failed) fail(failed.error, `verify table ${failed.table}`);
    const probeId = `deployment_probe_${crypto.randomUUID()}`;
    const quota = await supabase.rpc('consume_scan_quota', { p_user_id: probeId });
    fail(quota.error, 'verify quota function');
    if (Array.isArray(quota.data) && quota.data[0]?.allowed !== false) {
      throw new Error('Supabase quota function probe returned an unexpected result.');
    }
    const ping = await supabase.rpc('record_session_ping', { p_user_id: probeId, p_seconds: 0 });
    fail(ping.error, 'verify session analytics function');
    const burstProbe = await supabase.rpc('consume_ip_burst_limit', {
      p_key_hash: 'invalid',
      p_max_requests: 1,
      p_window_seconds: 60,
    });
    if (burstProbe.error?.code !== 'P0001') {
      if (burstProbe.error?.code === 'PGRST202' && process.env.NODE_ENV !== 'production') {
        console.warn(
          '[Supabase] Shared IP rate-limit migration is missing. Local development will use an in-memory fallback; apply supabase/migrations/202610070001_shared_ip_rate_limits.sql before deploying.'
        );
        return;
      }
      fail(burstProbe.error, 'verify shared IP rate-limit function');
      throw new Error('Supabase shared IP rate-limit function returned an unexpected probe result.');
    }
  },

  async getUser(id: string): Promise<User | null> {
    let user = await one<User>(supabase.from('users').select('*').eq('id', id).maybeSingle(), 'get user');
    if (!user) return null;
    const resetAt = new Date(user.creditResetDate || 0);
    if (user.currentPlan === 'FREE' && Date.now() > resetAt.getTime()) {
      const reset = { monthlyScansUsed: 0, creditResetDate: getNextResetDate() };
      user = { ...user, ...reset };
      const { error } = await supabase.from('users').update(toRow(reset)).eq('id', id);
      fail(error, 'reset user quota');
    }
    return enforceOwner(user);
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await findUserByEmail(email);
    return user ? enforceOwner(user) : null;
  },

  async getUserByAuthProviderId(authProviderId: string): Promise<User | null> {
    const user = await one<User>(supabase.from('users').select('*').eq('auth_provider_id', authProviderId).maybeSingle(), 'get user by provider id');
    return user ? enforceOwner(user) : null;
  },

  async getOrCreateUser(id: string, email: string, authProviderId?: string | null): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const existingById = await this.getUser(id);
    if (existingById) {
      if (authProviderId && !existingById.authProviderId) {
        const updated = await this.updateUserProfile(existingById.id, {
          email: normalizedEmail,
          displayName: existingById.displayName || null,
          authProviderId,
        });
        if (updated) return updated;
      }
      return existingById;
    }

    const existingByEmail = await findUserByEmail(normalizedEmail);
    if (existingByEmail) {
      if (authProviderId) {
        const { error } = await supabase.from('users').update({ auth_provider_id: authProviderId }).eq('id', existingByEmail.id);
        fail(error, 'link auth provider');
        existingByEmail.authProviderId = authProviderId;
      }
      return enforceOwner(existingByEmail);
    }

    const isOwner = normalizedEmail === OWNER_EMAIL;
    const now = new Date().toISOString();
    const user: User = {
      id,
      email: normalizedEmail,
      authProviderId: authProviderId || null,
      currentPlan: isOwner ? 'PRO' : 'FREE',
      monthlyScansUsed: 0,
      creditResetDate: getNextResetDate(),
      isAdmin: isOwner,
      role: isOwner ? 'OWNER' : 'USER',
      isBanned: false,
      totalTimeSpentSeconds: 0,
      createdAt: now,
      updatedAt: now,
    };
    const { data, error } = await supabase.from('users').insert(toRow(user)).select('*').single();
    fail(error, 'create user');
    return enforceOwner(fromRow<User>(data)!);
  },

  async updateUserProfile(id: string, updates: Pick<User, 'email' | 'displayName' | 'authProviderId'>): Promise<User | null> {
    return one<User>(supabase.from('users').update(toRow(updates)).eq('id', id).select('*').maybeSingle(), 'update profile');
  },

  async getAllUsers(): Promise<User[]> {
    const users = await many<User>(supabase.from('users').select('*').order('created_at', { ascending: false }), 'list users');
    return users.map(enforceOwner);
  },

  async toggleUserPro(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    return this.setUserPlan(userId, user.currentPlan === 'PRO' ? 'FREE' : 'PRO');
  },

  async setUserPlan(userId: string, plan: Plan): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const nextPlan = user.email.toLowerCase() === OWNER_EMAIL ? 'PRO' : plan;
    const updated = await one<User>(supabase.from('users').update({ current_plan: nextPlan }).eq('id', userId).select('*').single(), 'set user plan');
    await addSecurityLog({ event: 'PRO_TOGGLED', severity: 'info', details: `Plan for user ${user.email} updated to ${nextPlan}.`, targetUserId: userId });
    return enforceOwner(updated!);
  },

  async makeUserAdmin(userId: string, isAdmin: boolean, role: 'ADMIN' | 'USER' = 'ADMIN'): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const updates = user.email.toLowerCase() === OWNER_EMAIL
      ? { is_admin: true, role: 'OWNER', current_plan: 'PRO' }
      : { is_admin: isAdmin, role: isAdmin ? role : 'USER' };
    const updated = await one<User>(supabase.from('users').update(updates).eq('id', userId).select('*').single(), 'change user role');
    await addSecurityLog({ event: 'ROLE_CHANGED', severity: 'warning', details: `User ${user.email} role updated to ${updated!.role}.`, targetUserId: userId });
    return enforceOwner(updated!);
  },

  async banUser(userId: string, isBanned: boolean, banReason = 'Administrative policy violation'): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    if (user.email.toLowerCase() === OWNER_EMAIL) throw new Error('System Owner cannot be banned.');
    const updated = await one<User>(supabase.from('users').update({ is_banned: isBanned, ban_reason: isBanned ? banReason : null }).eq('id', userId).select('*').single(), 'ban user');
    await addSecurityLog({
      event: isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
      severity: isBanned ? 'critical' : 'info',
      details: isBanned ? `Account ${user.email} suspended. Reason: ${banReason}` : `Account ${user.email} reinstated.`,
      targetUserId: userId,
    });
    return enforceOwner(updated!);
  },

  async editUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const fields = ['displayName', 'currentPlan', 'role', 'isAdmin', 'monthlyScansUsed', 'isBanned', 'banReason'] as const;
    const sanitized: Record<string, unknown> = {};
    for (const key of fields) if (Object.prototype.hasOwnProperty.call(updates, key)) sanitized[key] = updates[key];
    if (sanitized.currentPlan && !['FREE', 'PRO'].includes(String(sanitized.currentPlan))) throw new Error(`Invalid plan: ${sanitized.currentPlan}.`);
    if (sanitized.role && !['OWNER', 'ADMIN', 'USER'].includes(String(sanitized.role))) throw new Error(`Invalid role: ${sanitized.role}.`);
    if (sanitized.monthlyScansUsed !== undefined) sanitized.monthlyScansUsed = Math.max(0, Math.floor(Number(sanitized.monthlyScansUsed) || 0));
    if (typeof sanitized.displayName === 'string') sanitized.displayName = sanitized.displayName.slice(0, 120);
    if (user.email.toLowerCase() === OWNER_EMAIL) Object.assign(sanitized, { isAdmin: true, role: 'OWNER', isBanned: false, currentPlan: 'PRO' });
    const updated = await one<User>(supabase.from('users').update(toRow(sanitized)).eq('id', userId).select('*').single(), 'edit user');
    await addSecurityLog({ event: 'USER_EDITED', severity: 'info', details: `User ${user.email} updated. Fields: ${Object.keys(sanitized).join(', ') || 'none'}.`, targetUserId: userId });
    return enforceOwner(updated!);
  },

  async addUserCredits(userId: string, credits = 3): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const used = Math.max(0, user.monthlyScansUsed - credits);
    const updated = await one<User>(supabase.from('users').update({ monthly_scans_used: used }).eq('id', userId).select('*').single(), 'add credits');
    await addSecurityLog({ event: 'CREDITS_UPDATED', severity: 'info', details: `Added ${credits} scan credits to user ${user.email}.`, targetUserId: userId });
    return enforceOwner(updated!);
  },

  async recordUserSessionPing(userId: string, seconds = 30, _page = 'workspace'): Promise<void> {
    if (!userId || userId.startsWith('guest_')) return;
    const { error } = await supabase.rpc('record_session_ping', { p_user_id: userId, p_seconds: seconds });
    fail(error, 'record session ping');
  },

  async consumeIpBurstLimit(keyHash: string, maxRequests = 30, windowSeconds = 60): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const { data, error } = await supabase.rpc('consume_ip_burst_limit', {
      p_key_hash: keyHash,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    fail(error, 'consume shared IP rate limit');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('Supabase shared IP rate-limit function returned an invalid result.');
    }
    return {
      allowed: row.allowed,
      retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds) || windowSeconds),
    };
  },

  async getStats(): Promise<AdminAnalytics> {
    const [users, resumes, scans, applications, paymentsResult] = await Promise.all([
      many<User>(supabase.from('users').select('*'), 'stats users'),
      many<Resume>(supabase.from('resumes').select('*'), 'stats resumes'),
      many<JobScan>(supabase.from('job_scans').select('*'), 'stats scans'),
      many<ApplicationTracker>(supabase.from('applications').select('*'), 'stats applications'),
      supabase.from('manual_payment_records').select('amount_inr'),
    ]);
    fail(paymentsResult.error, 'stats verified payments');
    const payments = paymentsResult.data || [];
    const pro = users.filter((user) => user.currentPlan === 'PRO').length;
    const applicationsByStatus: Record<string, number> = { SAVED: 0, APPLIED: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 };
    for (const application of applications) applicationsByStatus[application.status] = (applicationsByStatus[application.status] || 0) + 1;
    const scansByRole: Record<string, number> = {};
    for (const scan of scans) scansByRole[scan.jobTitle || 'General Engineering'] = (scansByRole[scan.jobTitle || 'General Engineering'] || 0) + 1;
    const totalTimeSpentSeconds = users.reduce((total, user) => total + (user.totalTimeSpentSeconds || 0), 0);
    return {
      totalUsers: users.length,
      activeProMembers: pro,
      confirmedRevenueInr: payments.reduce((total, payment) => total + Number(payment.amount_inr || 0), 0),
      confirmedPaymentCount: payments.length,
      freeMembers: users.length - pro,
      bannedUsers: users.filter((user) => user.isBanned).length,
      adminUsers: users.filter((user) => user.isAdmin || user.role === 'OWNER' || user.role === 'ADMIN').length,
      proAdoptionRate: users.length ? Math.round((pro / users.length) * 100) : 0,
      totalScansPerformed: scans.length,
      totalDocumentsParsed: resumes.length,
      totalApplicationsTracked: applications.length,
      avgAtsScore: scans.length ? Math.round(scans.reduce((sum, scan) => sum + scan.matchScore, 0) / scans.length) : 0,
      totalTimeSpentSeconds,
      avgSessionDurationMinutes: users.length ? Math.round(totalTimeSpentSeconds / users.length / 60) : 0,
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

  async getLLMConfigs(): Promise<LLMConfig[]> {
    return many<LLMConfig>(supabase.from('llm_configs').select('*').order('created_at'), 'list model configs');
  },

  async addLLMConfig(data: Omit<LLMConfig, 'id' | 'createdAt'>): Promise<LLMConfig> {
    const config = { ...data, id: `llm_${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString() };
    const { data: row, error } = await supabase.from('llm_configs').insert(toRow(config)).select('*').single();
    fail(error, 'create model config');
    return fromRow<LLMConfig>(row)!;
  },

  async updateLLMConfig(id: string, updates: Partial<LLMConfig>): Promise<LLMConfig> {
    const { data, error } = await supabase.from('llm_configs').update(toRow(updates)).eq('id', id).select('*').maybeSingle();
    fail(error, 'update model config');
    const config = fromRow<LLMConfig>(data);
    if (!config) throw new Error(`LLM configuration not found: ${id}`);
    return config;
  },

  async deleteLLMConfig(id: string): Promise<boolean> {
    const { data, error } = await supabase.from('llm_configs').delete().eq('id', id).select('id');
    fail(error, 'delete model config');
    return Boolean(data?.length);
  },

  async getTaskBindings(): Promise<Record<string, TaskBinding>> {
    const rows = await many<TaskBinding>(supabase.from('task_bindings').select('*'), 'list task bindings');
    return Object.fromEntries(rows.map((row) => [row.task, row]));
  },

  async saveTaskBinding(task: string, primaryModelId: string, fallbackModelId: string): Promise<TaskBinding> {
    const existing = await one<TaskBinding>(supabase.from('task_bindings').select('*').eq('task', task).maybeSingle(), 'get task binding');
    const binding: TaskBinding = { task: task as TaskBinding['task'], taskLabel: existing?.taskLabel || task, primaryModelId, fallbackModelId };
    const { data, error } = await supabase.from('task_bindings').upsert(toRow(binding), { onConflict: 'task' }).select('*').single();
    fail(error, 'save task binding');
    await addSecurityLog({ event: 'LLM_ROUTED', severity: 'info', details: `Task binding for '${task}' updated to primary: ${primaryModelId}, fallback: ${fallbackModelId}.` });
    return fromRow<TaskBinding>(data)!;
  },

  async getSystemSettings(): Promise<SystemSettings> {
    const current = await one<SystemSettings>(supabase.from('system_settings').select('*').eq('id', 'singleton').maybeSingle(), 'get system settings');
    if (current) return current;
    const { data, error } = await supabase.from('system_settings').insert(toRow({ id: 'singleton', ...DEFAULT_SETTINGS })).select('*').single();
    fail(error, 'initialize system settings');
    return fromRow<SystemSettings>(data)!;
  },

  async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSystemSettings();
    const merged = { ...current, ...updates };
    const { data, error } = await supabase.from('system_settings').upsert(toRow({ id: 'singleton', ...merged }), { onConflict: 'id' }).select('*').single();
    fail(error, 'update system settings');
    return fromRow<SystemSettings>(data)!;
  },

  async getSecurityLogs(limit = 50): Promise<SecurityLog[]> {
    return many<SecurityLog>(supabase.from('security_logs').select('*').order('timestamp', { ascending: false }).limit(limit), 'list security logs');
  },

  async recordManualPayment(input: {
    id: string;
    userId: string;
    amountInr: number;
    paymentMethod: 'upi' | 'bank_transfer' | 'cash' | 'other';
    transactionReference: string;
    paymentRequestReference: string;
    requiredAmountInr: number;
    note: string;
    recordedBy: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.rpc('record_manual_payment', {
      p_id: input.id,
      p_user_id: input.userId,
      p_amount_inr: input.amountInr,
      p_payment_method: input.paymentMethod,
      p_transaction_reference: input.transactionReference,
      p_payment_request_reference: input.paymentRequestReference,
      p_required_amount_inr: input.requiredAmountInr,
      p_note: input.note,
      p_recorded_by: input.recordedBy,
    });
    fail(error, 'record manual payment');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Supabase did not return the recorded payment.');
    return row as Record<string, unknown>;
  },

  async getManualPaymentTotalForRequest(paymentRequestReference: string, userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('manual_payment_records')
      .select('amount_inr')
      .eq('payment_request_reference', paymentRequestReference)
      .eq('user_id', userId);
    fail(error, 'sum verified payments for request');
    return (data || []).reduce((sum, row) => sum + Number(row.amount_inr || 0), 0);
  },

  addSecurityLog,

  async incrementScanUsage(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const { data, error } = await supabase.rpc('consume_scan_quota', { p_user_id: userId });
    fail(error, 'consume scan quota');
    const result = Array.isArray(data) ? data[0] : data;
    return { allowed: Boolean(result?.allowed), remaining: Number(result?.remaining || 0) };
  },

  async downgradeToFree(userId: string): Promise<User> {
    const user = await one<User>(supabase.from('users').update({ current_plan: 'FREE' }).eq('id', userId).select('*').maybeSingle(), 'downgrade user');
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  },

  async deleteUser(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('users').delete().eq('id', userId).select('id');
    fail(error, 'delete user');
    return Boolean(data?.length);
  },

  async createResume(data: Omit<Resume, 'id' | 'createdAt'>): Promise<Resume> {
    const resume = { ...data, id: `res_${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    const { data: row, error } = await supabase.from('resumes').insert(toRow(resume)).select('*').single();
    fail(error, 'create resume');
    return fromRow<Resume>(row)!;
  },

  async getResume(id: string): Promise<Resume | null> {
    return one<Resume>(supabase.from('resumes').select('*').eq('id', id).maybeSingle(), 'get resume');
  },

  async updateResume(id: string, updates: Partial<Resume>): Promise<Resume | null> {
    return one<Resume>(supabase.from('resumes').update(toRow(updates)).eq('id', id).select('*').maybeSingle(), 'update resume');
  },

  async getResumesByUser(userId: string): Promise<Resume[]> {
    return many<Resume>(supabase.from('resumes').select('*').eq('user_id', userId).order('created_at', { ascending: false }), 'list user resumes');
  },

  async createJobScan(data: Omit<JobScan, 'id' | 'createdAt'>): Promise<JobScan> {
    const scan = { ...data, id: `scan_${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    const { data: row, error } = await supabase.from('job_scans').insert(toRow(scan)).select('*').single();
    fail(error, 'create scan');
    return fromRow<JobScan>(row)!;
  },

  async getJobScan(id: string): Promise<JobScan | null> {
    return one<JobScan>(supabase.from('job_scans').select('*').eq('id', id).maybeSingle(), 'get scan');
  },

  async getJobScansByUser(userId: string): Promise<JobScan[]> {
    return many<JobScan>(supabase.from('job_scans').select('*').eq('user_id', userId).order('created_at', { ascending: false }), 'list user scans');
  },

  async updateJobScan(id: string, updates: Partial<JobScan>): Promise<JobScan | null> {
    return one<JobScan>(supabase.from('job_scans').update(toRow(updates)).eq('id', id).select('*').maybeSingle(), 'update scan');
  },

  async createApplication(data: Omit<ApplicationTracker, 'id' | 'createdAt'>): Promise<ApplicationTracker> {
    return assertNoPendingMigration('create application', async () => {
      const application = { ...data, id: `app_${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
      const { data: row, error } = await supabase.from('applications').insert(toRow(application)).select('*').single();
      fail(error, 'create application');
      return fromRow<ApplicationTracker>(row)!;
    });
  },

  async getApplicationsByUser(userId: string): Promise<ApplicationTracker[]> {
    return many<ApplicationTracker>(supabase.from('applications').select('*').eq('user_id', userId).order('applied_date', { ascending: false }), 'list applications');
  },

  async updateApplication(id: string, userId: string, updates: Partial<ApplicationTracker>): Promise<ApplicationTracker | null> {
    return assertNoPendingMigration('update application', async () =>
      one<ApplicationTracker>(supabase.from('applications').update(toRow(updates)).eq('id', id).eq('user_id', userId).select('*').maybeSingle(), 'update application')
    );
  },

  async deleteApplication(id: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('applications').delete().eq('id', id).eq('user_id', userId).select('id');
    fail(error, 'delete application');
    return Boolean(data?.length);
  },

  async migrateGuestData(guestId: string, authenticatedUserId: string): Promise<{ resumesMigrated: number; scansMigrated: number; applicationsMigrated: number }> {
    if (!guestId || !authenticatedUserId || guestId === authenticatedUserId) return { resumesMigrated: 0, scansMigrated: 0, applicationsMigrated: 0 };
    if (!/^guest_[A-Za-z0-9_-]+$/.test(guestId)) throw new Error('Invalid guest token.');
    const user = await this.getUser(authenticatedUserId);
    if (!user) throw new Error(`Cannot migrate to unknown user: ${authenticatedUserId}.`);
    const tables = [
      ['resumes', 'resumesMigrated'],
      ['job_scans', 'scansMigrated'],
      ['applications', 'applicationsMigrated'],
    ] as const;
    const counts = { resumesMigrated: 0, scansMigrated: 0, applicationsMigrated: 0 };
    for (const [table, countKey] of tables) {
      const { data, error } = await supabase.from(table).update({ user_id: authenticatedUserId }).eq('user_id', guestId).select('id');
      fail(error, `migrate guest ${table}`);
      counts[countKey] = data?.length || 0;
    }
    await addSecurityLog({ event: 'GUEST_MIGRATED', severity: 'info', details: `Guest session ${guestId} merged into ${authenticatedUserId}.`, targetUserId: authenticatedUserId });
    return counts;
  },
};

export { supabase };
