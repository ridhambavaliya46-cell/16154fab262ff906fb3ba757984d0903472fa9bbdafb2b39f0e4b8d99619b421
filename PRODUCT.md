# ResumeSetu

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers who want to compare their resume with a specific job description, understand where their documented experience aligns, and organize applications.

## Product Purpose

ResumeSetu provides an auditable comparison between a candidate’s resume and a target job description. It reports a deterministic 0–100 match score, keyword matches and gaps, alignment guidance, and document checks. Pro members can create reviewable, source-grounded resume drafts and cover letters, export a single-column Word document, and use an application tracker.

## Positioning

The match score describes alignment between the submitted resume and job description. It is not an ATS parser result, a hiring prediction, or a promise of an interview. Scoring is deterministic: 55% keyword coverage and 45% semantic proximity. Tailored drafts must remain grounded in the source resume; unsupported achievements and metrics are not added.

## Operating Context

A candidate pastes a job description and uploads a PDF or DOCX resume (up to 5 MB) or selects a sample. The workspace also includes a resume draft, cover letter, application tracker, and insights. Free monthly scan limits and Pro pricing are admin-configurable. Pro defaults to ₹249/month, is requested through the team, and is activated after manual payment review; there is no automatic checkout or renewal in the current version.

## Capabilities and Constraints

- The public landing page explains the product and pricing; signed-in users work in the dashboard; owner-only controls live in the admin console.
- A score is unavailable for unscorable input; the scan returns an explanation instead of a fabricated result.
- The product reports parser tests, OCR quality, and other unmeasured outcomes as not tested or not measured.
- Missing keywords are evidence gaps for the candidate to assess; the product does not add them to a resume to inflate coverage.
- Resume data is represented as private, encrypted user data in the product documentation. Preserve the existing privacy and deletion flows.
- Generated imagery may be added only after its commercial usage rights are verified for the selected model and terms.

## Evidence on Hand

The repository README, implementation, product documentation, and existing screenshots describe the current workflows. Demo content must be clearly labeled as illustrative. Do not introduce unverified testimonials, employer endorsements, candidate outcomes, performance metrics, or hiring claims.

## Product Principles

1. Show evidence from the candidate’s documents and the supplied job description.
2. Keep the score explainable and separate from predictions about employers or hiring systems.
3. Let candidates review and decide which suggested changes reflect their actual experience.
4. Keep privacy, deletion, and manual Pro activation terms clear at the point of decision.
