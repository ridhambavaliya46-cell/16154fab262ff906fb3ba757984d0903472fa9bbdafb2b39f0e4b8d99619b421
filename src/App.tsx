import React, { useState, useEffect, useRef } from 'react';
import { ClerkProvider } from '@clerk/react';
import { Moon, Search, Sun, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LenisProvider } from './context/LenisContext.js';
import { Navbar } from './components/Navbar.js';
import { LandingPage } from './views/LandingPage.js';
import { Dashboard } from './views/Dashboard.js';
import { AdminPanel } from './views/AdminPanel.js';
import { PaywallModal } from './components/PaywallModal.js';
import { AuthModal } from './components/AuthModal.js';
import { DeleteDataModal } from './components/DeleteDataModal.js';
import { Logo } from './components/Logo.js';

type Tab = 'landing' | 'dashboard' | 'admin';
type LandingTheme = 'dark' | 'light';

function MainApp() {
  const { user, loading, setAuthModalOpen, setAuthMode } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('landing');
  const [isPaywallOpen, setPaywallOpen] = useState(false);
  const [isDeleteDataOpen, setDeleteDataOpen] = useState(false);
  const [landingTheme, setLandingTheme] = useState<LandingTheme>(() => {
    try {
      return localStorage.getItem('resumesetu-landing-theme-v2') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const initialRouteHandled = useRef(false);

  // The signed httpOnly backend session is authoritative. Profile metadata from
  // Clerk is optional and must not decide whether a restored cookie can enter
  // the workspace.
  const hasAccess = Boolean(user && !user.isAnonymous && !user.id.startsWith('guest_'));
  const routingReady = !loading;

  useEffect(() => {
    try {
      localStorage.setItem('resumesetu-landing-theme-v2', landingTheme);
    } catch {
      // Theme selection still works for this session if storage is unavailable.
    }
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = landingTheme === 'dark' ? '#132431' : '#F4F0E6';
  }, [landingTheme]);

  // Sync hash and path routing if user clicks direct links or browser back/forward
  useEffect(() => {
    if (!routingReady) return;
    const handleRouting = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (
        hash === '#signin' ||
        hash === '#signup' ||
        hash === '#login' ||
        hash === '#auth' ||
        path === '/auth' ||
        path === '/login' ||
        path === '/sign-in' ||
        path === '/signup'
      ) {
        setAuthMode(hash === '#signup' || path === '/signup' ? 'signup' : 'signin');
        setAuthModalOpen(true);
      } else if (hash === '#admin' || path === '/admin') {
        if (hasAccess && user?.isAdmin) {
          setCurrentTab('admin');
        } else {
          setCurrentTab('landing');
          if (!hasAccess) setAuthModalOpen(true);
        }
      } else if (hash === '#dashboard' || hash === '#analyze' || hash === '#/dashboard' || hash === '#/analyze') {
        if (hasAccess) {
          setCurrentTab('dashboard');
        } else {
          setCurrentTab('landing');
          setAuthModalOpen(true);
        }
      } else if (hash === '' || hash === '#') {
        setCurrentTab(initialRouteHandled.current || !hasAccess ? 'landing' : 'dashboard');
      }
      initialRouteHandled.current = true;
    };
    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('popstate', handleRouting);
    return () => {
      window.removeEventListener('hashchange', handleRouting);
      window.removeEventListener('popstate', handleRouting);
    };
  }, [routingReady, hasAccess, user?.isAdmin, setAuthModalOpen, setAuthMode]);

  // When user successfully signs in, route to dashboard if requested
  useEffect(() => {
    if (routingReady && hasAccess && ['#dashboard', '#analyze', '#/dashboard', '#/analyze'].includes(window.location.hash)) {
      setCurrentTab('dashboard');
    }
  }, [routingReady, hasAccess]);

  // Session Time Tracker Heartbeat
  useEffect(() => {
    const activeId = hasAccess ? user?.id : null;
    if (!activeId) return;

    // Ping once on mount / tab change
    fetch('/api/analytics/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activeId, seconds: 15, page: currentTab }),
    }).catch(() => {});

    // Periodic heartbeat every 30s
    const pingInterval = setInterval(() => {
      fetch('/api/analytics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeId, seconds: 30, page: currentTab }),
      }).catch(() => {});
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [user?.id, hasAccess, currentTab]);

  const handleScanClick = () => {
    if (!routingReady) return;
    if (hasAccess) {
      setCurrentTab('dashboard');
      window.location.hash = 'dashboard';
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div
      className={`app-shell min-h-screen flex flex-col font-['IBM_Plex_Sans'] antialiased relative overflow-x-hidden max-w-full w-full ${currentTab === 'landing' ? 'landing-shell' : 'workspace-shell bg-[#F7F7F3] text-[#173B36] selection:bg-[#173B36] selection:text-white'}`}
      data-theme={currentTab === 'landing' ? landingTheme : undefined}
    >
      {/* Structured Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenPaywall={() => setPaywallOpen(true)}
        onOpenDeleteData={() => setDeleteDataOpen(true)}
        isSignedIn={hasAccess}
        landingTheme={landingTheme}
        onToggleLandingTheme={() => setLandingTheme((theme) => theme === 'dark' ? 'light' : 'dark')}
      />

      {/* Main View Container */}
      <main className="flex-1 relative z-10">
        {currentTab === 'landing' && (
          <LandingPage
            onScanClick={handleScanClick}
            onOpenPaywall={() => setPaywallOpen(true)}
            onOpenDeleteData={() => setDeleteDataOpen(true)}
          />
        )}
        {currentTab === 'dashboard' && hasAccess && (
          <Dashboard
            onOpenPaywall={() => setPaywallOpen(true)}
          />
        )}
        {currentTab === 'admin' && hasAccess && user?.isAdmin && (
          <AdminPanel
            onBackToWorkspace={() => {
              setCurrentTab('dashboard');
              window.location.hash = 'dashboard';
            }}
          />
        )}
      </main>

      {/* Global Modals */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
      <AuthModal />
      <DeleteDataModal
        isOpen={isDeleteDataOpen}
        onClose={() => setDeleteDataOpen(false)}
      />
    </div>
  );
}

/**
 * Clerk is required for authentication.
 *
 * The app previously refused to render at all without VITE_CLERK_PUBLISHABLE_KEY
 * and wrapped everything in <ClerkProvider>, so a Clerk outage or
 * misconfiguration locked out every user — which is exactly what happened: the
 * instance is configured for email one-time codes only and has no password
 * option, so there was no traditional way in.
 *
 * Clerk owns all credential and OAuth flows. Requiring the publishable key at
 * startup makes a missing deployment setting visible instead of presenting a
 * sign-in dialog that cannot authenticate anyone.
 */
/**
 * Shown when the Clerk publishable key is missing.
 *
 * Authentication is Clerk-only, so this is a deployment misconfiguration rather
 * than an optional integration: without a key nobody could sign in. It fails
 * loudly and says exactly what to fix, instead of rendering a shell whose
 * buttons silently do nothing.
 */
const MissingClerkKeyPreview: React.FC = () => {
  const [theme, setTheme] = useState<LandingTheme>(() => {
    try {
      return localStorage.getItem('resumesetu-landing-theme-v2') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('resumesetu-landing-theme-v2', theme);
    } catch {
      // The preview theme remains usable for the current session.
    }
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'dark' ? '#132431' : '#F4F0E6';
  }, [theme]);

  const unavailable = (feature: string) => {
    setNotice(`${feature} needs sign-in. Add a valid Clerk publishable key to enable account features.`);
  };

  return (
    <LenisProvider>
      <div className="app-shell landing-shell relative flex min-h-screen w-full max-w-full flex-col overflow-x-hidden font-['IBM_Plex_Sans'] antialiased" data-theme={theme}>
        <header className="sticky top-0 z-50 w-full border-b">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Logo size="md" variant={theme === 'dark' ? 'dark' : 'default'} />
            <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm font-medium md:flex">
              <a href="#how-it-works">How it works</a>
              <a href="#capabilities">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQs</a>
            </nav>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="command-trigger"
                aria-label="Open quick navigation (Ctrl or Command+K)"
                onClick={() => window.dispatchEvent(new Event('resumesetu:open-command'))}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Search</span>
                <kbd>⌘K</kbd>
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </header>

        {notice && (
          <div className="mx-auto mt-4 flex w-[min(72rem,calc(100%-2rem))] items-start justify-between gap-4 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-panel-strong)] px-4 py-3 text-sm text-[var(--landing-ink)] shadow-lg" role="status">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message" className="shrink-0 rounded-md p-1 focus-visible:outline focus-visible:outline-2">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <main className="flex-1">
          <LandingPage
            onScanClick={() => unavailable('Resume analysis')}
            onOpenPaywall={() => unavailable('Pro activation')}
            onOpenDeleteData={() => unavailable('Account data controls')}
          />
        </main>
        <div className="border-t border-[var(--landing-border)] bg-[var(--landing-panel)] px-4 py-2 text-center text-xs text-[var(--landing-muted)]">
          Preview mode · authentication and account actions need a valid Clerk publishable key.
        </div>
      </div>
    </LenisProvider>
  );
};

export function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const hasValidPublishableKey = /^pk_(?:test|live)_[A-Za-z0-9_=-]+$/.test(publishableKey || '');

  if (!hasValidPublishableKey) {
    return <MissingClerkKeyPreview />;
  }

  /*
   * Clerk owns authentication and is always mounted, because the sign-in dialog
   * renders Clerk's own <SignIn>/<SignUp> components. AuthProvider then mirrors
   * the Clerk session into ResumeSetu's signed httpOnly cookie.
   *
   * `routing="hash"` means Clerk intercepts the OAuth callback in-page, so the
   * /sso-callback route this app used to hand-roll is no longer needed.
   */
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <LenisProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LenisProvider>
    </ClerkProvider>
  );
}

export default App;
