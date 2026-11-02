# ResumeSetu

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite application; preserve its existing routes, API calls, authentication, and business logic.

## Users

Job seekers comparing a resume with a specific job description, reviewing documented alignment, and organizing applications.

## Product Purpose

ResumeSetu compares a candidate's resume with a target job description. It reports a deterministic 0–100 document match score, keyword matches and gaps, alignment guidance, and document checks. Pro members can create reviewable source-grounded resume drafts and cover letters, export a single-column Word document, and use an application tracker.

## Positioning

The match score describes alignment between the submitted resume and job description. It is not an ATS parser result, a hiring prediction, or a promise of an interview. Tailored drafts must stay grounded in the source resume and must not add unsupported achievements or metrics.

## Operating Context

Candidates upload a PDF or DOCX resume (up to 5 MB) or select a sample and paste a job description. The workspace includes a resume draft, cover letter, application tracker, and insights. Free scan limits and Pro pricing are admin-configurable. Pro activation is manual after payment review; there is no automatic checkout or renewal in the current version.

## Capabilities and Constraints

- The public landing page explains the product and pricing; signed-in users work in the dashboard; owner-only controls live in the admin console.
- A score is unavailable for unscorable input; the scan returns an explanation instead of a fabricated result.
- Missing keywords are prompts for the candidate to assess, not skills to add for score inflation.
- Preserve privacy, data deletion, authentication, application tracking, exports, and account-management flows.
- Keep current product wording, prices, service claims, and working actions intact during visual redesign.

## Evidence on Hand

Repository README, current interface copy, API implementation, and previous user-confirmed product facts. Keep examples labeled as examples and do not introduce unverified testimonials, employer endorsements, candidate outcomes, performance metrics, or hiring claims.
