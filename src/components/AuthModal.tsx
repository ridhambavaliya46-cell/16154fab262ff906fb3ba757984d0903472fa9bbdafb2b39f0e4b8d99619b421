import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, LoaderCircle, X } from 'lucide-react';
import { SignIn, SignUp } from '@clerk/react';
import { useAuth } from '../context/AuthContext.js';
import { useDialogA11y } from '../hooks/useDialogA11y.js';
import { Logo } from './Logo.js';

/**
 * Sign-in dialog.
 *
 * AUTH IS CLERK-ONLY.
 * ---------------------
 * Every credential path — email code, password, and any connected social
 * provider — is served by Clerk's own components. That is deliberate: Clerk is
 * the single place where authentication is configured, so there is exactly one
 * thing to audit and one thing to change.
 *
 * This file therefore renders <SignIn>/<SignUp> directly rather than
 * reimplementing a form. A hand-rolled form duplicated Clerk's logic and had to
 * be kept in step with it; when the instance settings changed, the app's copy
 * quietly disagreed with the instance. Clerk decides which fields appear based
 * on what is enabled in the Dashboard:
 *
 *   - Email one-time code  -> always available on this instance.
 *   - Email + password     -> appears once "Password" is enabled in Settings.
 *   - Google               -> appears once connected under Social Connections.
 *
 * Nothing here needs to change when those settings do.
 *
 * The surrounding dialog shell (focus trap, Escape to close, focus restore,
 * reduced-motion handling, scroll lock) is ours and is deliberately kept, since
 * Clerk has no modal of its own.
 *
 * If Clerk is unreachable, <ClerkFailureNotice> explains it instead of leaving
 * an empty dialog — see App.tsx for the boundary that produces that state.
 */

/**
 * Themes Clerk's markup with the app's own tokens so the embedded component
 * does not look like a dropped-in third-party widget.
 */
const clerkAppearance = {
  variables: {
    colorPrimary: '#111111',
    colorBackground: '#FFFFFF',
    colorText: '#0B2545',
    colorTextSecondary: '#334E68',
    colorInputBackground: '#F7F9FC',
    colorInputText: '#0B2545',
    colorDanger: '#B42318',
    colorNeutral: '#627D98',
    borderRadius: '0.75rem',
    fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    // The dialog already provides the surface, padding and shadow.
    rootBox: 'w-full',
    footer: 'hidden',
    cardBox: 'w-full border-0 bg-transparent p-0 shadow-none',
    card: 'gap-0 p-0',
    headerTitle: {
      fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
      fontSize: '1.35rem',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      color: '#0B2545',
    },
    headerSubtitle: 'text-xs leading-relaxed text-[#334E68] sm:text-sm',
    formFieldInputWrapper:
      'rounded-xl border border-[#D3D3CF] bg-[#F7F7F5] focus-within:border-[#111111] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#111111]/20',
    formFieldInput: 'text-sm text-[#0B2545]',
    formButtonPrimary:
      'min-h-11 w-full rounded-xl bg-[#111111] text-xs font-bold uppercase tracking-wider shadow-xs transition-colors hover:bg-[#292929]',
    socialButtonsBlockButton:
      'min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold uppercase tracking-wider text-[#0B2545] shadow-xs transition-colors hover:bg-[#F7F9FC]',
    // The app supplies its own divider and copy, so drop Clerk's.
    footerAction: 'hidden',
    identityPreview: 'hidden',
  },
} as const;

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setAuthModalOpen,
    authMode,
    setAuthMode,
    authError,
    clearAuthError,
    loading,
    retryBackendSync,
    authBackendDown,
  } = useAuth();

  const isSignUp = authMode === 'signup';
  const panelRef = useDialogA11y(isAuthModalOpen, () => setAuthModalOpen(false));

  const close = () => {
    clearAuthError();
    setAuthModalOpen(false);
  };

  const switchMode = (mode: 'signin' | 'signup') => {
    clearAuthError();
    setAuthMode(mode);
  };

  // Where Clerk sends the user once credentials are accepted.
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/#dashboard` : '/#dashboard';

  return (
    <AnimatePresence>
      {isAuthModalOpen && (
        <motion.div
          key="auth-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0B2545]/45 p-4 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <motion.div
            key="auth-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: 'spring', duration: 0.42, bounce: 0.16 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl outline-none"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close sign-in dialog"
              className="absolute top-3.5 right-3.5 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-[#7B7B7B] transition-colors hover:bg-[#EEEEEC] hover:text-[#111111] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/40"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[#E6EDF6] bg-[#F7F9FC] px-5 py-3.5 sm:px-6">
              <Logo className="h-6 w-auto" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                {isSignUp ? 'Create your account' : 'Secure sign-in'}
              </span>
            </div>

            <div className="px-5 py-6 sm:px-6">
              {/*
                Accessible name for the dialog. Visually hidden because Clerk
                renders its own visible heading immediately below and two
                headings would read out twice.
              */}
              <h2 id="auth-modal-title" className="sr-only">
                {isSignUp ? 'Create your account' : 'Sign in to ResumeSetu'}
              </h2>

              {authError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF3F2] px-3 py-2.5"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]"
                    strokeWidth={2}
                  />
                  <span className="text-xs font-medium leading-relaxed break-words text-[#912018]">
                    {authError}
                  </span>
                </div>
              )}

              {/*
                Clerk is reachable but our own database session could not be
                created. The credentials were accepted; only ResumeSetu's backend
                session failed, so offer a retry rather than a dead end.
              */}
              {authBackendDown && (
                <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-3">
                  <p className="text-xs leading-relaxed text-[#92400E]">
                    You are signed in, but ResumeSetu could not finish loading your account. Your
                    credentials are safe.
                  </p>
                  <button
                    type="button"
                    onClick={retryBackendSync}
                    disabled={loading}
                    className="mt-2.5 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#92400E] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#78350F] disabled:cursor-wait disabled:opacity-60"
                  >
                    {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    Try again
                  </button>
                </div>
              )}

              {isSignUp ? (
                <SignUp
                  routing="hash"
                  appearance={clerkAppearance}
                  fallbackRedirectUrl={redirectTo}
                  forceRedirectUrl={redirectTo}
                />
              ) : (
                <SignIn
                  routing="hash"
                  appearance={clerkAppearance}
                  fallbackRedirectUrl={redirectTo}
                  forceRedirectUrl={redirectTo}
                />
              )}

              {/*
                Clerk's own "Need an account? Sign up" footer is hidden above so
                the dialog keeps a single, consistent switch. Clerk v6 removed
                the onSwitchToSignIn/onSwitchToSignUp callbacks, so switching
                modes is driven from here.
              */}
              <p className="mt-4 text-center text-xs text-[#627D98]">
                {isSignUp ? 'Already have an account? ' : 'New to ResumeSetu? '}
                <button
                  type="button"
                  onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
                  className="cursor-pointer font-bold text-[#111111] underline underline-offset-2 hover:text-[#3A3A3A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/40"
                >
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
