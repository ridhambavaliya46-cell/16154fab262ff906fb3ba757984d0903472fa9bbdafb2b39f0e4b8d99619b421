import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X, ShieldCheck, Sparkles, Send, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { PRO_PRICE_INR } from '../config.js';
import { useDialogA11y } from '../hooks/useDialogA11y.js';
import { OwnerProfileCard, PaymentReference, type OwnerProfileData } from './OwnerProfile.js';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

/** Response of POST /api/payments/request. Assembled entirely on the server. */
interface UpgradeRequestResponse {
  success: boolean;
  error?: string;
  reference: string;
  telegramUrl: string;
  owner: OwnerProfileData;
  priceInr: number;
}

/** Shape the server gives before any request is made. */
interface PaymentConfig {
  priceInr: number;
  owner: OwnerProfileData;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  title = 'Upgrade to ResumeSetu Pro',
  subtitle = 'Get unlimited resume scans, editable Word drafts, and role-specific cover letters. Payment is reviewed manually before Pro is activated.',
}) => {
  const { user, setAuthModalOpen } = useAuth();

  const panelRef = useDialogA11y(isOpen, onClose);

  /*
   * Payment link handling.
   *
   * The Telegram URL used to be assembled in the browser from a hard-coded
   * handle and client-held identity, which meant anyone could open devtools and
   * send a message to their own account claiming to be a different user. The
   * link is now requested from the server, which derives both the destination
   * and the identity from the session cookie, and signs a verification code the
   * admin can check.
   */
  const [request, setRequest] = useState<UpgradeRequestResponse | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a double-click creating two audit rows and two references.
  const inFlight = useRef(false);

  const isSignedIn = Boolean(user?.id && !user.isAnonymous && !user.id.startsWith('guest_'));

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/config');
      const data = await res.json();
      if (res.ok && data?.owner) setConfig({ priceInr: data.priceInr, owner: data.owner });
    } catch {
      // Non-fatal: the modal falls back to the client-side price constant.
    }
  }, []);

  const createRequest = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.telegramUrl) {
        throw new Error(data?.error || `Could not prepare the upgrade request (HTTP ${res.status}).`);
      }
      setRequest(data as UpgradeRequestResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the upgrade request.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Clear per-open state so a stale reference is never shown again.
      setRequest(null);
      setError(null);
      return;
    }
    void loadConfig();
  }, [isOpen, loadConfig]);

  const displayPrice = config?.priceInr ?? PRO_PRICE_INR;
  const owner = config?.owner ?? null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B2545]/60 backdrop-blur-md"
          />

          {/* Centering Wrapper to avoid flexbox clipping */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            {/* Modal Container */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="paywall-modal-title"
              tabIndex={-1}
              className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl overflow-hidden z-10 my-auto p-5 sm:p-8 flex flex-col bg-white/95 backdrop-blur-2xl border border-white/80 shadow-[0_24px_64px_rgba(11,37,69,0.22)] text-left focus:outline-none"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl text-[#627D98] hover:text-[#0B2545] hover:bg-surface transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-wash border border-blue-pale/60 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span className="text-[11px] font-bold text-[#1D4ED8] uppercase tracking-wider">
                    ResumeSetu Pro Membership
                  </span>
                </div>

                <h3
                  id="paywall-modal-title"
                  className="text-xl sm:text-2xl font-extrabold text-[#0B2545] tracking-tight mt-1"
                >
                  {title}
                </h3>

                <p className="text-xs sm:text-sm text-[#334E68] mt-1.5 leading-relaxed">
                  {subtitle}
                </p>

                {/* Price card */}
                <div className="my-5 p-4 rounded-2xl border border-blue-pale/80 bg-blue-wash/50 flex items-baseline justify-between shadow-2xs">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold font-['Space_Grotesk'] text-[#0B2545]">
                        ₹{displayPrice}
                      </span>
                      <span className="text-xs text-[#627D98] font-medium">/ month</span>
                    </div>
                    <span className="text-[11px] text-[#627D98] font-medium">
                      Unlimited scans &amp; exports
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#1D4ED8] bg-white border border-blue-pale/70 px-3 py-1 rounded-full shadow-2xs">
                    Manual activation
                  </span>
                </div>

                {/* Feature Checklist */}
                <div className="space-y-3 mb-6 text-xs sm:text-sm text-[#0B2545]">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-mid shrink-0" />
                    <span className="font-medium">Unlimited match-score evaluations</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-mid shrink-0" />
                    <span className="font-medium">Tailored resume rewritten from your own experience</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-mid shrink-0" />
                    <span className="font-medium">Downloadable Microsoft Word (.docx) files</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-mid shrink-0" />
                    <span className="font-medium">Custom cover letters aligned to each job description</span>
                  </div>
                </div>

                {/* Who activates the plan */}
                {owner && <OwnerProfileCard owner={owner} className="mb-4" />}

                {/*
                  The activation action.

                  The link is produced by the server and is only rendered once it
                  arrives, so there is no hard-coded Telegram handle left in the
                  bundle to repoint and no client-held identity in the message.
                */}
                <div className="space-y-3">
                  {!isSignedIn ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          setAuthModalOpen(true);
                        }}
                        className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] shadow-[0_8px_20px_rgba(29,78,216,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4 text-white" />
                        <span>Sign in to request activation</span>
                      </button>
                      <p className="text-[11px] text-[#627D98] text-center leading-relaxed">
                        Your upgrade request is tied to your account so we can confirm who paid.
                      </p>
                    </>
                  ) : loading ? (
                    <button
                      type="button"
                      disabled
                      aria-busy="true"
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] opacity-70 transition-all flex items-center justify-center gap-2 cursor-wait"
                    >
                      <LoaderCircle className="w-4 h-4 text-white animate-spin" />
                      <span>Preparing your request…</span>
                    </button>
                  ) : request ? (
                    <a
                      href={request.telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] shadow-[0_8px_20px_rgba(29,78,216,0.35)] transition-all flex items-center justify-center gap-2 text-center no-underline cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-white shrink-0" />
                      <span>Message {request.owner.handle} to activate</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={createRequest}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] shadow-[0_8px_20px_rgba(29,78,216,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-white shrink-0" />
                      <span>Prepare my activation request</span>
                    </button>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                      <span className="flex-1 text-xs font-medium leading-relaxed text-danger-strong break-words">
                        {error}
                      </span>
                      <button
                        type="button"
                        onClick={createRequest}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-danger-border bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-danger hover:bg-danger-soft cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}

                  {request && (
                    <>
                      <PaymentReference reference={request.reference} />
                      <ol className="space-y-1.5 text-[11px] text-[#334E68]">
                        <li className="flex gap-2">
                          <span className="font-bold text-[#1D4ED8] shrink-0">1.</span>
                          <span>
                            Send the prefilled message — your email, UID and verification code are
                            already in it.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-[#1D4ED8] shrink-0">2.</span>
                          <span>Pay using the details {request.owner.name} replies with.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-[#1D4ED8] shrink-0">3.</span>
                          <span>Pro is activated on your account once the payment is confirmed.</span>
                        </li>
                      </ol>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-surface flex items-start gap-2 text-[11px] text-[#627D98]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-mid shrink-0 mt-px" strokeWidth={2} />
                  <span>
                    Manual activation — nobody can grant themselves Pro. Your request is logged
                    against your account and the verification code proves the message is genuinely
                    yours.
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
