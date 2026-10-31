---
name: ResumeSetu
description: An evidence-led workspace for thoughtful job applications
colors:
  canvas: "#F6F4EE"
  paper: "#FFFEFA"
  ink: "#1A342E"
  ink-soft: "#4C6259"
  ink-muted: "#63766D"
  evergreen: "#28664F"
  evergreen-dark: "#1F523F"
  sage: "#BDCFBF"
  clay: "#B96643"
  line: "#DFE3DA"
  warning: "#9B5C1F"
  danger: "#A24439"
typography:
  display:
    fontFamily: "Space Grotesk, IBM Plex Sans, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 4.1rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.evergreen}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.875rem 1.5rem"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
---

# Design System: ResumeSetu

## Overview

**Creative North Star: “The Editorial Evidence Desk”**

ResumeSetu should feel like a thoughtful career coach working from a marked-up document: calm, candid, and practical. Warm paper grounds the interface; evergreen ink and restrained clay accents bring hierarchy without making the product feel like a hiring authority. The system favors legible evidence, clear user control, and generous room to review.

Use simple CSS and code-native illustrations to explain document and role relationships. Sample data must be labeled as illustrative. A match score describes only alignment between submitted text and a supplied role; it does not predict hiring outcomes or claim third-party parser compatibility.

**Key Characteristics:**
- Warm paper, deep evergreen ink, and quiet rules
- Editorial display type paired with highly readable body text
- Evidence before metrics; explicit labels on every sample
- Restrained motion with native reduced-motion support

## Colors

Warm neutral surfaces and evergreen carry the interface. Clay and semantic state colors remain sparse and meaningful.

### Primary
- **Evergreen** (#28664F): Primary actions, selected states, and the strongest supportive accent.
- **Deep Evergreen** (#1F523F): Hover and deeper emphasis.

### Secondary
- **Sage** (#BDCFBF): Soft emphasis, illustrative backdrops, and secondary accents.
- **Clay** (#B96643): Small highlights where a warm counterpoint improves hierarchy.

### Neutral
- **Warm Canvas** (#F6F4EE): Main page background.
- **Paper** (#FFFEFA): Panels, document previews, and readable content surfaces.
- **Ink** (#1A342E): Primary text and dark surfaces.
- **Soft Ink** (#4C6259): Supporting body copy.
- **Muted Ink** (#63766D): Secondary labels; check contrast before use at small sizes.
- **Fine Rule** (#DFE3DA): Dividers and quiet borders.
- **Warning** (#9B5C1F) and **Danger** (#A24439): Semantic states only.

### Named Rules
**The Evidence Rule.** Never use color or a decorative score to imply a hiring outcome, verified result, or parser test.

## Typography

**Display Font:** Space Grotesk (with IBM Plex Sans fallback)  
**Body Font:** IBM Plex Sans  
**Label/Mono Font:** IBM Plex Sans for labels; JetBrains Mono only for actual data or code.

**Character:** Space Grotesk gives headings a distinct editorial voice. IBM Plex Sans keeps dense product language open and readable. Mono is reserved for literal values and document-like details.

### Hierarchy
- **Display** (700, clamp 2.6–4.1rem, 1.08): Landing hero headline.
- **Headline** (700–800, 2–3rem, tight): Section headings.
- **Title** (600–700, 1–1.25rem, 1.3): Panel and feature headings.
- **Body** (400, 1rem, 1.65; 65–75ch maximum): Explanations and instructions.
- **Label** (600, 0.75rem, 1.4): Compact UI status and control labels.

## Layout

Use a centered content measure up to 72rem, with responsive gutters that grow from 1rem to 2rem. Keep hero copy and its evidence preview as a two-column composition on wide screens and stack them on narrow screens. Product workspaces should favor scanable rows and clear content hierarchy over marketing-style feature cards. Keep heading groups distinct from their content and preserve generous vertical rhythm between sections.

## Elevation & Depth

Panels sit close to the page plane. Use fine borders and a soft, offset shadow only when a surface needs separation. Avoid decorative blur, glass layers, and floating halos. Interactive lift should be slight and short.

## Shapes

Use restrained rounded corners: 8px on compact controls, 12px on inputs, 16px on panels, and 24px on larger editorial panels. Prefer thin neutral borders. Focus indicators must remain visible and use the evergreen/sage palette.

## Components

- **Primary actions:** Evergreen fill, paper text, clear action verbs, visible keyboard focus, and a comfortable 44px minimum hit target.
- **Panels:** Paper surface, fine rule, spacious interior; avoid nesting panels inside panels.
- **Sample previews:** Place an “Illustrative sample” label in the preview itself and avoid real company identities or invented performance outcomes.
- **Scores and gaps:** Describe what the score measures. Gaps are review prompts, not recommendations to add unsupported claims.
- **Motion:** Lenis has one manually owned RAF loop, is destroyed on cleanup, and is disabled when reduced motion is enabled. Reveals use IntersectionObserver and stay visible by default.

## Do's and Don'ts

- Do show where a suggestion came from and let users review it.
- Do state when sample content is fictional or illustrative.
- Do make Pro's manual payment review and activation clear near the upgrade action.
- Do test small text for 4.5:1 contrast and preserve keyboard operation.
- Don't imply a match score predicts callbacks, hiring, or ATS parsing success.
- Don't add unverified testimonials, employer endorsements, or performance metrics.
- Don't use gradients, glass, or motion as substitutes for hierarchy.
- Don't use monospaced type as generic decoration.
