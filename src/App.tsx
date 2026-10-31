import React, { useState, useEffect, useRef } from 'react';
import { ClerkProvider } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LenisProvider } from './context/LenisContext.js';
import { Navbar } from './components/Navbar.js';
import { LandingPage } from './views/LandingPage.js';
import { Dashboard } from './views/Dashboard.js';
import { AdminPanel } from './views/AdminPanel.js';
import { PaywallModal } from './components/PaywallModal.js';
import { AuthModal } from './components/AuthModal.js';
import { DeleteDataModal } from './components/DeleteDataModal.js';

type Tab = 'landing' | 'dashboard' | 'admin';

function MainApp() {
  const { user, loading, setAuthModalOpen, setAuthMode } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('landing');
  const [isPaywallOpen, setPaywallOpen] = useState(false);
  const [isDeleteDataOpen, setDeleteDataOpen] = useState(false);
  const initialRouteHandled = useRef(false);

  // The signed httpOnly backend session is authoritative. Profile metadata from
  // Clerk is optional and must not decide whether a restored cookie can enter
  // the workspace.
  const hasAccess = Boolean(user && !user.isAnonymous && !user.id.startsWith('guest_'));
  const routingReady = !loading;

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
    <div className="app-shell min-h-screen bg-canvas text-ink flex flex-col font-['IBM_Plex_Sans'] antialiased selection:bg-[#173B36] selection:text-white relative overflow-x-hidden max-w-full w-full">

      {/* Structured Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenPaywall={() => setPaywallOpen(true)}
        onOpenDeleteData={() => setDeleteDataOpen(true)}
        isSignedIn={hasAccess}
      />

      {/* Main View Container */}
      <main className="flex-1 relative z-10">
        {currentTab === 'landing' && (
          <LandingPage
            onScanClick={handleScanClick}
            onOpenPaywall={() => setPaywallOpen(true)}
            onOpenDeleteData={() => setDeleteDataOpen(true)}
            isSignedIn={hasAccess}
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
const MissingClerkKeyNotice: React.FC = () => (
  <div className="app-shell grid min-h-screen place-items-center bg-canvas p-6 font-['IBM_Plex_Sans'] text-ink">
    <div className="w-full max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-xl">
      <h1 className="font-['Space_Grotesk'] text-xl font-extrabold tracking-tight">
        Sign-in is not configured
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#334E68]">
        ResumeSetu uses Clerk for authentication, and this deployment has no Clerk publishable
        key. Set <code className="rounded bg-[#F2F6FC] px-1 py-0.5 text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in{' '}
        <code className="rounded bg-[#F2F6FC] px-1 py-0.5 text-xs">.env</code> and rebuild.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-[#627D98]">
        The key is public and safe to expose to the browser. It is not the Clerk secret key.
      </p>
    </div>
  </div>
);

export function App() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <MissingClerkKeyNotice />;
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
