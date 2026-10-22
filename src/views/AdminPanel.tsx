import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  CreditCard,
  Activity,
  Zap,
  Search,
  RefreshCw,
  Plus,
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Clock,
  Sliders,
  ShieldAlert,
  Trash2,
  Edit3,
  Ban,
  BarChart3,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useDialogA11y } from '../hooks/useDialogA11y.js';
import { hasAdminPrivileges, isOwnerEmail, FREE_SCAN_LIMIT, PRO_PRICE_INR } from '../config.js';
import { ConfirmPromptDialog } from '../components/ConfirmPromptDialog.js';

interface AdminUser {
  id: string;
  email: string;
  displayName?: string | null;
  authProviderId: string | null;
  currentPlan: 'FREE' | 'PRO';
  monthlyScansUsed: number;
  creditResetDate: string;
  isAdmin?: boolean;
  role?: 'OWNER' | 'ADMIN' | 'USER';
  isBanned?: boolean;
  banReason?: string;
  totalTimeSpentSeconds?: number;
  lastActiveAt?: string;
  createdAt: string;
}

interface LLMConfig {
  id: string;
  name: string;
  provider: 'groq' | 'gemini' | 'openai' | 'anthropic' | 'custom';
  modelId: string;
  apiKeyEnv?: string;
  contextWindow: string;
  latencyTier: 'sub-second' | 'standard' | 'deep-reasoning';
  enabled: boolean;
  supported?: boolean;
  configured?: boolean;
  usedBy?: string[];
  createdAt: string;
}

interface TaskBinding {
  task: 'score' | 'tailor' | 'cover_letter' | 'star_bullet' | 'resume_parse';
  taskLabel: string;
  primaryModelId: string;
  fallbackModelId: string;
}

interface SystemSettings {
  promptInjectionShield: boolean;
  maxUploadSizeMb: number;
  freeTierMonthlyLimit: number;
  proPriceInr: number;
  rateLimitWindowDays: number;
  maintenanceMode: boolean;
  allowedFileExtensions: string[];
}

interface SecurityLog {
  id: string;
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'critical';
  details: string;
  ip?: string;
  actorEmail?: string;
  targetUserId?: string;
}

interface SystemHealth {
  status: string;
  uptime: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  memoryRssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  pid: number;
  services: Array<{ name: string; status: string; latencyMs: number }>;
}

interface AdminStats {
  totalUsers: number;
  activeProMembers: number;
  confirmedRevenueInr: number;
  confirmedPaymentCount: number;
  freeMembers: number;
  bannedUsers: number;
  adminUsers: number;
  proAdoptionRate: number;
  totalDocumentsParsed: number;
  totalScansPerformed: number;
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

interface AdminPanelProps {
  onBackToWorkspace: () => void;
}

/**
 * Tasks the server actually dispatches through `runModel` (only `tailor` in
 * server.ts and `tailor`/`cover_letter` in lib/queue.ts). The registry also
 * stores `score`, `star_bullet` and `resume_parse` bindings so a future LLM
 * path can adopt them, but scoring, parsing and STAR suggestions are computed
 * deterministically today and never call a model.
 */
const RUNTIME_LIVE_TASKS = new Set(['tailor', 'cover_letter']);

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToWorkspace }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'users' | 'llms' | 'security' | 'monitoring' | 'settings'
  >('analytics');

  // Core Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [llms, setLlms] = useState<LLMConfig[]>([]);
  const [bindings, setBindings] = useState<Record<string, TaskBinding>>({});
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [confirmingPaymentRequest, setConfirmingPaymentRequest] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ amountInr: String(PRO_PRICE_INR), method: 'upi', transactionReference: '', note: '' });

  /**
   * Replaces window.prompt / window.confirm. Those native dialogs cannot be
   * styled, escape the app's focus-trap contract, and are blocked outright in
   * some embedded browsers — where a blocked prompt used to be coerced into a
   * default ban reason instead of aborting.
   */
  const [adminDialog, setAdminDialog] = useState<
    | { kind: 'ban'; userId: string; email: string }
    | { kind: 'deleteUser'; userId: string; email: string }
    | { kind: 'deleteLlm'; llmId: string; name: string }
    | null
  >(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'pro' | 'free' | 'admin' | 'banned'>('all');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  // Per-endpoint failure reason, so a missing panel can say why it is empty
  // instead of showing invented values.
  const [endpointErrors, setEndpointErrors] = useState<Record<string, string>>({});

  /*
   * Pending Pro upgrade requests, derived from the audit log rather than a
   * dedicated table. `security_logs.event` is free-text with no CHECK
   * constraint, so this needs no database migration — and an audit trail is
   * exactly where a payment request belongs.
   */
  const upgradeRequests = useMemo(
    () =>
      securityLogs
        .filter((log) => log.event === 'PRO_UPGRADE_REQUESTED')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [securityLogs]
  );

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editFormData, setEditFormData] = useState<{
    displayName: string;
    currentPlan: 'FREE' | 'PRO';
    role: 'OWNER' | 'ADMIN' | 'USER';
    monthlyScansUsed: number;
    isBanned: boolean;
    banReason: string;
  }>({
    displayName: '',
    currentPlan: 'FREE',
    role: 'USER',
    monthlyScansUsed: 0,
    isBanned: false,
    banReason: '',
  });

  // Add LLM Modal
  const [showAddLLMModal, setShowAddLLMModal] = useState(false);
  const [newLLMData, setNewLLMData] = useState<{
    name: string;
    provider: 'groq' | 'gemini' | 'openai' | 'anthropic';
    modelId: string;
    contextWindow: string;
    latencyTier: 'sub-second' | 'standard' | 'deep-reasoning';
  }>({
    name: '',
    provider: 'groq',
    modelId: '',
    contextWindow: '128k',
    latencyTier: 'standard',
  });

  // Privileges are decided by the server from the signed session cookie, never
  // from client-supplied headers or an email string comparison.
  const isOwnerOrAdmin = hasAdminPrivileges(user);

  // Timer kept in a ref: a second toast clears the first timer instead of
  // stacking, and the timer never outlives the component.
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    if (toastTimerRef.current !== undefined) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setFeedbackMessage(null), 3500);
  };

  useEffect(
    () => () => {
      if (toastTimerRef.current !== undefined) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Focus trap + Escape for both admin dialogs, matching every other dialog in
  // the app. Without these, keyboard users tab into the inert page behind the
  // overlay.
  const editUserModalRef = useDialogA11y(!!editingUser, () => setEditingUser(null));
  const addLlmModalRef = useDialogA11y<HTMLFormElement>(showAddLLMModal, () => setShowAddLLMModal(false));

  // Authorization travels in the httpOnly session cookie the browser already
  // sends. Sending identity headers (previously defaulting to the owner) made
  // the admin API trivially spoofable.
  const getAuthHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
  });

  const fetchAdminData = async () => {
    if (!isOwnerOrAdmin) return;
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      // Settled, not all-or-nothing: one failing endpoint must not leave the whole
      // panel silently half-populated with no user-visible explanation.
      const endpoints = [
        { key: 'stats', url: '/api/admin/stats', pick: (d: any) => d.stats, apply: setStats },
        { key: 'users', url: '/api/admin/users', pick: (d: any) => d.users || [], apply: setUsers },
        { key: 'llms', url: '/api/admin/llms', pick: (d: any) => d.llms || [], apply: setLlms },
        { key: 'bindings', url: '/api/admin/llm-bindings', pick: (d: any) => d.bindings || {}, apply: setBindings },
        { key: 'settings', url: '/api/admin/settings', pick: (d: any) => d.settings, apply: setSettings },
        { key: 'health', url: '/api/admin/system-health', pick: (d: any) => d.health, apply: setHealth },
        { key: 'logs', url: '/api/admin/security-logs', pick: (d: any) => d.logs || [], apply: setSecurityLogs },
      ] as const;

      const results = await Promise.allSettled(
        endpoints.map(async (ep) => {
          const res = await fetch(ep.url, { headers });
          if (!res.ok) throw new Error(`${ep.key}: HTTP ${res.status}`);
          return (await res.json()) as any;
        })
      );

      const failures: string[] = [];
      const reasons: Record<string, string> = {};
      results.forEach((result, i) => {
        const ep = endpoints[i];
        if (result.status === 'fulfilled') {
          ep.apply(result.value ? ep.pick(result.value) : undefined as any);
        } else {
          failures.push(ep.key);
          reasons[ep.key] =
            result.reason instanceof Error ? result.reason.message : 'Request failed';
        }
      });

      setLoadErrors(failures);
      setEndpointErrors(reasons);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setLoadErrors(['admin data']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwnerOrAdmin) {
      fetchAdminData();
    }
  }, [isOwnerOrAdmin, user]);

  // Periodic health ping
  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/system-health', { headers: getAuthHeaders() });
        if (res.ok) {
          const d = await res.json();
          setHealth(d.health);
          setEndpointErrors((prev) => {
            if (!prev.health) return prev;
            const { health: _dropped, ...rest } = prev;
            return rest;
          });
        } else {
          // Drop the reading rather than leaving stale numbers on screen that
          // look like a live, healthy system.
          setHealth(null);
          setEndpointErrors((prev) => ({
            ...prev,
            health: `HTTP ${res.status}`,
          }));
        }
      } catch (err) {
        setHealth(null);
        setEndpointErrors((prev) => ({
          ...prev,
          health: err instanceof Error ? err.message : 'Request failed',
        }));
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isOwnerOrAdmin]);

  // ==========================================
  // USER ACTIONS
  // ==========================================

  const handleTogglePro = async (targetUserId: string) => {
    setActionLoading(`pro-${targetUserId}`);
    try {
      const res = await fetch('/api/admin/toggle-pro', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, currentPlan: data.user.currentPlan } : u))
        );
        showToast(`Plan updated for ${data.user.email} -> ${data.user.currentPlan}`);
        fetchAdminData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not update plan (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not update plan. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmPayment = async (request: SecurityLog, paymentRequestReference: string) => {
    if (!request.targetUserId) return;
    setPaymentSaving(true);
    try {
      const res = await fetch('/api/admin/confirm-payment', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: request.targetUserId,
          paymentRequestReference,
          amountInr: Number(paymentDraft.amountInr),
          paymentMethod: paymentDraft.method,
          transactionReference: paymentDraft.transactionReference,
          note: paymentDraft.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not record payment (HTTP ${res.status}).`);
      const received = Number(data.totalReceivedInr || 0).toLocaleString('en-IN');
      showToast(data.proActivated
        ? `₹${received} verified for this request; Pro activated for ${data.user?.email || request.actorEmail || 'user'}.`
        : `₹${received} recorded. Pro activates after verified payments reach ₹${Number(data.requiredAmountInr || PRO_PRICE_INR).toLocaleString('en-IN')}.`);
      setConfirmingPaymentRequest(null);
      setPaymentDraft({ amountInr: String(PRO_PRICE_INR), method: 'upi', transactionReference: '', note: '' });
      fetchAdminData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleToggleAdmin = async (targetUserId: string, currentIsAdmin: boolean) => {
    setActionLoading(`admin-${targetUserId}`);
    try {
      const res = await fetch('/api/admin/toggle-admin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: targetUserId, isAdmin: !currentIsAdmin }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, isAdmin: data.user.isAdmin, role: data.user.role } : u))
        );
        showToast(`User ${data.user.email} is now ${data.user.isAdmin ? 'an Administrator' : 'a Candidate'}`);
        fetchAdminData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not change role (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not change role. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBan = (targetUserId: string, currentlyBanned: boolean, targetEmail: string) => {
    // Reinstating needs no reason; suspending collects one in the dialog.
    if (currentlyBanned) {
      void performToggleBan(targetUserId, true, '');
      return;
    }
    setAdminDialog({ kind: 'ban', userId: targetUserId, email: targetEmail });
  };

  const performToggleBan = async (targetUserId: string, currentlyBanned: boolean, reason: string) => {
    setActionLoading(`ban-${targetUserId}`);
    try {
      const res = await fetch('/api/admin/ban-user', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: targetUserId, isBanned: !currentlyBanned, banReason: reason }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, isBanned: data.user.isBanned, banReason: data.user.banReason } : u))
        );
        showToast(data.user.isBanned ? `User ${data.user.email} suspended.` : `User ${data.user.email} reinstated.`);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update ban status');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddCredits = async (targetUserId: string, count: number = FREE_SCAN_LIMIT) => {
    setActionLoading(`credits-${targetUserId}`);
    try {
      const res = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: targetUserId, credits: count }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, monthlyScansUsed: data.user.monthlyScansUsed } : u))
        );
        showToast(`Added ${count} scan credits to ${data.user.email}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not add credits (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not add credits. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = (targetUserId: string, targetEmail: string) => {
    setAdminDialog({ kind: 'deleteUser', userId: targetUserId, email: targetEmail });
  };

  const performDeleteUser = async (targetUserId: string, targetEmail: string) => {
    setActionLoading(`del-${targetUserId}`);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== targetUserId));
        showToast(`User ${targetEmail} removed.`);
        fetchAdminData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not delete user (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not delete user. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (targetUser: AdminUser) => {
    setEditingUser(targetUser);
    setEditFormData({
      displayName: targetUser.displayName || '',
      currentPlan: targetUser.currentPlan,
      role: targetUser.role || 'USER',
      monthlyScansUsed: targetUser.monthlyScansUsed,
      isBanned: !!targetUser.isBanned,
      banReason: targetUser.banReason || '',
    });
  };

  const saveEditUser = async () => {
    if (!editingUser) return;
    setActionLoading('save-edit');
    try {
      const res = await fetch('/api/admin/edit-user', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: editingUser.id,
          updates: {
            displayName: editFormData.displayName,
            currentPlan: editFormData.currentPlan,
            role: editFormData.role,
            isAdmin: editFormData.role === 'ADMIN' || editFormData.role === 'OWNER',
            monthlyScansUsed: Number(editFormData.monthlyScansUsed),
            isBanned: editFormData.isBanned,
            banReason: editFormData.banReason,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
        setEditingUser(null);
        showToast(`Updated profile for ${data.user.email}`);
        fetchAdminData();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to update user');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================================
  // LLM & BINDINGS ACTIONS
  // ==========================================

  const handleSaveBinding = async (task: string, primaryModelId: string, fallbackModelId: string) => {
    setActionLoading(`bind-${task}`);
    try {
      const res = await fetch('/api/admin/llm-bindings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ task, primaryModelId, fallbackModelId }),
      });
      if (res.ok) {
        const data = await res.json();
        setBindings((prev) => ({ ...prev, [task]: data.binding }));
        showToast(`Task binding updated: ${data.binding.taskLabel}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not save binding (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not save binding. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLLMStatus = async (llmId: string, currentEnabled: boolean) => {
    setActionLoading(`llm-toggle-${llmId}`);
    try {
      const res = await fetch(`/api/admin/llms/${llmId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setLlms((prev) => prev.map((item) => (item.id === llmId ? data.llm : item)));
        showToast(`LLM ${data.llm.name} ${data.llm.enabled ? 'Enabled' : 'Disabled'}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not update LLM (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not update LLM. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLLMData.name || !newLLMData.modelId) return;
    setActionLoading('create-llm');
    try {
      const res = await fetch('/api/admin/llms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newLLMData),
      });
      if (res.ok) {
        const data = await res.json();
        setLlms((prev) => [...prev, data.llm]);
        setShowAddLLMModal(false);
        setNewLLMData({
          name: '',
          provider: 'groq',
          modelId: '',
          contextWindow: '128k',
          latencyTier: 'standard',
        });
        showToast(`New LLM registered: ${data.llm.name}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not register LLM (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not register LLM. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteLLM = (llmId: string, name: string) => {
    setAdminDialog({ kind: 'deleteLlm', llmId, name });
  };

  const performDeleteLLM = async (llmId: string, name: string) => {
    setActionLoading(`del-llm-${llmId}`);
    try {
      const res = await fetch(`/api/admin/llms/${llmId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLlms((prev) => prev.filter((item) => item.id !== llmId));
        showToast(`Removed LLM: ${name}`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not remove LLM (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not remove LLM. Network error.');
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================================
  // SYSTEM SETTINGS ACTIONS
  // ==========================================

  // `!currentVal` coerced every numeric setting to `false`, so the limit/price
  // inputs POSTed a boolean and silently never persisted. Invert booleans
  // only, and pass anything else through unchanged.
  const handleToggleSetting = async (key: keyof SystemSettings, currentVal: unknown) => {
    if (!settings) return;
    setActionLoading(`set-${key}`);
    const updated: Record<string, unknown> = {
      [key]: typeof currentVal === 'boolean' ? !currentVal : currentVal,
    };
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
        showToast(`Setting '${key}' updated`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Could not update '${key}' (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      showToast(`Could not update '${key}'. Network error.`);
    } finally {
      setActionLoading(null);
    }
  };

  // If user is not authenticated as admin, show access restricted view
  if (!isOwnerOrAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="glass-panel p-8 sm:p-12 rounded-2xl !bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_20px_50px_rgba(11,37,69,0.08)] space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-surface text-[#0B2545] flex items-center justify-center mx-auto border border-line">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-surface text-[#0B2545] border border-line-strong">
              Access Restricted
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
              System Owner & Admin Verification Required
            </h1>
            <p className="text-xs sm:text-sm text-[#334E68] max-w-md mx-auto leading-relaxed">
              This route is protected by administrative role-based access rules. Only accounts with
              verified admin privileges are granted access.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onBackToWorkspace}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider text-[#334E68] bg-surface hover:bg-line border border-line transition-colors cursor-pointer"
            >
              Return to Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.role && u.role.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterPlan === 'pro') return u.currentPlan === 'PRO';
    if (filterPlan === 'free') return u.currentPlan === 'FREE';
    if (filterPlan === 'admin') return u.isAdmin || u.role === 'OWNER';
    if (filterPlan === 'banned') return !!u.isBanned;
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 min-w-0">
      {loadErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-xs text-warning-strong"
        >
          <strong className="font-bold">Some panels could not be loaded:</strong>{' '}
          {loadErrors.join(', ')}. The server may have restarted, or your session may have
          expired. Use refresh to retry.
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={onBackToWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-blue-deep transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Workspace</span>
            </button>
            <span className="text-line-strong">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#627D98]">
              Platform Command Center
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk'] tracking-tight">
              Admin & Operations Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-surface text-[#0B2545] border border-line-strong shadow-2xs flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Admin Session</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#334E68] mt-1">
            Signed in as <span className="font-mono font-bold text-[#1D4ED8]">{user?.email}</span> (Role: {user?.role || 'OWNER'})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-[#0B2545] text-xs font-semibold shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Refresh stats and users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1D4ED8]' : ''}`} />
            <span>Sync Live Data</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-ink text-white text-xs font-medium flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-line-steel hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ADMIN TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-line">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics & Time</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('llms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'llms'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>LLM Models & Bindings</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Security & Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'monitoring'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-[#0B2545] text-white shadow-xs'
              : 'text-[#334E68] hover:bg-surface'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>App Settings</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ANALYTICS & TIME SPENT */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in">
          {/* KPI CARDS (Cohesive color palette) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Card 1: Total Users & Pro Conversion */}
            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-[0_8px_24px_rgba(11,37,69,0.04)] space-y-1">
              <div className="flex items-center justify-between text-[#627D98]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Users</span>
                <Users className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                {stats?.totalUsers ?? users.length}
              </div>
              <div className="text-[11px] text-[#334E68] flex items-center gap-1 font-semibold">
                <span>{stats?.activeProMembers ?? users.filter((u) => u.currentPlan === 'PRO').length} Active Pro</span>
                <span className="text-line-strong">•</span>
                <span>{stats?.proAdoptionRate ?? 0}% Rate</span>
              </div>
            </div>

            {/* Card 2: Pro accounts */}
            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-[0_8px_24px_rgba(11,37,69,0.04)] space-y-1">
              <div className="flex items-center justify-between text-[#627D98]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pro Access</span>
                <CreditCard className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                {stats ? stats.activeProMembers : 'Not available'}
              </div>
              <div className="text-[11px] text-[#627D98]">
                Plan status only; it does not confirm payment
              </div>
            </div>

            {/* Confirmed receipts, not active Pro flags or upgrade requests. */}
            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-[0_8px_24px_rgba(11,37,69,0.04)] space-y-1">
              <div className="flex items-center justify-between text-[#627D98]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Verified Revenue</span>
                <CreditCard className="w-4 h-4 text-success" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                ₹{(stats?.confirmedRevenueInr ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-[#627D98]">
                {stats?.confirmedPaymentCount ?? 0} admin-verified receipt{stats?.confirmedPaymentCount === 1 ? '' : 's'} recorded
              </div>
            </div>

            {/* Card 3: User Time Spent */}
            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-[0_8px_24px_rgba(11,37,69,0.04)] space-y-1">
              <div className="flex items-center justify-between text-[#627D98]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Session Time</span>
                <Clock className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                {stats ? `${stats.avgSessionDurationMinutes} min` : 'Not available'}
              </div>
              <div className="text-[11px] text-[#334E68]">
                {stats
                  ? `${Math.round(stats.totalTimeSpentSeconds / 60)} min total engagement`
                  : 'Stats endpoint did not respond'}
              </div>
            </div>

            {/* Card 4: Average keyword overlap */}
            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-[0_8px_24px_rgba(11,37,69,0.04)] space-y-1">
              <div className="flex items-center justify-between text-[#627D98]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg ATS Score</span>
                <Zap className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                {stats ? `${stats.avgAtsScore}%` : 'Not available'}
              </div>
              <div className="text-[11px] text-[#334E68]">
                {stats
                  ? `Blended coverage + vocabulary, across ${stats.totalScansPerformed} scans`
                  : 'Stats endpoint did not respond'}
              </div>
            </div>
          </div>

          {/* Secondary Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Scans by Target Role Breakdown */}
            <div className="glass-panel p-5 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-surface pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                  Scans by Target Role
                </span>
                <span className="text-[11px] text-[#627D98]">Real Volume</span>
              </div>
              <div className="space-y-2">
                {stats?.scansByRole && Object.keys(stats.scansByRole).length > 0 ? (
                  Object.entries(stats.scansByRole).slice(0, 5).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between text-xs">
                      <span className="text-[#334E68] font-medium truncate max-w-[200px]">{role}</span>
                      <span className="font-mono font-bold text-[#0B2545] bg-surface px-2 py-0.5 rounded-md">
                        {count} {count === 1 ? 'scan' : 'scans'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#627D98] py-4 text-center">No scans recorded yet.</div>
                )}
              </div>
            </div>

            {/* Application Pipeline Status */}
            <div className="glass-panel p-5 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-surface pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                  Application Pipeline
                </span>
                <span className="text-[11px] text-[#627D98]">
                  {stats?.totalApplicationsTracked ?? 0} Tracked
                </span>
              </div>
              <div className="space-y-2">
                {['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].map((stage) => {
                  const count = stats?.applicationsByStatus?.[stage] || 0;
                  return (
                    <div key={stage} className="flex items-center justify-between text-xs">
                      <span className="text-[#334E68] font-medium capitalize">{stage.toLowerCase()}</span>
                      <span className="font-mono font-bold text-[#0B2545] bg-surface px-2 py-0.5 rounded-md">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LLM Token & Cost Utilization */}
            <div className="glass-panel p-5 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-surface pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0B2545]">
                  Estimated AI Usage
                </span>
                  <span className="text-[11px] font-mono text-[#627D98]">Not instrumented</span>
              </div>
                <p className="text-[10px] text-[#627D98]">
                  Provider token and cost telemetry is not connected.
                </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#627D98]">Total Tokens</span>
                  <span className="font-mono font-bold text-[#0B2545]">
                    Not instrumented
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#627D98]">Estimated Groq tokens</span>
                  <span className="font-mono text-[#334E68]">
                    Not instrumented
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#627D98]">Estimated Gemini tokens</span>
                  <span className="font-mono text-[#334E68]">
                    Not instrumented
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USER DIRECTORY & ACCESS CONTROL */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-2xl border border-line/80 shadow-[0_12px_32px_rgba(11,37,69,0.04)] space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk'] text-[#0B2545]">
                User Directory & Access Control
              </h2>
              <p className="text-xs text-[#627D98]">
                Promote any user to Admin or Pro, adjust credits, ban malicious accounts, or edit profiles.
              </p>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#627D98] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search email, name, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl text-xs border border-line bg-white focus:outline-none focus:border-[#1D4ED8] text-[#0B2545] w-48 sm:w-56"
                />
              </div>

              <div className="flex items-center p-1 rounded-xl bg-surface text-xs">
                {(['all', 'pro', 'free', 'admin', 'banned'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterPlan(mode)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                      filterPlan === mode
                        ? 'bg-white text-[#0B2545] shadow-2xs'
                        : 'text-[#627D98] hover:text-[#0B2545]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-line bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                  <th className="py-3 px-4">User / Candidate</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Plan</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Scans</th>
                  <th className="py-3 px-3">Time Spent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#627D98] italic">
                      No users match the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isOwner = isOwnerEmail(u.email);
                    return (
                      <tr key={u.id} className="hover:bg-canvas/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#0B2545]">{u.email}</div>
                          <div className="text-[11px] text-[#627D98] flex items-center gap-1.5">
                            {u.displayName && <span>{u.displayName}</span>}
                            <span className="font-mono text-[10px] text-line-steel">({u.id})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {isOwner ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-[#0B2545] border border-line-strong">
                              Owner
                            </span>
                          ) : u.isAdmin ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                              Admin
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-[#627D98]">
                              Candidate
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              u.currentPlan === 'PRO'
                                ? 'bg-blue-wash text-[#1D4ED8] border border-blue-pale font-bold'
                                : 'bg-surface text-[#627D98]'
                            }`}
                          >
                            {u.currentPlan}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          {u.isBanned ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-ink text-white">
                              Suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-[#334E68]">
                              Active
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 font-mono font-semibold text-[#0B2545]">
                          {u.currentPlan === 'PRO'
                            ? 'Unlimited'
                            : `${u.monthlyScansUsed}/${settings?.freeTierMonthlyLimit ?? FREE_SCAN_LIMIT}`}
                        </td>

                        <td className="py-3.5 px-3 text-[#334E68] text-[11px]">
                          {u.totalTimeSpentSeconds
                            ? `${Math.round(u.totalTimeSpentSeconds / 60)} min`
                            : 'No data'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Make Admin / Revoke Admin */}
                            {!isOwner && (
                              <button
                                onClick={() => handleToggleAdmin(u.id, !!u.isAdmin)}
                                disabled={actionLoading === `admin-${u.id}`}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  u.isAdmin
                                    ? 'bg-surface text-[#334E68] hover:bg-line'
                                    : 'bg-blue-wash text-[#1D4ED8] hover:bg-blue-wash border border-blue-pale'
                                }`}
                                title={u.isAdmin ? 'Revoke Admin' : 'Make Administrator'}
                              >
                                {u.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                            )}

                            {/* Toggle Pro */}
                            {!isOwner && (
                              <button
                                onClick={() => handleTogglePro(u.id)}
                                disabled={actionLoading === `pro-${u.id}`}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  u.currentPlan === 'PRO'
                                    ? 'bg-surface text-[#334E68] hover:bg-line'
                                    : 'bg-[#0B2545] text-white hover:bg-ink'
                                }`}
                              >
                                {u.currentPlan === 'PRO' ? 'Set Free' : 'Grant Pro'}
                              </button>
                            )}

                            {/* Ban / Unban */}
                            {!isOwner && (
                              <button
                                onClick={() => handleToggleBan(u.id, !!u.isBanned, u.email)}
                                disabled={actionLoading === `ban-${u.id}`}
                                className={`p-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  u.isBanned
                                    ? 'bg-ink-soft text-white'
                                    : 'bg-surface text-[#334E68] hover:bg-line'
                                }`}
                                title={u.isBanned ? 'Unban User' : 'Ban User'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Add scan credits */}
                            {u.currentPlan !== 'PRO' && (
                              <button
                                onClick={() => handleAddCredits(u.id)}
                                disabled={actionLoading === `credits-${u.id}`}
                                className="p-1.5 rounded-lg text-[10px] font-bold bg-surface text-[#0B2545] hover:bg-line cursor-pointer"
                                title={`Add ${FREE_SCAN_LIMIT} scan credits`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit Modal Button */}
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-[10px] font-bold bg-surface text-[#0B2545] hover:bg-line cursor-pointer"
                              title="Edit user details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User */}
                            {!isOwner && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                disabled={actionLoading === `del-${u.id}`}
                                className="p-1.5 rounded-lg text-[10px] font-bold text-line-steel hover:text-ink cursor-pointer"
                                title="Delete user permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LLM MODELS & DYNAMIC TASK BINDINGS */}
      {/* ========================================================================= */}
      {activeTab === 'llms' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk'] text-[#0B2545]">
                LLM Registry & Runtime Task Bindings
              </h2>
              <p className="text-xs text-[#627D98]">
                Bind supported models to tasks. A server-side provider key is required before a model can run.
                Only tasks marked <span className="font-semibold">Live</span> are dispatched at runtime;
                <span className="font-semibold"> Reserved</span> bindings are stored for a future model path
                (scoring, parsing and STAR suggestions are computed deterministically today).
              </p>
            </div>

            <button
              onClick={() => setShowAddLLMModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#0B2545] to-[#1D4ED8] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 w-fit"
            >
              <Plus className="w-4 h-4" />
              <span>Add New LLM</span>
            </button>
          </div>

          {/* Task Bindings Section */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-surface pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1D4ED8]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2545]">
                  Dynamic Task Bindings (Orchestration Router)
                </h3>
              </div>
              <span className="text-[11px] text-[#627D98]">Instant Server-side Dispatch</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(bindings).map(([taskKey, binding]) => (
                <div key={taskKey} className="p-4 rounded-xl bg-canvas/80 border border-line/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#0B2545] text-xs">{binding.taskLabel}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={
                          RUNTIME_LIVE_TASKS.has(taskKey)
                            ? 'px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-success/15 text-success border border-success/30'
                            : 'px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-surface text-[#627D98] border border-line'
                        }
                        title={
                          RUNTIME_LIVE_TASKS.has(taskKey)
                            ? 'Invoked by the server when a job is tailored'
                            : 'Stored in the registry but never invoked at runtime'
                        }
                      >
                        {RUNTIME_LIVE_TASKS.has(taskKey) ? 'Live' : 'Reserved'}
                      </span>
                      <span className="font-mono text-[10px] text-[#627D98] uppercase">{taskKey}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-[#627D98] block mb-1">
                        Primary Engine
                      </label>
                      <select
                        value={binding.primaryModelId}
                        onChange={(e) => handleSaveBinding(taskKey, e.target.value, binding.fallbackModelId)}
                        className="w-full p-1.5 rounded-lg border border-line bg-white text-xs font-semibold text-[#0B2545]"
                      >
                        {llms.filter((model) => model.enabled && model.configured && model.supported).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                        {!llms.some((model) => model.id === binding.primaryModelId && model.enabled && model.configured && model.supported) && (
                          <option value={binding.primaryModelId}>
                            {llms.find((model) => model.id === binding.primaryModelId)?.name || binding.primaryModelId} (unavailable)
                          </option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#627D98] block mb-1">
                        Fallback Engine
                      </label>
                      <select
                        value={binding.fallbackModelId}
                        onChange={(e) => handleSaveBinding(taskKey, binding.primaryModelId, e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-line bg-white text-xs font-semibold text-[#0B2545]"
                      >
                        {llms.filter((model) => model.enabled && model.configured && model.supported).map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                        {!llms.some((model) => model.id === binding.fallbackModelId && model.enabled && model.configured && model.supported) && (
                          <option value={binding.fallbackModelId}>
                            {llms.find((model) => model.id === binding.fallbackModelId)?.name || binding.fallbackModelId} (unavailable)
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configured Models Table */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2545]">
              Model Registry ({llms.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead>
                  <tr className="border-b border-line bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    <th className="py-2.5 px-3">Model Name</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Model Identifier</th>
                    <th className="py-2.5 px-3">Context</th>
                    <th className="py-2.5 px-3">Latency Tier</th>
                    <th className="py-2.5 px-3">Runtime Use</th>
                    <th className="py-2.5 px-3">Availability</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted">
                  {llms.map((m) => (
                    <tr key={m.id} className="hover:bg-canvas/50">
                      <td className="py-3 px-3 font-bold text-[#0B2545]">{m.name}</td>
                      <td className="py-3 px-3 uppercase text-[10px] font-semibold text-[#627D98]">{m.provider}</td>
                      <td className="py-3 px-3 font-mono text-[#334E68]">{m.modelId}</td>
                      <td className="py-3 px-3 font-mono text-[#334E68]">{m.contextWindow}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface text-[#334E68]">
                          {m.latencyTier}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#334E68]">
                        {m.usedBy?.length ? m.usedBy.join(', ') : 'Not bound'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface text-[#334E68] border border-line">
                          {!m.supported ? 'Unsupported provider' : !m.enabled ? 'Disabled' : m.configured ? 'Key configured' : 'Missing server key'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleLLMStatus(m.id, m.enabled)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-surface text-[#334E68] hover:bg-line cursor-pointer"
                          >
                            {m.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteLLM(m.id, m.name)}
                            className="p-1 rounded-lg text-line-steel hover:text-ink cursor-pointer"
                            title="Delete LLM"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & THREAT SHIELD */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Status Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B2545] text-xs">Prompt Injection Shield</span>
                <button
                  onClick={() => handleToggleSetting('promptInjectionShield', settings?.promptInjectionShield)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    settings?.promptInjectionShield
                      ? 'bg-blue-wash text-[#1D4ED8] border border-blue-pale'
                      : 'bg-surface text-[#627D98]'
                  }`}
                >
                  {settings?.promptInjectionShield ? 'Active' : 'Disabled'}
                </button>
              </div>
              <p className="text-[11px] text-[#627D98]">
                Regex interceptors block jailbreak tokens, system prompt overrides, and template injections.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B2545] text-xs">5MB Upload File Sandbox</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                  Enforced
                </span>
              </div>
              <p className="text-[11px] text-[#627D98]">
                Multer memory limiter rejects unapproved MIME types and files exceeding 5MB payload quota.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B2545] text-xs">Client Rate Limiter</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                  30 Req / Min
                </span>
              </div>
              <p className="text-[11px] text-[#627D98]">
                Dual-mode IP and session-based rate limiter prevents denial-of-service and brute force abuse.
              </p>
            </div>
          </div>

          {/*
            Pending Pro upgrade requests.

            These are read from the audit log written by
            POST /api/payments/request. The reference in each row is HMAC-signed,
            so a message typed by hand in Telegram cannot carry a valid one — that
            is what makes it safe to upgrade the account named in the row.
          */}
          {upgradeRequests.length > 0 && (
            <div className="rounded-2xl border border-[#93C5FD]/60 bg-blue-wash/40 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#93C5FD]/40 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#1D4ED8]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2545]">
                    Pro upgrade requests ({upgradeRequests.length})
                  </h3>
                </div>
                <span className="text-[11px] text-[#627D98]">Newest first</span>
              </div>

              <ul className="space-y-2">
                {upgradeRequests.map((request) => {
                  const requestReference = request.details.match(/Reference (RSA-(?:[A-Z2-7]{8}|[A-Z2-7]{16})-[A-F0-9]{10})\./)?.[1] || '';
                  return (
                  <li
                    key={request.id}
                    className="rounded-xl border border-line bg-white p-3.5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0B2545] break-all">
                        {request.actorEmail || 'unknown email'}
                      </p>
                      <p className="text-[11px] text-[#627D98] font-mono break-all mt-0.5">
                        uid: {request.targetUserId || '—'}
                      </p>
                      <p className="text-[11px] text-[#627D98] mt-0.5">
                        {new Date(request.timestamp).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-blue-core font-mono mt-0.5">
                        Payment request: {requestReference || 'reference unavailable'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(request.targetUserId || '')
                          .then(() => setCopiedUserId(request.targetUserId || ''))
                          .catch(() => {});
                      }}
                      className="shrink-0 rounded-lg border border-line bg-canvas px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0B2545] hover:bg-[#1D4ED8] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedUserId === (request.targetUserId || '') && request.targetUserId
                        ? 'Copied UID'
                        : 'Copy UID'}
                    </button>
                    {requestReference && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(requestReference).then(() => setCopiedUserId(requestReference)).catch(() => {});
                        }}
                        className="shrink-0 rounded-lg border border-blue-pale/70 bg-blue-wash/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-core hover:bg-blue-wash transition-colors cursor-pointer"
                      >
                        {copiedUserId === requestReference ? 'Copied reference' : 'Copy reference'}
                      </button>
                    )}
                    {requestReference && request.targetUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingPaymentRequest(confirmingPaymentRequest === request.id ? null : request.id);
                          setPaymentDraft({
                            amountInr: String(settings?.proPriceInr ?? PRO_PRICE_INR),
                            method: 'upi',
                            transactionReference: '',
                            note: '',
                          });
                        }}
                        className="shrink-0 rounded-lg bg-[#0B2545] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-blue-core cursor-pointer"
                      >
                        {confirmingPaymentRequest === request.id ? 'Close' : 'Record verified payment'}
                      </button>
                    )}
                    </div>
                    </div>
                    {confirmingPaymentRequest === request.id && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleConfirmPayment(request, requestReference);
                        }}
                        className="grid gap-3 rounded-xl border border-blue-pale/60 bg-blue-wash/30 p-3 sm:grid-cols-2"
                      >
                        <label className="text-[11px] font-semibold text-[#334E68]">
                          Amount actually received (INR)
                          <input
                            required min="1" step="1" type="number" inputMode="numeric"
                            value={paymentDraft.amountInr}
                            onChange={(event) => setPaymentDraft((draft) => ({ ...draft, amountInr: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-[#0B2545]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-[#334E68]">
                          Payment channel
                          <select
                            value={paymentDraft.method}
                            onChange={(event) => setPaymentDraft((draft) => ({ ...draft, method: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-[#0B2545]"
                          >
                            <option value="upi">UPI</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className="text-[11px] font-semibold text-[#334E68] sm:col-span-2">
                          Bank / UPI transaction reference or receipt ID
                          <input
                            required minLength={4} maxLength={128} autoComplete="off"
                            value={paymentDraft.transactionReference}
                            onChange={(event) => setPaymentDraft((draft) => ({ ...draft, transactionReference: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-[#0B2545]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-[#334E68] sm:col-span-2">
                          Note (optional)
                          <input
                            maxLength={500}
                            value={paymentDraft.note}
                            onChange={(event) => setPaymentDraft((draft) => ({ ...draft, note: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-[#0B2545]"
                          />
                        </label>
                        <p className="text-[11px] leading-relaxed text-[#627D98] sm:col-span-2">
                          Verify the receipt in your payment app first. Partial receipts are recorded, but Pro activates only after verified payments for this request reach the current monthly price. Duplicate transaction references are rejected.
                        </p>
                        <button
                          type="submit" disabled={paymentSaving}
                          className="rounded-lg bg-blue-core px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-deep disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
                        >
                          {paymentSaving ? 'Recording…' : 'Record payment and activate Pro'}
                        </button>
                      </form>
                    )}
                  </li>
                  );
                })}
              </ul>

              <p className="text-[11px] text-[#334E68] leading-relaxed border-t border-[#93C5FD]/40 pt-3">
                Telegram is only the contact channel. Verify the bank/UPI receipt and use
                <span className="font-bold"> Record verified payment</span> to activate Pro and
                include the exact amount in the revenue ledger. Changing a plan manually does not
                count as revenue.
              </p>
            </div>
          )}

          {/* Security Audit Log Table */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-surface pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#1D4ED8]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2545]">
                  Security Audit Events Log ({securityLogs.length})
                </h3>
              </div>
              <span className="text-[11px] text-[#627D98]">Recorded events</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead>
                  <tr className="border-b border-line bg-canvas/70 text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted">
                  {securityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#627D98]">
                        No security incidents logged.
                      </td>
                    </tr>
                  ) : (
                    securityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-canvas/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#627D98]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0B2545]">{log.event}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.severity === 'critical'
                                ? 'bg-ink text-white'
                                : log.severity === 'warning'
                                ? 'bg-warning-soft text-warning-strong border border-warning-border'
                                : 'bg-surface text-[#334E68]'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#334E68] text-xs">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SYSTEM HEALTH & REAL-TIME MONITORING */}
      {/* ========================================================================= */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6 animate-in fade-in">
          {health ? (
            <>
              {/* Uptime & Process Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    Server Uptime
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                    {health.uptime}
                  </div>
                  <div className="text-[11px] text-[#334E68]">Node {health.nodeVersion}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    Memory RSS
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                    {health.memoryRssMb} MB
                  </div>
                  <div className="text-[11px] text-[#334E68]">
                    Heap: {health.heapUsedMb}MB / {health.heapTotalMb}MB
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    Process Host
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                    {health.platform}
                  </div>
                  <div className="text-[11px] text-[#334E68]">PID {health.pid}</div>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#627D98]">
                    Error Rate
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#0B2545] font-['Space_Grotesk']">
                    Not measured
                  </div>
                  <div className="text-[11px] text-[#627D98]">
                    This server does not collect error-rate telemetry
                  </div>
                </div>
              </div>

              {/* Subsystems Matrix */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2545]">
                  Subsystem Health Matrix
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(health.services || []).map((svc) => (
                    <div key={svc.name} className="p-3.5 rounded-xl bg-canvas/80 border border-line/80 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#0B2545] text-xs">{svc.name}</div>
                        <div className="text-[11px] text-[#627D98] font-mono">{svc.latencyMs}ms response latency</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-wash text-[#1D4ED8] border border-blue-pale">
                        {svc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 sm:p-12 text-center rounded-2xl bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-warning-soft text-warning flex items-center justify-center mx-auto border border-warning-border/70">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2545] font-['Space_Grotesk']">
                System health unavailable
              </h3>
              <p className="text-xs sm:text-sm text-[#334E68] max-w-lg mx-auto leading-relaxed">
                {loading
                  ? 'Waiting for the first health reading…'
                  : endpointErrors.health
                  ? `The health endpoint did not return a reading: ${endpointErrors.health}.`
                  : 'The health endpoint returned no reading. Retrying automatically every 15 seconds.'}
              </p>
              <p className="text-xs text-[#627D98]">
                Nothing is displayed here because no live measurement was received.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: GLOBAL APPLICATION SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl !bg-white/80 backdrop-blur-xl border border-line/80 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-lg font-bold font-['Space_Grotesk'] text-[#0B2545]">
              Platform & MicroSaaS Configuration
            </h2>
            <p className="text-xs text-[#627D98]">
              Adjust tier limits, pricing tiers, and system operational flags.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label htmlFor="admin-free-tier-limit" className="text-xs font-bold text-[#0B2545] block">
                Free Tier Monthly Scan Limit
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-free-tier-limit"
                  type="number"
                  min={0}
                  value={settings?.freeTierMonthlyLimit ?? FREE_SCAN_LIMIT}
                  onChange={(e) =>
                    setSettings((prev) => prev ? { ...prev, freeTierMonthlyLimit: Number(e.target.value) } : prev)
                  }
                  className="w-24 p-2 rounded-lg border border-line-strong bg-white font-mono text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleToggleSetting('freeTierMonthlyLimit', settings?.freeTierMonthlyLimit ?? FREE_SCAN_LIMIT)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0B2545] text-white text-xs font-bold cursor-pointer"
                >
                  Save Limit
                </button>
              </div>
              <p className="text-[11px] text-[#627D98]">
                Standard candidate entitlement for unauthenticated/free accounts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <label htmlFor="admin-pro-price" className="text-xs font-bold text-[#0B2545] block">
                Pro Monthly Price (INR)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-pro-price"
                  type="number"
                  min={0}
                  value={settings?.proPriceInr ?? PRO_PRICE_INR}
                  onChange={(e) =>
                    setSettings((prev) => prev ? { ...prev, proPriceInr: Number(e.target.value) } : prev)
                  }
                  className="w-24 p-2 rounded-lg border border-line-strong bg-white font-mono text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleToggleSetting('proPriceInr', settings?.proPriceInr ?? PRO_PRICE_INR)}
                  className="px-3 py-1.5 rounded-lg bg-[#0B2545] text-white text-xs font-bold cursor-pointer"
                >
                  Save Price
                </button>
              </div>
              <p className="text-[11px] text-[#627D98]">
                Displayed across pricing modals and Razorpay payment links.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0B2545] block">Maintenance Mode</span>
                <p className="text-[11px] text-[#627D98]">
                  When active, non-admin visitors see a scheduled maintenance notice.
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('maintenanceMode', settings?.maintenanceMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  settings?.maintenanceMode ? 'bg-ink text-white' : 'bg-line text-[#334E68]'
                }`}
              >
                {settings?.maintenanceMode ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#0B2545] block">Prompt Injection Shield</span>
                <p className="text-[11px] text-[#627D98]">
                  Filters inputs against adversarial jailbreaks before calling models.
                </p>
              </div>
              <button
                onClick={() => handleToggleSetting('promptInjectionShield', settings?.promptInjectionShield)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  settings?.promptInjectionShield ? 'bg-[#0B2545] text-white' : 'bg-line text-[#334E68]'
                }`}
              >
                {settings?.promptInjectionShield ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT USER DETAILS */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={editUserModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-modal-title"
            tabIndex={-1}
            className="glass-panel p-6 rounded-2xl !bg-white border border-line shadow-2xl w-full max-w-lg space-y-4 focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-surface pb-3">
              <div>
                <h3 id="edit-user-modal-title" className="text-base font-bold text-[#0B2545] font-['Space_Grotesk']">
                  Edit User Profile
                </h3>
                <span className="text-xs text-[#627D98] font-mono">{editingUser.email}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Close dialog"
                className="text-line-steel hover:text-ink-soft cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="edit-user-name" className="font-bold text-[#334E68] block mb-1">Display Name</label>
                <input
                  id="edit-user-name"
                  type="text"
                  value={editFormData.displayName}
                  onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                  className="w-full p-2 rounded-xl border border-line text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-user-plan" className="font-bold text-[#334E68] block mb-1">Plan</label>
                  <select
                    id="edit-user-plan"
                    value={editFormData.currentPlan}
                    onChange={(e) => setEditFormData({ ...editFormData, currentPlan: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-line text-xs font-semibold"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-user-role" className="font-bold text-[#334E68] block mb-1">Role</label>
                  <select
                    id="edit-user-role"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-line text-xs font-semibold"
                  >
                    <option value="USER">USER (Candidate)</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-user-scans" className="font-bold text-[#334E68] block mb-1">Monthly Scans Used</label>
                <input
                  id="edit-user-scans"
                  type="number"
                  min={0}
                  value={editFormData.monthlyScansUsed}
                  onChange={(e) => setEditFormData({ ...editFormData, monthlyScansUsed: Number(e.target.value) })}
                  className="w-full p-2 rounded-xl border border-line font-mono text-xs font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-2">
                <label className="flex items-center gap-2 font-bold text-[#0B2545] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.isBanned}
                    onChange={(e) => setEditFormData({ ...editFormData, isBanned: e.target.checked })}
                    className="rounded border-line-strong"
                  />
                  <span>Suspend / Ban Account</span>
                </label>
                {editFormData.isBanned && (
                  <input
                    type="text"
                    aria-label="Suspension reason"
                    placeholder="Suspension reason..."
                    value={editFormData.banReason}
                    onChange={(e) => setEditFormData({ ...editFormData, banReason: e.target.value })}
                    className="w-full p-2 rounded-lg border border-line text-xs"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-line text-[#334E68] font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveEditUser}
                disabled={actionLoading === 'save-edit'}
                className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-ink text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD NEW LLM PROVIDER */}
      {/* ========================================================================= */}
      {showAddLLMModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            ref={addLlmModalRef}
            onSubmit={handleCreateLLM}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-llm-modal-title"
            tabIndex={-1}
            className="glass-panel p-6 rounded-2xl !bg-white border border-line shadow-2xl w-full max-w-lg space-y-4 focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-surface pb-3">
              <div>
                <h3 id="add-llm-modal-title" className="text-base font-bold text-[#0B2545] font-['Space_Grotesk']">
                  Add New LLM Engine
                </h3>
                <span className="text-xs text-[#627D98]">Register a new model for tasks and fallbacks</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLLMModal(false)}
                aria-label="Close dialog"
                className="text-line-steel hover:text-ink-soft cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="llm-name" className="font-bold text-[#334E68] block mb-1">Display Name</label>
                <input
                  id="llm-name"
                  type="text"
                  placeholder="e.g., Llama 3.1 8B Instant"
                  value={newLLMData.name}
                  onChange={(e) => setNewLLMData({ ...newLLMData, name: e.target.value })}
                  required
                  className="w-full p-2 rounded-xl border border-line text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="llm-provider" className="font-bold text-[#334E68] block mb-1">Provider</label>
                  <select
                    id="llm-provider"
                    value={newLLMData.provider}
                    onChange={(e) => setNewLLMData({ ...newLLMData, provider: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-line text-xs font-semibold"
                  >
                    <option value="groq">Groq</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="llm-model-id" className="font-bold text-[#334E68] block mb-1">Model Identifier</label>
                  <input
                    id="llm-model-id"
                    type="text"
                    placeholder="e.g., llama-3.1-8b-instant"
                    value={newLLMData.modelId}
                    onChange={(e) => setNewLLMData({ ...newLLMData, modelId: e.target.value })}
                    required
                    className="w-full p-2 rounded-xl border border-line font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="llm-context-window" className="font-bold text-[#334E68] block mb-1">Context Window</label>
                  <input
                    id="llm-context-window"
                    type="text"
                    placeholder="e.g., 128k"
                    value={newLLMData.contextWindow}
                    onChange={(e) => setNewLLMData({ ...newLLMData, contextWindow: e.target.value })}
                    className="w-full p-2 rounded-xl border border-line font-mono text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="llm-latency-tier" className="font-bold text-[#334E68] block mb-1">Latency Tier</label>
                  <select
                    value={newLLMData.latencyTier}
                    onChange={(e) => setNewLLMData({ ...newLLMData, latencyTier: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-line text-xs"
                  >
                    <option value="sub-second">sub-second (&lt;500ms)</option>
                    <option value="standard">standard (~1s)</option>
                    <option value="deep-reasoning">deep-reasoning (~2s+)</option>
                  </select>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
              <button
                type="button"
                onClick={() => setShowAddLLMModal(false)}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-line text-[#334E68] font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'create-llm'}
                className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-ink text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Register Model
              </button>
            </div>
          </form>
        </div>

      )}

      <ConfirmPromptDialog
        isOpen={adminDialog !== null}
        onCancel={() => setAdminDialog(null)}
        onConfirm={(value) => {
          const pending = adminDialog;
          setAdminDialog(null);
          if (!pending) return;
          if (pending.kind === 'ban') {
            // Cancelling the dialog aborts the suspension entirely; an empty
            // reason still falls back to the documented default.
            void performToggleBan(pending.userId, false, value || 'Policy violation');
          } else if (pending.kind === 'deleteUser') {
            void performDeleteUser(pending.userId, pending.email);
          } else {
            void performDeleteLLM(pending.llmId, pending.name);
          }
        }}
        destructive
        title={
          adminDialog?.kind === 'ban'
            ? 'Suspend this account'
            : adminDialog?.kind === 'deleteUser'
              ? 'Permanently delete this candidate'
              : 'Remove this model configuration'
        }
        message={
          adminDialog?.kind === 'ban'
            ? `Suspension blocks ${adminDialog.email} from signing in until an admin reinstates the account. The reason is written to the audit log.`
            : adminDialog?.kind === 'deleteUser'
              ? `Delete ${adminDialog.email} permanently? All scans, resumes and tailored outputs for this account will be wiped. This cannot be undone.`
              : `Remove ${adminDialog?.name ?? 'this model'} from the registry? Task bindings that still point at it lose their primary and should be rebound first.`
        }
        inputLabel={adminDialog?.kind === 'ban' ? 'Suspension / ban reason' : undefined}
        inputInitialValue={adminDialog?.kind === 'ban' ? 'Automated security policy flag' : ''}
        inputPlaceholder={adminDialog?.kind === 'ban' ? 'Why is this account being suspended?' : undefined}
        inputFallback={adminDialog?.kind === 'ban' ? 'Policy violation' : ''}
        confirmLabel={
          adminDialog?.kind === 'ban'
            ? 'Suspend account'
            : adminDialog?.kind === 'deleteUser'
              ? 'Delete user'
              : 'Remove model'
        }
      />
    </div>
  );
};
