---
name: ResumeSetu
description: A Greek classical editorial workspace for preparing each application.
colors:
  ink: "#1D2B36"
  paper: "#F4F0E6"
  white: "#FBF9F3"
  muted: "#536873"
  quiet-border: "#DED4C2"
  night: "#132431"
  night-panel: "#1C3340"
  night-ink: "#F5EFE3"
  bronze: "#A88A5C"
  olive: "#647B66"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(2.7rem, 4.2vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Manrope, IBM Plex Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Manrope, IBM Plex Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  sm: "8px"
  md: "16px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "#17364A"
    textColor: "#FBF9F3"
    rounded: "8px"
    height: "52px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 18px"
---

# Design System: ResumeSetu

## Overview

**Creative North Star: “Aegean Ledger”**

ResumeSetu should feel like a modern Greek editorial house: limestone paper, Aegean navy, olive accents, aged bronze rules, and classical serif headlines. A Parthenon line illustration anchors the hero, a laurel crown sits above the headline, and a small lightning bolt marks the primary action. These symbols reinforce the Greek world without crowding the product story.

Use architectural proportion, marble warmth, Ionic navy, olive, and bronze details across the landing page, workspace, admin screens, and dialogs. The supplied Greek classic direction governs the theme without changing ResumeSetu's brand name, product copy, or operation. The light marble mode is the default; dark mode uses deep Aegean blue, warm ivory text, and bronze emphasis.

**Key Characteristics:**

- Limestone and Aegean navy define the light interface; deep blue and warm ivory define dark mode.
- DM Serif Display gives headlines a classical editorial voice; Manrope keeps body copy clear.
- Parthenon columns, a laurel crown, a Zeus-like lightning bolt, and a fine meander rule carry the identity.
- The document comparison is the main proof and visual anchor.
- Borders and whitespace define structure; shadows stay soft and rare.
- Workspace steps use direct language such as “Check my resume” and “Improve my resume.”
- Scores are explained as document comparisons, never hiring predictions.

## Colors

Limestone carries the light interface. Bronze marks structure and priority; olive is reserved for positive alignment and steady states.

### Primary
- **Aegean navy** (`#17364A`): Headlines, primary action, and strong brand detail.
- **Bronze** (`#A88A5C`): Rules, icons, and small emphasis.

### Secondary
- **Slate** (`#536873`): Supporting copy and secondary navigation.
- **Olive** (`#647B66`): Positive alignment and steady states.

### Neutral
- **Limestone** (`#F4F0E6`): Main application canvas.
- **Ivory** (`#FBF9F3`): Document preview and elevated content surface.
- **Bronze Line** (`#DED4C2`): Hairlines around sections and controls.
- **Aegean Night** (`#132431`): Dark theme canvas.

### Named Rules
**The Aegean Palette Rule.** Use navy for action, bronze for fine emphasis, olive for positive states, and keep contrast readable on limestone.

## Typography

**Display Font:** DM Serif Display 400 (Georgia fallback)

**Body Font:** Manrope 400/500 (IBM Plex Sans fallback)
**Label Font:** Manrope; monospace remains reserved for actual data.

**Character:** Classical display lettering gives headlines an editorial voice; clear sans-serif body copy keeps application details easy to scan.

### Hierarchy
- **Display** (400, `clamp(2.7rem, 4.2vw, 4rem)`, 1.08): Landing-page hero.
- **Headline** (400, `clamp(2.25rem, 4.1vw, 3.65rem)`, 1.08): Major page sections.
- **Title** (600, 1.25rem, 1.3): Feature titles and preview labels.
- **Body** (400, 1rem, 1.7): Paragraphs, with line length kept near 65–70ch.
- **Label** (600, 0.75rem, 1.4): Navigation and concise product metadata; use sentence case.

## Layout

The landing hero centers its existing product promise above a quiet Parthenon line illustration and a Greek meander rule; the resume comparison moves directly below as concrete proof. Existing sections, routes, and actions remain in place. On narrow screens the illustration scales below the copy, and navigation yields to the existing mobile menu.

## Elevation & Depth

Surfaces stay flat at rest. Soft, low shadows separate document previews and menus from limestone paper. Bronze edge details define the primary action without extra glow.

## Shapes

Use restrained 8–16px corners for panels and a compact rectangular primary action. Avoid nested rounded cards. Bronze and limestone borders stay thin.

## Components

### Buttons
- **Shape:** Primary action has a compact rectangular silhouette; secondary actions preserve the same generous hit area.
- **Primary:** Aegean navy with warm ivory text and a fine bronze edge.
- **Hover / Focus:** One-pixel lift; clear high-contrast keyboard outline.

### Cards / Containers
- **Background:** Ivory against limestone paper.
- **Shadow Strategy:** Soft and limited to document preview and menus.
- **Border:** One-pixel quiet border.

### Navigation
- **Style:** Sentence-case Manrope, medium weight, muted Aegean ink by default; a subtle bronze underline marks the active section.
- **Mobile:** Existing menu remains thumb-friendly.

## Do's and Don'ts

### Do:
- **Do** give the sample document comparison room to breathe.
- **Do** use limestone whitespace and quiet architectural rules.
- **Do** preserve ResumeSetu’s current copy, pricing behavior, and working actions.

### Don't:
- **Don't** add decorative gradients or overuse classical ornament.
- **Don't** use fake partner logos, decorative metrics, or unsupported hiring claims.
- **Don't** turn every feature into an equal-size card.
