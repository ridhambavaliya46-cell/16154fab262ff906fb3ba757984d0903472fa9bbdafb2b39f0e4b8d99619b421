import { FREE_SCAN_LIMIT, hasAdminPrivileges } from '../config.js';
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  LogOut,
  Trash2,
  ChevronDown,
  ArrowLeft,
  FileText,
  ShieldCheck,
  CreditCard,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLenisScroll } from '../context/LenisContext.js';
import { Logo } from './Logo.js';

interface NavbarProps {
  currentTab: 'landing' | 'dashboard' | 'admin';
  setCurrentTab: (tab: 'landing' | 'dashboard' | 'admin') => void;
  onOpenPaywall: () => void;
  onOpenDeleteData: () => void;
  isSignedIn?: boolean;
  landingTheme: 'dark' | 'light';
  onToggleLandingTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenPaywall,
  onOpenDeleteData,
  isSignedIn = false,
  landingTheme,
  onToggleLandingTheme,
}) => {
  const { user, identity, logout, setAuthModalOpen } = useAuth();
  const { scrollTo } = useLenisScroll();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [activeLandingSection, setActiveLandingSection] = useState('hero');
  // Separate refs per avatar: the workspace and landing headers each render their
  // own trigger, and sharing one ref coupled the click-outside handler to
  // whichever branch happened to mount.
  const workspaceProfileRef = useRef<HTMLDivElement>(null);
  const landingProfileRef = useRef<HTMLDivElement>(null);

  const isPro = user?.plan === 'pro';
  // Admin-configurable limit, delivered with the user record; the static
  // default only applies before the session payload arrives.
  const scanLimit = user?.scanLimit ?? FREE_SCAN_LIMIT;
  const creditsRemaining = user?.credits_remaining ?? scanLimit;
  const isWorkspace = currentTab === 'dashboard' || currentTab === 'admin';
  const isAdmin = hasAdminPrivileges(user);

  // Close whichever profile dropdown is open on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideWorkspace =
        workspaceProfileRef.current && workspaceProfileRef.current.contains(target);
      const insideLanding = landingProfileRef.current && landingProfileRef.current.contains(target);
      if (!insideWorkspace && !insideLanding) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentTab !== 'landing' || !('IntersectionObserver' in window)) return;
    const sections = ['hero', 'how-it-works', 'capabilities', 'proof', 'pricing', 'faq']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveLandingSection(visible.target.id);
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.2, 0.5, 0.8] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [currentTab]);

  // Scrolling to an anchor on a view that is not mounted yet needs to happen
  // after React commits the landing page. A fixed 100ms timeout raced the render
  // and silently dropped the scroll on slow frames.
  useEffect(() => {
    if (!pendingAnchor) return;
    // Both frames are tracked so the inner one can also be cancelled on
    // unmount — previously only the outer frame was, and the inner scroll
    // could run after the landing page was gone.
    let innerFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        scrollTo(pendingAnchor, { offset: -76 });
        setPendingAnchor(null);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (innerFrame !== undefined) cancelAnimationFrame(innerFrame);
    };
  }, [pendingAnchor, currentTab, scrollTo]);

  const handleNavClick = (anchor: string) => {
    setMobileMenuOpen(false);
    setActiveLandingSection(anchor.replace('#', ''));
    if (currentTab !== 'landing') {
      setCurrentTab('landing');
      setPendingAnchor(anchor);
    } else {
      scrollTo(anchor, { offset: -76 });
    }
  };

  const handleAnalyzeResume = () => {
    setMobileMenuOpen(false);
    if (isSignedIn) {
      setCurrentTab('dashboard');
      window.location.hash = 'dashboard';
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleSignOut = async () => {
    setProfileDropdownOpen(false);
    await logout();
    setCurrentTab('landing');
    window.location.hash = '';
  };

  const userEmail =
    identity?.email ||
    user?.email ||
    (user?.isAnonymous ? 'Guest Candidate' : 'Candidate Profile');

  const userDisplayName =
    identity?.displayName ||
    user?.displayName ||
    (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail);

  const userInitials = (userDisplayName || 'US')
    .slice(0, 2)
    .toUpperCase();

  const userAvatarUrl = identity?.photoURL || user?.photoURL;

  return (
    <header className="sticky top-0 z-50 w-full max-w-full overflow-x-clip bg-[#FCFCF9]/95 border-b border-[#DFE5E0] shadow-[0_4px_18px_rgba(23,59,54,0.06)] transition-all">
      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0 flex-nowrap">
        {/* Brand Logo & Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <Logo
            size="md"
            onClick={() => {
              if (currentTab !== 'landing') setCurrentTab('landing');
              scrollTo(0, { immediate: false });
            }}
          />

          {isWorkspace && (
            <div className="hidden sm:flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-[#CBD5E1]/70">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs whitespace-nowrap ${
                  currentTab === 'admin'
                    ? 'bg-warning-soft text-warning-strong border-warning-border'
                    : 'bg-blue-wash text-blue-core border-[#93C5FD]/60'
                }`}
              >
                {currentTab === 'admin' ? 'Admin Portal' : 'Your account'}
              </span>
            </div>
          )}
        </div>

        {/* WORKSPACE VIEW: Streamlined Fixed-Height Header */}
        {isWorkspace ? (
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-nowrap">
            {/* Quick Switch to Homepage Overview */}
            <button
              onClick={() => {
                setCurrentTab('landing');
                window.location.hash = '';
              }}
              className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-[#334E68] hover:text-[#0B2545] transition-colors cursor-pointer py-1.5 px-3 rounded-full hover:bg-surface/80 border border-line/60 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {/* Single-line, Inline Flex Pill with Fixed Height & Responsive Label */}
            <button
              type="button"
              onClick={!isPro ? onOpenPaywall : undefined}
              disabled={isPro}
              className={`inline-flex items-center gap-1 sm:gap-1.5 h-7 px-2 sm:px-3 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 border transition-all select-none ${
                !isPro ? 'cursor-pointer hover:shadow-xs' : 'cursor-default'
              } ${
                isPro
                  ? 'bg-blue-wash text-[#0B2545] border-[#93C5FD]/60'
                  : 'bg-blue-wash text-[#0B2545] border-[#93C5FD]/60'
              }`}
              title={isPro ? 'Pro Active' : 'Click to upgrade'}
              aria-label={isPro ? 'Pro plan active, unlimited resume reviews' : `Free plan, ${creditsRemaining} of ${scanLimit} resume reviews remaining. Upgrade to Pro.`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isPro ? 'bg-success animate-pulse' : 'bg-blue-core'
                }`}
              />
              <span className="whitespace-nowrap">
                {isPro ? (
                  <>
                    <span className="hidden sm:inline">Pro • Unlimited reviews</span>
                    <span className="sm:hidden">Pro</span>
                  </>
                ) : (
                  <>
                    <span className="hidden min-[400px]:inline">Free plan • </span>
                    <span>{creditsRemaining}/{scanLimit} reviews</span>
                  </>
                )}
              </span>
            </button>

            {/* Consolidated Interactive Profile Avatar Trigger (NO standalone gear) */}
            <div className="relative shrink-0" ref={workspaceProfileRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-1 p-0.5 sm:p-1 pl-0.5 sm:pl-1 pr-1.5 sm:pr-2 rounded-full border border-white/90 bg-white/80 hover:bg-white transition-all shadow-xs hover:shadow-md cursor-pointer group shrink-0"
                aria-label="User profile, settings and plan details"
                aria-expanded={profileDropdownOpen}
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="w-7 h-7 rounded-full object-cover border border-line shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                    {userInitials}
                  </div>
                )}

                <span className="hidden sm:inline-block text-xs font-bold text-[#0B2545] max-w-[110px] truncate">
                  {userDisplayName}
                </span>

                <ChevronDown
                  className={`w-3 h-3 text-[#627D98] group-hover:text-[#0B2545] transition-transform duration-150 shrink-0 ${
                    profileDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Consolidated Dropdown Menu with User Info, Plan, Settings & Firebase Sign-Out */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_20px_50px_rgba(11,37,69,0.18)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-3">
                    {userAvatarUrl ? (
                      <img
                        src={userAvatarUrl}
                        alt={userDisplayName}
                        className="w-10 h-10 rounded-full object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
                        {userInitials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#0B2545] truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-[11px] text-[#627D98] truncate" title={userEmail}>
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  {/* Plan Details & Upgrade Badge inside Dropdown */}
                  <div className="px-4 py-2.5 bg-canvas/70 border-b border-surface flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#627D98] uppercase tracking-wider block">
                        Active Plan
                      </span>
                      <span className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isPro ? 'bg-success animate-pulse' : 'bg-blue-core'
                          }`}
                        />
                        {isPro ? 'Pro member' : `Free plan · ${creditsRemaining}/${FREE_SCAN_LIMIT} reviews`}
                      </span>
                    </div>

                    {!isPro && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onOpenPaywall();
                        }}
                        className="px-2.5 py-1 rounded-lg text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] text-[11px] font-bold shadow-xs hover:shadow-sm cursor-pointer transition-all"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>

                  {/* Settings & Navigation Links */}
                  <div className="py-1">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setCurrentTab('admin');
                          window.location.hash = 'admin';
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-[#1D4ED8] hover:bg-blue-wash flex items-center justify-between cursor-pointer transition-colors bg-blue-wash/40 border-b border-blue-wash/70"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                          <span>Admin Panel</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#1D4ED8] text-white">
                          {user?.role || 'OWNER'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setCurrentTab('landing');
                        window.location.hash = '';
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-[#334E68] hover:bg-[#F0F4F8] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#627D98]" />
                      <span>Home</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenPaywall();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-[#334E68] hover:bg-[#F0F4F8] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#627D98]" />
                      <span>Plan & Billing</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenDeleteData();
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-[#334E68] hover:bg-[#F0F4F8] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#627D98]" />
                      <span>Privacy & Delete My Data</span>
                    </button>
                  </div>

                  {/* Firebase Sign-Out */}
                  <div className="pt-1 mt-1 border-t border-[#E2E8F0]">
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-soft flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-danger" />
                      <span>Sign Out / Reset Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* LANDING PAGE VIEW */
          <>
            <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-[#334E68]">
              <button
                onClick={() => handleNavClick('#how-it-works')}
                aria-current={activeLandingSection === 'how-it-works' ? 'location' : undefined}
                className="hover:text-[#0B2545] transition-colors cursor-pointer py-1"
              >
                How It Works
              </button>
              <button
                onClick={() => handleNavClick('#capabilities')}
                aria-current={activeLandingSection === 'capabilities' ? 'location' : undefined}
                className="hover:text-[#0B2545] transition-colors cursor-pointer py-1"
              >
                Features
              </button>
              <button
                onClick={() => handleNavClick('#pricing')}
                aria-current={activeLandingSection === 'pricing' ? 'location' : undefined}
                className="hover:text-[#0B2545] transition-colors cursor-pointer py-1"
              >
                Pricing
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                className="command-trigger"
                onClick={() => window.dispatchEvent(new Event('resumesetu:open-command'))}
                aria-label="Open quick navigation, Control or Command K"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Search</span>
                <kbd>⌘K</kbd>
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={onToggleLandingTheme}
                aria-label={`Switch to ${landingTheme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${landingTheme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {landingTheme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>
              {isSignedIn ? (
                <div className="flex items-center gap-3">
                  {/* Single-line fixed height pill on landing if signed in */}
                  <button
                    type="button"
                    onClick={!isPro ? onOpenPaywall : undefined}
                    disabled={isPro}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 h-7 px-2.5 sm:px-3 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 border select-none ${
                      !isPro ? 'cursor-pointer hover:shadow-xs' : 'cursor-default'
                    } ${
                      isPro
                        ? 'bg-blue-wash text-[#0B2545] border-[#93C5FD]/60'
                        : 'bg-blue-wash text-[#0B2545] border-[#93C5FD]/60'
                    }`}
                    title={isPro ? 'Pro Active' : 'Click to upgrade'}
                    aria-label={
                      isPro
                        ? 'Pro plan active'
                        : `Free plan, ${creditsRemaining} of ${scanLimit} resume reviews remaining. Upgrade to Pro.`
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isPro ? 'bg-blue-bright' : 'bg-[#1D4ED8]'}`}
                    />
                    <span className="whitespace-nowrap">
                      {isPro ? 'Pro active' : `Free plan · ${creditsRemaining}/${FREE_SCAN_LIMIT} reviews`}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentTab('dashboard');
                      window.location.hash = 'dashboard';
                    }}
                    className="px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] transition-all flex items-center gap-1.5 shadow-[0_4px_16px_rgba(29,78,216,0.35)] cursor-pointer whitespace-nowrap"
                  >
                    <span>Open resume tools</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Profile Avatar trigger on landing page */}
                  <div className="relative shrink-0" ref={landingProfileRef}>
                    <button
                      type="button"
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white flex items-center justify-center text-xs font-bold shadow-xs hover:shadow-md cursor-pointer shrink-0"
                      aria-label="User profile menu"
                      aria-expanded={profileDropdownOpen}
                    >
                      {userAvatarUrl ? (
                        <img
                          src={userAvatarUrl}
                          alt={userDisplayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        userInitials
                      )}
                    </button>

                    {profileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-2xl py-2 z-50">
                        <div className="px-4 py-2 border-b border-surface">
                          <p className="text-xs font-bold text-[#0B2545] truncate">
                            {userDisplayName}
                          </p>
                          <p className="text-[11px] text-[#627D98] truncate">{userEmail}</p>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              setCurrentTab('admin');
                              window.location.hash = 'admin';
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-[#1D4ED8] hover:bg-blue-wash flex items-center justify-between cursor-pointer transition-colors bg-blue-wash/40 border-b border-blue-wash/70"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Admin Panel</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#1D4ED8] text-white">
                              {user?.role || 'OWNER'}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-soft flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5 text-danger" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="px-3.5 py-2 rounded-full font-bold text-xs uppercase tracking-wider text-[#334E68] hover:text-[#0B2545] hover:bg-[#F0F4F8] transition-all cursor-pointer whitespace-nowrap"
                  >
                    Sign In
                  </button>

                  <button
                    onClick={handleAnalyzeResume}
                    className="pl-5 pr-4 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] hover:from-[#1E40AF] hover:via-[#1D4ED8] hover:to-[#2563EB] transition-all cursor-pointer flex items-center gap-2 shadow-[0_8px_20px_-2px_rgba(29,78,216,0.5),0_2px_6px_rgba(29,78,216,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_12px_28px_-2px_rgba(29,78,216,0.65)] hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                  >
                    <span>Analyze Resume</span>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu hamburger toggle */}
            <div className="flex md:hidden items-center gap-2 shrink-0">
              <button
                type="button"
                className="theme-toggle"
                onClick={onToggleLandingTheme}
                aria-label={`Switch to ${landingTheme === 'dark' ? 'light' : 'dark'} theme`}
                title={`Switch to ${landingTheme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {landingTheme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button
                onClick={handleAnalyzeResume}
                className="px-3.5 py-1.5 rounded-full font-bold text-xs text-white bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] shadow-[0_4px_12px_rgba(29,78,216,0.4)] whitespace-nowrap"
              >
                {isSignedIn ? 'Resume tools' : 'Check my resume'}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-[#0B2545] hover:bg-surface transition-colors cursor-pointer"
                aria-label="Toggle Navigation Menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Drawer */}
      {!isWorkspace && mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          className="md:hidden px-4 pt-3 pb-6 border-t border-[#CBD5E1]/80 bg-white/95 backdrop-blur-2xl shadow-xl flex flex-col gap-3 text-sm font-semibold text-[#0B2545]"
        >
          <button
            onClick={() => handleNavClick('#how-it-works')}
            className="text-left py-2 px-3 rounded-lg hover:bg-surface transition-colors"
          >
            How It Works
          </button>
          <button
            onClick={() => handleNavClick('#capabilities')}
            className="text-left py-2 px-3 rounded-lg hover:bg-surface transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('#pricing')}
            className="text-left py-2 px-3 rounded-lg hover:bg-surface transition-colors"
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              window.dispatchEvent(new Event('resumesetu:open-command'));
            }}
            className="text-left py-2 px-3 rounded-lg hover:bg-surface transition-colors"
          >
            Search sections
          </button>
          <div className="pt-2 flex flex-col gap-2">
            {!isSignedIn && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-[#0B2545] bg-surface/90 hover:bg-[#E2E8F0] border border-[#CBD5E1] transition-colors text-center cursor-pointer"
              >
                Sign In to Account
              </button>
            )}
            <button
              onClick={handleAnalyzeResume}
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(29,78,216,0.4)] cursor-pointer"
            >
              <span>{isSignedIn ? 'Open resume tools' : 'Check my resume'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
