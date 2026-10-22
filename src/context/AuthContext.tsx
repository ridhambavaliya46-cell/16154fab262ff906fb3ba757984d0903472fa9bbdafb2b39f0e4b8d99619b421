import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useUser as useClerkUser } from '@clerk/react';
import { FREE_SCAN_LIMIT, PRO_PRICE_INR, PRO_UNLIMITED_CREDITS } from '../config.js';
import { User } from '../types/index.js';

export interface AuthIdentity {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  identity: AuthIdentity | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  retryBackendSync: () => void;
  logout: () => Promise<void>;
  cancelSubscription: () => Promise<boolean>;
  deleteMyData: () => Promise<boolean>;
  authError: string | null;
  clearAuthError: () => void;
  refreshUser: () => Promise<void>;
  /**
   * Clerk accepted the credentials but ResumeSetu's own database session could
   * not be created. The dialog offers a retry in this state.
   */
  authBackendDown: boolean;
  /**
   * Pro price the server actually charges, from GET /api/payments/config
   * (admin-editable). The config.ts constant is only the pre-load fallback, so
   * the number on the paywall can never drift from the number the activation
   * gate enforces.
   */
  proPriceInr: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * Reads an API response as JSON, but refuses to pretend an HTML page is one.
 *
 * `.catch(() => ({}))` is deliberately absent: swallowing a failed `res.json()`
 * is what previously produced the misleading "Could not sync your account" with
 * no actionable detail.
 */
async function readApiJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 404) {
      throw new Error(
        'The ResumeSetu API is not reachable at this address (HTTP 404). This deploy is not serving the /api endpoints.'
      );
    }
    throw new Error(
      `The server replied with an unexpected (non-JSON) response — HTTP ${res.status}. Please retry in a moment.`
    );
  }
  try {
    return await res.json();
  } catch {
    throw new Error(
      `The server sent a response we could not read (HTTP ${res.status}). Please retry in a moment.`
    );
  }
}

function toAppUser(
  record: any,
  identity?: AuthIdentity | null,
  scanLimit: number = FREE_SCAN_LIMIT
): User {
  const plan: 'free' | 'pro' = record?.currentPlan?.toUpperCase() === 'PRO' ? 'pro' : 'free';
  const id = record?.id || identity?.uid || 'guest_unknown';
  return {
    id,
    email: record?.email || identity?.email || `${id}@guest.resumesetu.app`,
    displayName: record?.displayName || identity?.displayName || (id.startsWith('guest_') ? 'Guest Candidate' : null),
    photoURL: identity?.photoURL || null,
    plan,
    credits_remaining:
      plan === 'pro'
        ? PRO_UNLIMITED_CREDITS
        : Math.max(0, scanLimit - (record?.monthlyScansUsed || 0)),
    scanLimit,
    isAnonymous: id.startsWith('guest_'),
    isAdmin: Boolean(record?.isAdmin),
    role: record?.role || (record?.isAdmin ? 'ADMIN' : 'USER'),
    created_at: record?.createdAt || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  /*
   * Clerk owns authentication. Everything else in the app talks to our own
   * endpoints, so this provider's job is to bridge the two: when Clerk reports a
   * signed-in user, exchange that for ResumeSetu's signed httpOnly session
   * cookie; when Clerk reports signed out, drop it.
   */
  const clerk = useClerkAuth();
  const { user: clerkUser } = useClerkUser();
  const { isSignedIn, isLoaded, getToken, signOut: clerkSignOut } = clerk;

  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [authBackendDown, setAuthBackendDown] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Clerk user id whose session we have already mirrored, to avoid re-syncing. */
  const syncedClerkUser = useRef<string | null>(null);
  const inFlightSync = useRef<Promise<void> | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  /*
   * Admin-configurable free-tier limit, shipped by GET /api/payments/config.
   * Until it arrives the default from config.ts is used; when it does arrive,
   * any already-loaded user record is recomputed so the credits shown match
   * what the server will actually enforce.
   */
  const [scanLimit, setScanLimit] = useState(FREE_SCAN_LIMIT);
  const scanLimitRef = useRef(scanLimit);
  const userRecordRef = useRef<any>(null);
  const [proPriceInr, setProPriceInr] = useState(PRO_PRICE_INR);

  const applyUserRecord = useCallback(
    (record: any, idn?: AuthIdentity | null) => {
      userRecordRef.current = record ?? null;
      setUser(record ? toAppUser(record, idn, scanLimitRef.current) : null);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/config', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const limit = Number(data?.freeTierMonthlyLimit);
        if (!cancelled && limit > 0 && limit !== scanLimitRef.current) {
          scanLimitRef.current = limit;
          setScanLimit(limit);
          // Recompute an already-loaded free user against the real limit.
          if (userRecordRef.current) {
            setUser(toAppUser(userRecordRef.current, null, limit));
          }
        }
        const price = Number(data?.priceInr);
        if (!cancelled && Number.isFinite(price) && price > 0) setProPriceInr(price);
      })
      .catch(() => {
        // The default limit stays in effect; nothing else to do.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Restore an existing ResumeSetu session.
   *
   * The signed httpOnly cookie is what every other endpoint authorises against,
   * so it is the only thing that decides whether `user` is set. Clerk is
   * consulted for *credentials*, never trusted directly for authorisation.
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await readApiJson(res);
        if (data?.user) {
          applyUserRecord(data.user);
          setIdentity(null);
          setAuthBackendDown(false);
          return true;
        }
      }
    } catch {
      // A failed restore leaves the visitor signed out; it must not throw.
    }
    userRecordRef.current = null;
    setUser(null);
    setIdentity(null);
    return false;
  }, [applyUserRecord]);

  /**
   * Exchange a live Clerk session for a ResumeSetu session cookie.
   *
   * Called whenever Clerk reports a signed-in user, which covers every sign-in
   * path Clerk supports — email code, password, and any connected social
   * provider — so there is exactly one integration point regardless of how the
   * user authenticated.
   */
  const syncClerkSession = useCallback(async (): Promise<void> => {
    // React StrictMode double-invokes effects; share one request.
    if (inFlightSync.current) return inFlightSync.current;

    const run = (async () => {
      setLoading(true);
      setAuthError(null);
      try {
        let token: string | null = null;
        for (let attempt = 0; attempt < 4 && !token; attempt += 1) {
          token = await getToken();
          if (!token && attempt < 3) await wait(250 * (attempt + 1));
        }
        if (!token) throw new Error('Clerk did not return a session token.');

        let res: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              credentials: 'include',
              cache: 'no-store',
              body: JSON.stringify({}),
            });
            if (res.status < 500 || attempt === 2) break;
          } catch (networkError) {
            if (attempt === 2) throw networkError;
          }
          await wait(350 * (attempt + 1));
        }
        if (!res) throw new Error('Could not reach the ResumeSetu API. Please retry in a moment.');
        const data = await readApiJson(res);
        if (!res.ok || !data?.user) {
          throw new Error(data?.error || `Could not finish connecting your account (HTTP ${res.status}).`);
        }

        applyUserRecord(data.user);
        setIdentity({
          uid: data.user.id,
          email: data.user.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? null,
          displayName:
            data.user.displayName ?? clerkUser?.fullName ?? clerkUser?.username ?? null,
          photoURL: clerkUser?.imageUrl ?? null,
        });
        setAuthBackendDown(false);
        setAuthModalOpen(false);
        localStorage.removeItem('resumesetu_guest_uid');
        localStorage.removeItem('resumesetu_guest_session');
        syncedClerkUser.current = clerk.userId ?? 'signed-in';
      } catch (err) {
        // Credentials were accepted; only our backend session failed. Keep the
        // user signed in at Clerk and offer a retry rather than a dead end.
        setAuthBackendDown(true);
        setAuthError(err instanceof Error ? err.message : 'Could not connect your account.');
        setAuthModalOpen(true);
      } finally {
        setLoading(false);
        inFlightSync.current = null;
      }
    })();

    inFlightSync.current = run;
    return run;
  }, [getToken, clerk.userId, clerkUser, applyUserRecord]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      syncedClerkUser.current = null;
      setAuthBackendDown(false);
      void (async () => {
        setLoading(true);
        const restored = await restoreSession();
        setLoading(false);
        if (!restored) setUser(null);
      })();
      return;
    }

    if (syncedClerkUser.current && syncedClerkUser.current === (clerk.userId ?? 'signed-in')) return;
    void syncClerkSession();
  }, [isLoaded, isSignedIn, clerk.userId, restoreSession, syncClerkSession]);

  const retryBackendSync = useCallback(() => {
    setAuthError(null);
    syncedClerkUser.current = null;
    void syncClerkSession();
  }, [syncClerkSession]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await readApiJson(res);
      if (data?.user) applyUserRecord(data.user);
    } catch {
      // Stale plan/credit numbers are acceptable; replacing a working session
      // with an auth error is not.
    }
  }, [applyUserRecord]);

  const logout = useCallback(async () => {
    // Sign out of Clerk first, then drop our cookie. If Clerk's call fails we
    // still clear the local session so the UI cannot show a stale signed-in
    // state.
    await clerkSignOut({ redirectUrl: window.location.origin }).catch(() => {});
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('resumesetu_guest_uid');
    localStorage.removeItem('resumesetu_active_user');
    syncedClerkUser.current = null;
    userRecordRef.current = null;
    setUser(null);
    setIdentity(null);
    setAuthBackendDown(false);
    setAuthModalOpen(false);
    window.location.hash = '';
  }, [clerkSignOut]);

  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const res = await fetch('/api/auth/cancel-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAuthError(body?.error || `Cancellation failed (HTTP ${res.status}).`);
        return false;
      }
      setUser((prev) =>
        prev
          ? { ...prev, plan: 'free', credits_remaining: scanLimitRef.current, scanLimit: scanLimitRef.current }
          : null
      );
      return true;
    } catch {
      setAuthError('Could not reach the server to cancel your plan.');
      return false;
    }
  }, [user?.id]);

  const deleteMyData = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const res = await fetch('/api/auth/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        await logout();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [user?.id, logout]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        identity,
        loading,
        isAuthModalOpen,
        setAuthModalOpen,
        authMode,
        setAuthMode,
        retryBackendSync,
        logout,
        cancelSubscription,
        deleteMyData,
        authError,
        clearAuthError,
        refreshUser,
        authBackendDown,
        proPriceInr,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
