# ResumeSetu — Complete UI Guide

Everything a designer/dev needs about the interface: every screen, tab, panel, state and component, with the screenshot it matches and the source file that renders it.

All screenshots live in [`../screenshots/`](../screenshots/) and were captured from the running app.

---

## 1. Routing model

There is **no router library**. `src/App.tsx` keeps one state variable and syncs it with the URL.

```
ClerkProvider → LenisProvider → AuthProvider → MainApp
                                     │
                        Tab = 'landing' | 'dashboard' | 'admin'
```

| View | Mounted when |
| --- | --- |
| `LandingPage` | always the fallback |
| `Dashboard` | `hasAccess === true` |
| `AdminPanel` | `hasAccess && user.isAdmin` (owner/admin role) |

`hasAccess = Boolean(user && !user.isAnonymous && !user.id.startsWith('guest_'))` — driven by the **signed backend cookie**, never by Clerk metadata alone. `routingReady = !loading` prevents a landing flash while the session is being restored.

| URL | Behaviour |
| --- | --- |
| `#signin`, `#login`, `#auth`, `/auth`, `/login`, `/sign-in` | opens sign-in dialog |
| `#signup`, `/signup` | opens sign-up dialog |
| `#dashboard`, `#analyze` | dashboard if signed in, else landing + dialog |
| `#admin` / `/admin` | admin if privileged, else landing (+ dialog if signed out) |
| empty | dashboard for a previously routed session, else landing |

Clerk uses `routing="hash"`, so OAuth callbacks are handled in-page — there is no `/sso-callback` route. If `VITE_CLERK_PUBLISHABLE_KEY` is missing the app renders `<MissingClerkKeyNotice>` instead of a broken dialog.

---

## 2. Global chrome

### 2.1 Navbar — `src/components/Navbar.tsx` (584 lines)

Desktop left→right:

| Element | Notes |
| --- | --- |
| Bridge logo + "ResumeSetu" wordmark | `Logo` component (two piers, catenary arc, deck, keystone) |
| How It Works · Features · Pricing | anchor links, scrolled via Lenis (`useLenisScroll`); hidden on mobile |
| Back to Workspace / Admin Portal | appears only for privileged users |
| Pro · Unlimited Scans pill + avatar menu | avatar/name come from the authenticated Clerk profile |
| "Purge Stored Data" | opens `DeleteDataModal` |
| **SIGN IN** / **ANALYZE RESUME →** | primary CTA; signed-in users go straight to the dashboard |

Mobile: logo + hamburger; the anchor list collapses.

### 2.2 Ambient background — `src/components/ATSInteractiveBackground.tsx`

Fixed full-viewport layer: gradient blooms + 44 px blueprint grid + crosshair dots + a cursor spotlight. The spotlight is GPU-only (ref + transform, no per-frame `setState`), disabled for coarse pointers and under `prefers-reduced-motion`; the rAF loop parks when idle.

### 2.3 Design system — `src/index.css` (336 lines, Tailwind v4 `@theme`)

| Token | Value |
| --- | --- |
| `--color-corporate-navy` | `#0b2545` (headings, dark surfaces) |
| `--color-corporate-blue` | `#1d4ed8` (primary action) |
| `--color-corporate-cloud` | `#f7f9fc` (page canvas) |
| `--color-corporate-steel` | `#8da9c4` |
| Blue ramp | `blue-ink → blue-deep → blue-core → blue-mid → blue-bright → blue-light → blue-pale → blue-wash → blue-mist` |
| Neutrals | `canvas`, `surface-base/surface/surface-navy`, `ink/ink-soft/ink-faint`, `line/line-strong/line-steel` |
| Semantic | `success|warning|danger|gap` each with `-soft` and `-border` variants |
| Fonts | IBM Plex Sans (body), **Space Grotesk** (display headings), JetBrains Mono, Caveat (cursive accents) |
| Utilities | `.glass-panel`, `.surface-panel`, `.rule-subtle`, `.blueprint-grid` (20 px), `.focus-ring-inset`, `.code-block .hljs-*` |
| Motion | `laserScan` keyframe; global `prefers-reduced-motion` kill-switch (0.01 ms) |

Rules recorded in the file itself: components must consume tokens (no raw hex); highlight.js token classes are scoped so they cannot leak.

---

## 3. Public site — `src/views/LandingPage.tsx` (555 lines)

| # | Section (anchor) | Contents | Screenshot |
| --- | --- | --- | --- |
| 1 | Hero (`#hero`) | badge "A thoughtful toolkit for your next application"; H1 *"Bring your experience closer to the role."*; CTAs **Analyze your resume free** / See how it works; trust row "N free scans each month" + "Your documents stay yours"; `HeroScanMockup`; floating "Clear, useful feedback" card | `01-landing-hero.png` |
| 2 | Three-step pipeline | Upload → Analyze → Land Job strip (`ThreeStepPipeline`) | `02-landing-pipeline.png` |
| 3 | Capabilities bento | gap finder, tailored resume, cover letter, tracker (`CapabilitiesBento`) | `03-landing-capabilities.png` |
| 4 | ATS pipeline diagram | interactive architecture diagram (`AtsPipelineDiagram`) | `04-landing-ats-diagram.png` |
| 5 | Word export mockup | what the downloaded `.docx` looks like (`WordExportMockup`) | (mid-page) |
| 6 | What every scan reports (`#proof`) | three cards: 0–100 Match Score, Keyword Gap List, STAR Guidance | `05-landing-proof.png` |
| 7 | Built for real job searches (`#who-its-for`) | three illustrated cards (`AnalysisIllustrations`) | `06-landing-who-its-for.png` |
| 8 | Pricing (`#pricing`) | **Free ₹0** (`{freeScanLimit}` scans/mo) vs **Pro ₹{priceInr}/mo** (navy glass, RECOMMENDED, "Contact the team to request activation · No automatic renewal"); both values come from `/api/payments/config` after the bundled loading fallback | `07-landing-pricing.png` |
| 9 | FAQ | 5 accordion entries (gap identification, no fabrication, export format, price rationale, "How do I upgrade to Pro?") | `08-landing-faq.png` |
| 10 | Footer | dark logo, nav links, `OwnerProfileCard` + "Request Pro activation", Purge Stored Data, price, © 2026 | `09-landing-footer.png` |

Deliberately removed (documented in code comments): employer logo strip and named case-study section — unverifiable endorsements.

The pricing cards, FAQ, footer, dashboard upgrade copy and paywall all use the admin-configured `priceInr` from `/api/payments/config`; `src/config.ts` is only the pre-load fallback.

### Auth dialog — `src/components/AuthModal.tsx`

Our dialog shell (focus trap, Escape, reduced motion) wrapping Clerk's `<SignIn>`/`<SignUp>`; Clerk owns the content including "Continue with Google". Branding footer removed; successful sign-in/sign-up routes to the dashboard. Screenshot: `10-auth-modal.png`.

### Paywall — `src/components/PaywallModal.tsx`

Manual activation: `POST /api/payments/request` → `{ reference, telegramUrl, owner, priceInr }`. The **server** assembles the Telegram link so the client cannot spoof the destination. Shows a copyable HMAC-signed payment reference and the owner card.

### Delete data — `src/components/DeleteDataModal.tsx`

"Purge Stored Data" confirmation → `AuthContext.deleteMyData()` → `POST /api/auth/delete-data`.

---

## 4. Workspace — `src/views/Dashboard.tsx` (2,557 lines)

Header: badge "Your job search workspace"; *"Welcome back, {firstName}"*; "{N} checks logged".

### Tabs (exact UI labels)

| Key | Label | Icon |
| --- | --- | --- |
| `calibration` | **Resume match** | Target |
| `tailored` | **Resume draft** | PenLine |
| `cover` | **Cover letter** | Mail |
| `tracker` | **Applications** (+ count badge) | Briefcase |
| `intelligence` | **Insights** | BarChart3 |

### 4.1 Resume match (calibration)

**Left column — input**

- "Target Job Description" textarea, required; **Quick preset** pills: *Full Stack Engineer*, *Product Manager*.
- "Resume Document (PDF or DOCX)" drag-and-drop dropzone — max 5 MB, `.pdf/.docx/.doc`, sr-only file input for keyboard access — plus **Or pick sample:** *Software Engineer*, *Product Manager*.
- Privacy note: *"Your resume is stored encrypted in your own vault and never shared or sold."*
- Submit: **Scan Resume Compatibility** (loading copy: "Evaluating resume against job description…").
- Free users additionally see the "Unlock Unlimited ATS Tailoring" banner with the runtime Pro price.
- Mobile: segmented switcher **1. Input Data / 2. Audit Results**.

**Right column — results**

| State | Rendering |
| --- | --- |
| idle | "Awaiting Candidate Profile" |
| loading | "Calibrating resume against ATS rubrics…" |
| success | status tag (*High Keyword Coverage* / *More Keywords To Review*), `ScoreGauge`, three bars (**Overall ATS score**, **Keyword coverage**, **Semantic proximity** — last one tagged *ESTIMATED*), collapsible **`ScoreExplainer`** ("How this score was calculated": 55 % coverage + 45 % vocabulary, what moves the needle, what is *not* measured, advice that never suggests quoting unclaimed keywords), Alignment Summary, 4 metric pills (keyword coverage, skill delta, ATS parser test = "Not tested", Word export), collapsible `CodeBlock` "Show raw analysis JSON", matched-keyword chips vs missing-gap chips, **`ResumeHighlightPreview`** (Normal/Highlighted toggle, per-category legend that mutes categories, clickable `<mark>` highlights with an aria-live explanation panel, selectivity note when terms were skipped), "Interactive STAR Bullet Rewriter" card, **"Mark matches in Word file"** checkbox next to the Word download (shading is computed from the same highlight engine), footer link "Open Tailored Resume" |
| 402 | paywall prompt |
| 422 unscorable | explanation from the engine (e.g. no keyword signal in the JD) |

Live capture: `11-dashboard-empty.png`, `12-dashboard-input-filled.png`, `13-dashboard-scan-results.png`, `14-dashboard-score-detail.png`, `15-dashboard-star-keywords.png`.

> The scan used for those shots returned **86 % blended = 55 % weight × keyword coverage 75 % (15/20) + 45 % × semantic proximity 100 %** — the exact numbers shown in the UI.

### 4.2 Resume draft (tailored)

| State | Rendering |
| --- | --- |
| no scan | "No Resume Evaluated Yet" → go to Resume match |
| free | "Unlock Tailored Resume for {role}" → "Unlock Tailored Word Document — ₹{priceInr}/mo" |
| Pro, nothing generated | "Generate Tailored Resume Copy" button |
| Pro, generated | pills (*Grounded rewrite*, source coverage %, warning "Local fallback — no model ran"); actions **Edit / Done editing, Copy Text, Word (.docx)**; `GroundingPanel`; editable textarea or read-only `<pre>`; "What actually changed" checklist. Grounding runs **before storage**: unsupported-skill claims (terms in the JD that never appear in the source resume) are flagged and removed from the stored draft. |

Edits are local-only and never written back to the DB. Screenshot: `16-dashboard-tailored.png`.

### 4.3 Cover letter

Same gating pattern; Pro shows narrative pills (*Role-Specific Narrative*, "AI-generated draft" / "Local outline — no model ran" / "Not generated yet"), actions **Edit, Copy, Download .txt**, and `GroundingPanel only="coverLetter"`. Screenshot: `17-dashboard-cover.png`.

### 4.4 Applications (tracker CRM)

- Metrics row: Total tracked / Applied / Interviews / Offers (+ "{N} rejected"), average-match note that excludes manual rows.
- Desktop `<table>`: Role & Company, ATS score, Status, Date, Notes, actions — mobile switches to a card stack (`30-mobile-applications.png`).
- Inline `StatusBadge`, `TrackerStatusSelect`, `TrackerNotes` (save on blur), `TrackerDelete`.
- **Track New Application** modal (focus-trapped via `useDialogA11y`): company, role, status (Saved/Applied/Interview/Offer/Rejected), notes. Manual rows keep score `null` ("—") — never invented.
- Empty state and error banner with Retry are both implemented.
- Screenshots: `18-dashboard-tracker.png`, `20-dashboard-add-application.png`.

### 4.5 Insights (intelligence)

- "Your Scan Record": scans performed, average blended score, best blended score.
- **"Diagnostics ResumeSetu does not compute"** — honest *Not measured* list: OCR/scan quality, impact verb ratio, quantified metrics per role, third-party ATS parser result.
- "Keyword Balance — {role}": matched vs missing bars.
- "Document Checks": pass / review / fail / not-tested chips with measured vs not-tested counts.
- Screenshot: `19-dashboard-insights.png`.

### Dashboard sub-components (local to the file)

`ScoreBar`, `StatusBadge`, `TrackerMetric`, `TrackerStatusSelect`, `TrackerNotes`, `TrackerDelete`, `GroundingPanel`.

## 5. Admin console — `src/views/AdminPanel.tsx` (2,172 lines)

Access screen when not privileged: "Access Restricted · System Owner & Admin Verification Required". Header: "Back to Workspace", "Platform Command Center", H1 **Admin & Operations Dashboard**, ADMIN SESSION pill, signed-in email + role, **Sync Live Data**, toast feedback area.

### Tabs (exact UI labels)

| Key | Label | Contents |
| --- | --- | --- |
| `analytics` | **Analytics & Time** | 5 KPI cards (Total Users + Active Pro + adoption, Pro Access, Verified Revenue = *confirmed receipts only*, Avg Session Time, Avg ATS Score = blended 55/45 average over real scans — no invented floors or per-user defaults); secondary grid: scans by target role, application pipeline (5 stages), estimated AI usage (all "Not instrumented") |
| `users` | **User Directory (n)** | search + filter (all/pro/free/admin/banned); columns User/Candidate, Role, Plan, Status, Scans, Time Spent, Actions: Make/Revoke Admin, Grant Pro/Set Free, Ban/Unban, Add credits, Edit, Delete. **Owner rows are protected from every mutation.** |
| `llms` | **LLM Models & Bindings** | Add New LLM; Dynamic Task Bindings (Primary/Fallback per task: score, tailor, cover_letter, star_bullet, resume_parse — each tagged **Live** when the server actually dispatches it, **Reserved** when stored for a future path: scoring/parsing/STAR run deterministically today); Model Registry table (name, provider, model id, context, latency tier, runtime use, availability, enable/disable, delete) |
| `security` | **Security & Audit** | status matrix (Prompt Injection Shield, 5 MB upload sandbox, client rate limiter); **Pro upgrade requests** parsed from `PRO_UPGRADE_REQUESTED` audit rows with Copy UID / Copy reference and an inline **Record verified payment** form (amount, channel UPI/bank/cash/other, transaction reference, note); full Security Audit Events Log |
| `monitoring` | **System Health** | uptime/Node, memory RSS/heap, host/pid, Error Rate ("Not measured"), Subsystem Health Matrix, 15 s auto-refresh with stale readings dropped |
| `settings` | **App Settings** | Free Tier Monthly Scan Limit, Pro Monthly Price INR, Maintenance Mode, Prompt Injection Shield |

Modals: **Edit User Profile** (display name, plan, role USER/ADMIN/OWNER, monthly scans used, suspend + reason) and **Add New LLM Engine** (name, provider, model id, context window, latency tier). Ban-suspend, delete-user and delete-LLM confirmations use the focus-trapped `ConfirmPromptDialog` (ban adds a reason field with a documented fallback) — no native `prompt()`/`confirm()` remains.

Screenshots: `21-admin-analytics.png` … `26-admin-settings.png`.

---

## 6. Component inventory — `src/components/`

| Component | Role |
| --- | --- |
| `Navbar.tsx` | global nav (§2.1) |
| `AuthModal.tsx` | Clerk dialog shell |
| `PaywallModal.tsx` | manual Telegram payment flow |
| `DeleteDataModal.tsx` | purge confirmation |
| `HeroScanMockup.tsx` | hero product mockup with embedded Analyze CTA |
| `ThreeStepPipeline.tsx` | Upload → Analyze → Land Job strip |
| `CapabilitiesBento.tsx` | four-capability bento grid |
| `AtsPipelineDiagram.tsx` | interactive ATS architecture diagram |
| `WordExportMockup.tsx` | `.docx` output mockup |
| `AnalysisIllustrations.tsx` | SVG illustrations: ResumeDocument, MatchScore, KeywordMap |
| `ATSInteractiveBackground.tsx` | ambient background (§2.2) |
| `Logo.tsx` | bridge emblem + wordmark (`sm/md/lg/xl`, `default/dark/light`) |
| `OwnerProfile.tsx` | `OwnerProfileCard` (compact/full/dark) + copyable `PaymentReference`; avatar degrades to a monogram — never a stock photo |
| `ScoreGauge.tsx` | animated SVG ring (250 ms stepped count-up) + badge: ≥75 Strong / ≥50 Moderate / else Low |
| `CodeBlock.tsx` | copyable JSON viewer; registers only `json`+`javascript` in highlight.js and renders tokens as React nodes (no `dangerouslySetInnerHTML`) |
| `ResumeHighlightPreview.tsx` | source-resume text with category-coloured `<mark>` highlights (engine: `lib/resume-highlight.ts`), Normal/Highlighted toggle, legend that mutes categories, click/focus a highlight → explanation panel (`aria-live`), selectivity note; text is sliced from the original, never rewritten |
| `ScoreExplainer.tsx` | collapsible "How this score was calculated" (`lib/score-explainer.ts`): formula, per-row weight/definition/contribution, *not measured* list, advice that forbids quoting unclaimed keywords |
| `ConfirmPromptDialog.tsx` | controlled confirm-or-prompt dialog on `useDialogA11y` (ban reason, delete user, delete LLM) with destructive styling |

Deleted this cycle (zero importers): `BulletDiffExplorer.tsx`, `HeroBridgeGraphic.tsx`.

### Contexts, hooks, helpers

| File | Role |
| --- | --- |
| `context/AuthContext.tsx` | Clerk ↔ backend bridge: `syncClerkSession` (4× token retry, 3× login retry on 5xx), `restoreSession`, `logout`, `refreshUser`, `cancelSubscription`, `deleteMyData`, `authBackendDown` retry state, admin-configurable `scanLimit`, `readApiJson` (refuses to parse HTML as JSON) |
| `context/LenisContext.tsx` | smooth scroll `lerp 0.075`, skipped entirely under reduced motion |
| `hooks/useDialogA11y.ts` | focus move-in, restore on close, Tab trap, Escape |
| `lib/highlight-tokens.ts` | hljs HTML → safe token arrays |

---

## 7. Accessibility & responsive behaviour

- Global `:focus-visible` outline; `focus-ring-inset` utility.
- All animation/transition durations collapse to 0.01 ms under `prefers-reduced-motion`; Lenis is skipped entirely.
- Dialogs trap focus and restore it to the invoker (including the admin ban/delete dialogs, now on `useDialogA11y`).
- Mobile-specific layouts: calibration segmented switcher, tracker card stack, collapsed nav.
- Destructive/secondary actions never rely on colour alone — every status pill carries a label.
