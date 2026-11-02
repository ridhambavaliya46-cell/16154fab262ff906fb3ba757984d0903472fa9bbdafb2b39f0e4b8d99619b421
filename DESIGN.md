# ResumeSetu design system

## Visual direction

The public landing page is an evidence studio for job seekers: midnight ink, restrained purple, blue, and teal aurora light, oversized Space Grotesk headlines, and glass surfaces that group real product previews. A light theme uses cool paper and deep ink. Product wording, navigation, authentication, prices, and actions remain owned by the existing app.

## Tokens

The landing theme tokens live in `src/index.css` under `.app-shell.landing-shell` and its `data-theme="light"` variant.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--landing-bg` | `#090b14` | `#f4f5fb` | Page canvas |
| `--landing-panel` | `rgb(20 23 39 / 78%)` | `rgb(255 255 255 / 78%)` | Glass group surfaces |
| `--landing-panel-strong` | `rgb(26 29 48 / 91%)` | `rgb(255 255 255 / 94%)` | Strong surfaces and dialogs |
| `--landing-border` | `rgb(208 216 255 / 17%)` | `rgb(53 61 101 / 17%)` | Quiet separators |
| `--landing-ink` | `#f5f4ff` | `#191a2d` | Main text |
| `--landing-muted` | `#c5c9dc` | `#434966` | Supporting text |
| `--landing-purple` | `#b7a1ff` | `#5943ac` | Active and interactive accent |
| `--landing-blue` | `#8297ff` | `#4059c7` | Secondary accent |
| `--landing-teal` | `#73e5d5` | `#147f78` | Focus and primary-action accent |

## Type and layout

- Display face: Space Grotesk; body: IBM Plex Sans; existing mono face reserved for shortcuts and data.
- The existing content and illustrations remain. Landing sections use modular bento groups where the current content supports them.
- Content remains within the existing responsive page width; hero typography scales with `clamp()` and card layouts collapse on small screens.
- Glass blur is limited to grouped panels and the sticky navigation.

## Interaction and accessibility

- The theme toggle persists `dark` or `light` in local storage and updates the browser theme color.
- Ctrl/Cmd+K opens the native dialog command palette. Search filters navigation and the resume-analysis action; arrow keys move focus among results, Enter activates a focused button, and Escape closes the dialog.
- The sticky navigation marks the visible landing section with `aria-current="location"`.
- Lenis owns one animation frame loop, tears down on unmount, and yields to reduced-motion preferences, including changes made while the page is open.
- Scroll reveals and the small preview tilt are disabled or removed for reduced-motion users. Keyboard focus uses a high-visibility teal outline.
- Generated imagery is not bundled; existing product mockups and CSS aurora provide the visual treatment.
